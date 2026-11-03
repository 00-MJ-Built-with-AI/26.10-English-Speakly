import { useEffect, useRef, useState } from 'react';
import type { GenKind, GenOut } from '../../../shared/toefl.ts';
import { bandFromSection30, overallBand, section30FromBand, section30FromShare, SECTION_LABELS, type Section, type ToeflScore } from '../../engine/toeflScale.ts';
import { aiTask } from '../../lib/api.ts';
import { go, href } from '../../lib/router.ts';
import { useApp } from '../../lib/store.tsx';
import { Icon } from '../components/Icon.tsx';
import { recordOutcome } from './record.ts';
import { GapCard } from './Scores.tsx';
import { TaskView, type TaskOutcome } from './tasks.tsx';

type Difficulty = 'easier' | 'standard' | 'harder';
type Written = Exclude<Section, 'speaking'>;

interface Stage {
  id: string;
  section: Written;
  title: string;
  kinds: GenKind[];
  /** Time for the whole stage; null when the task has its own timer (essays). */
  seconds: number | null;
  /** Second-stage module: easier or harder depending on the first stage. */
  adaptive?: boolean;
}

const STAGES: Stage[] = [
  { id: 'r1', section: 'reading', title: 'Reading, module 1', kinds: ['complete', 'daily'], seconds: 9 * 60 },
  { id: 'r2', section: 'reading', title: 'Reading, module 2', kinds: ['academic', 'daily'], seconds: 11 * 60, adaptive: true },
  { id: 'l1', section: 'listening', title: 'Listening, module 1', kinds: ['response', 'conversation'], seconds: 9 * 60 },
  { id: 'l2', section: 'listening', title: 'Listening, module 2', kinds: ['announcement', 'talk'], seconds: 11 * 60, adaptive: true },
  { id: 'w1', section: 'writing', title: 'Writing: Build a Sentence', kinds: ['build'], seconds: 6 * 60 },
  { id: 'w2', section: 'writing', title: 'Writing: Write an Email', kinds: ['email'], seconds: null },
  { id: 'w3', section: 'writing', title: 'Writing: Academic Discussion', kinds: ['discussion'], seconds: null },
];

/** How many points an item is worth, so unanswered items count as zero when time runs out. */
function maxPoints(kind: GenKind, data: unknown): number {
  switch (kind) {
    case 'complete':
      return (data as GenOut<'complete'>).words.length;
    case 'response':
      return (data as GenOut<'response'>).items.length;
    case 'build':
      return (data as GenOut<'build'>).items.length;
    case 'email':
    case 'discussion':
      return 5;
    default:
      return (data as GenOut<'academic'>).questions.length;
  }
}

interface StageResult {
  points: number;
  max: number;
  difficulty: Difficulty;
}

/** 0-30 per written section from the stage results. A lower second module caps the score, like the real test. */
function sectionScores(results: Record<string, StageResult>): Partial<Record<Section, number>> {
  const out: Partial<Record<Section, number>> = {};
  for (const section of ['reading', 'listening', 'writing'] as const) {
    let points = 0;
    let max = 0;
    for (const st of STAGES.filter((s) => s.section === section)) {
      const r = results[st.id];
      if (!r) continue;
      const w = st.adaptive && r.difficulty === 'easier' ? 0.75 : 1;
      points += r.points * w;
      max += r.max;
    }
    if (max) out[section] = section30FromShare(points / max);
  }
  return out;
}

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** The full test: timed Reading, Listening and Writing (two-stage adaptive), then the Speaking mock. */
export function FullMock({ finish }: { finish: boolean }) {
  return finish ? <MockResults /> : <MockRunner />;
}

/** One section on its own, timed like the real test, giving a band for that skill. */
export function SectionTest({ section }: { section: Written }) {
  return <MockRunner section={section} />;
}

const SECTION_MINUTES: Record<Written, string> = { reading: 'about 20 minutes, two modules', listening: 'about 20 minutes, two modules', writing: 'about 23 minutes' };

function MockRunner({ section }: { section?: Written }) {
  const app = useApp();
  const stages = section ? STAGES.filter((s) => s.section === section) : STAGES;
  const [phase, setPhase] = useState<'intro' | 'loading' | 'running' | 'written' | 'section-done'>('intro');
  const [sectionResult, setSectionResult] = useState<{ band: number; score30: number } | null>(null);
  const [stageIx, setStageIx] = useState(0);
  const [taskIx, setTaskIx] = useState(0);
  const [items, setItems] = useState<{ kind: GenKind; data: unknown }[]>([]);
  const [left, setLeft] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [scores30, setScores30] = useState<Partial<Record<Section, number>>>({});
  const cache = useRef(new Map<string, Promise<unknown>>());
  const results = useRef<Record<string, StageResult>>({});
  const outcomes = useRef<TaskOutcome[]>([]);
  const difficulty = useRef<Difficulty>('standard');
  const deadline = useRef(0);
  const starting = useRef({ ix: 0, d: 'standard' as Difficulty });
  const stage = stages[stageIx];

  function fetchItem(st: Stage, kind: GenKind, d: Difficulty) {
    const key = `${st.id}:${kind}:${d}`;
    if (!cache.current.has(key)) {
      const p = aiTask('toeflGen', { kind, difficulty: d });
      p.catch(() => cache.current.delete(key));
      cache.current.set(key, p);
    }
    return cache.current.get(key)!;
  }

  /** Starts a stage, and fetches the next fixed stage in the background so there's less waiting. */
  async function startStage(ix: number, d: Difficulty) {
    const st = stages[ix];
    starting.current = { ix, d };
    setPhase('loading');
    setError(null);
    difficulty.current = d;
    try {
      const next = stages[ix + 1];
      if (next && !next.adaptive) next.kinds.forEach((k) => fetchItem(next, k, 'standard'));
      const data = await Promise.all(st.kinds.map((k) => fetchItem(st, k, d)));
      setItems(st.kinds.map((kind, k) => ({ kind, data: data[k] })));
      setStageIx(ix);
      setTaskIx(0);
      outcomes.current = [];
      deadline.current = st.seconds ? Date.now() + st.seconds * 1000 : 0;
      setLeft(st.seconds ?? 0);
      setPhase('running');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function endStage() {
    if (phase !== 'running') return;
    // Items not reached before time ran out score zero.
    let points = 0;
    let max = 0;
    items.forEach((it, k) => {
      const o = outcomes.current[k];
      points += o?.points ?? 0;
      max += o?.max ?? maxPoints(it.kind, it.data);
    });
    results.current[stage.id] = { points, max, difficulty: difficulty.current };
    const nextIx = stageIx + 1;
    if (nextIx >= stages.length && section) {
      const score30 = sectionScores(results.current)[section] ?? 0;
      const band = bandFromSection30(section, score30);
      app.update((u) => (u.toefl.sectionTests = [...u.toefl.sectionTests, { at: Date.now(), section, band, score30 }].slice(-100)));
      app.logAttempt({ at: Date.now(), kind: 'toefl', title: `TOEFL ${SECTION_LABELS[section]} section test`, seconds: 0, scores: {}, detail: { section, overall: band } });
      setSectionResult({ band, score30 });
      setPhase('section-done');
      return;
    }
    if (nextIx >= stages.length) {
      const s30 = sectionScores(results.current);
      setScores30(s30);
      app.update((u) => (u.toefl.pendingMock = { at: Date.now(), scores30: s30 }));
      setPhase('written');
      return;
    }
    const next = stages[nextIx];
    let d: Difficulty = 'standard';
    if (next.adaptive) d = max && points / max >= 0.6 ? 'harder' : 'easier';
    startStage(nextIx, d);
  }

  useEffect(() => {
    if (phase !== 'running' || !deadline.current) return;
    const t = setInterval(() => {
      const l = Math.max(0, (deadline.current - Date.now()) / 1000);
      setLeft(l);
      if (l === 0) endStage();
    }, 500);
    return () => clearInterval(t);
  }); // re-armed each render so endStage sees the latest state

  function onSubmit(o: TaskOutcome) {
    const it = items[taskIx];
    outcomes.current[taskIx] = o;
    app.update((u) => recordOutcome(u, it.kind, o));
    if (taskIx + 1 < items.length) setTaskIx(taskIx + 1);
    else endStage();
  }

  if (phase === 'intro' && section) {
    return (
      <div className="stack">
        <h1>{SECTION_LABELS[section]} section test</h1>
        <div className="card stack">
          <p style={{ margin: 0 }}>
            The full {SECTION_LABELS[section]} section, timed ({SECTION_MINUTES[section]}), with no feedback until the end.
            {section !== 'writing' && ' Module 1 decides whether module 2 is the easier or harder one, like the real test.'}
            {section === 'listening' && ' Audio plays once at normal speed.'}
            {section === 'writing' && ' Typed, no spellcheck, no pasting.'}
          </p>
          {error && <div className="banner error">{error}</div>}
          <button className="btn primary big" onClick={() => startStage(0, 'standard')}>
            <Icon name="target" /> Start
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'section-done' && section && sectionResult) {
    const target = app.user.toefl.target;
    const gap = Math.max(0, target - sectionResult.band);
    return (
      <div className="stack">
        <h1>{SECTION_LABELS[section]}: band {sectionResult.band.toFixed(1)}</h1>
        <div className="card stack">
          <div className="spread">
            <span>Comparable score</span>
            <span className="chip brand">{sectionResult.score30} / 30</span>
          </div>
          <div className="spread">
            <span>Your target</span>
            <span className={`chip ${gap ? 'bad' : 'good'}`}>{gap ? `${target.toFixed(1)} (+${gap.toFixed(1)} to go)` : `${target.toFixed(1)} reached`}</span>
          </div>
          <p className="small muted" style={{ margin: 0 }}>
            An estimate from AI-written items. Your answers also went into the mistake log, so the drills now lean on what you missed.
          </p>
        </div>
        <div className="row">
          <a className="btn primary" href={href(`/toefl/${section}`)}>
            Back to {SECTION_LABELS[section]}
          </a>
          <a className="btn" href={href('/toefl/mistakes')}>
            Mistake log
          </a>
        </div>
      </div>
    );
  }

  if (phase === 'intro') {
    return (
      <div className="stack">
        <a className="small" href={href('/toefl')}>
          ← TOEFL
        </a>
        <h1>Full mock test</h1>
        <div className="card stack">
          <p style={{ margin: 0 }}>All four sections in the 2026 format, timed, with no feedback until the end. Set aside about 75 minutes in a quiet place.</p>
          <ul className="small" style={{ margin: 0 }}>
            <li>
              <b>Reading</b> (20 min) and <b>Listening</b> (20 min): two modules each. How you do on module 1 decides whether module 2 is the easier or harder one, like the real test.
            </li>
            <li>
              <b>Writing</b> (about 23 min): Build a Sentence, then an email (7 min) and an academic discussion post (10 min). Typed, no spellcheck, no pasting.
            </li>
            <li>
              <b>Speaking</b> (about 8 min): Listen and Repeat, then Take an Interview.
            </li>
          </ul>
          <p className="small muted" style={{ margin: 0 }}>
            Audio plays once. If time runs out, unanswered items score zero. Your result is an estimate on the 1-6 scale and the comparable 0-120 total.
          </p>
          {error && <div className="banner error">{error}</div>}
          <button className="btn primary big" onClick={() => startStage(0, 'standard')}>
            <Icon name="trophy" /> Start the test
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'loading') {
    return (
      <div className="stack">
        <h1>Preparing {stages[starting.current.ix].title}…</h1>
        {error ? (
          <div className="card stack">
            <div className="banner error">{error}</div>
            <button className="btn primary" onClick={() => startStage(starting.current.ix, starting.current.d)}>
              Try again
            </button>
          </div>
        ) : (
          <div className="card muted">Writing new test items. This takes a few seconds.</div>
        )}
      </div>
    );
  }

  if (phase === 'written') {
    const lastSpeaking = app.user.toeflBand;
    return (
      <div className="stack">
        <h1>Reading, Listening and Writing done</h1>
        <div className="card stack">
          {(['reading', 'listening', 'writing'] as const).map((s) => (
            <div key={s} className="spread">
              <span>{SECTION_LABELS[s]}</span>
              <span className="chip brand">
                {scores30[s] ?? 0}/30 · band {bandFromSection30(s, scores30[s] ?? 0).toFixed(1)}
              </span>
            </div>
          ))}
        </div>
        <div className="card stack">
          <p style={{ margin: 0 }}>Last part: Speaking, about 8 minutes. Your microphone opens automatically.</p>
          <button className="btn primary big" onClick={() => go('/toefl/mock')}>
            <Icon name="mic" /> Continue to Speaking
          </button>
          {lastSpeaking != null && (
            <button
              className="btn ghost"
              onClick={() => {
                app.update((u) => u.toefl.pendingMock && (u.toefl.pendingMock.speakingBand = lastSpeaking));
                go('/toefl/full-mock?finish=1');
              }}
            >
              Skip speaking and use my latest speaking estimate ({lastSpeaking.toFixed(1)})
            </button>
          )}
        </div>
      </div>
    );
  }

  const it = items[taskIx];
  return (
    <div className="stack">
      <div className="spread">
        <span className="small muted">
          {stage.title} · task {taskIx + 1} of {items.length}
          {stage.adaptive && ` · ${difficulty.current === 'harder' ? 'upper' : 'lower'} module`}
        </span>
        {stage.seconds != null && <span className={`chip ${left > 60 ? 'brand' : 'bad'}`}>{clock(left)}</span>}
      </div>
      <div className="card" key={`${stage.id}-${taskIx}`}>
        <TaskView kind={it.kind} data={it.data} mode="mock" onSubmit={onSubmit} />
      </div>
    </div>
  );
}

/** After Speaking: combine everything into one estimated score and compare it with the KAUST goal. */
function MockResults() {
  const app = useApp();
  const pending = app.user.toefl.pendingMock;
  const [saved, setSaved] = useState<ToeflScore | null>(null);
  const once = useRef(false);

  useEffect(() => {
    if (once.current || !pending || pending.speakingBand == null) return;
    once.current = true;
    const bands = {
      reading: bandFromSection30('reading', pending.scores30.reading ?? 0),
      listening: bandFromSection30('listening', pending.scores30.listening ?? 0),
      writing: bandFromSection30('writing', pending.scores30.writing ?? 0),
      speaking: pending.speakingBand,
    };
    const score: ToeflScore = {
      id: Date.now().toString(36),
      at: Date.now(),
      date: new Date().toISOString().slice(0, 10),
      source: 'mock',
      overall: overallBand(bands),
      bands,
      scores30: { ...pending.scores30, speaking: section30FromBand('speaking', pending.speakingBand) },
    };
    app.update((u) => {
      u.toefl.scores = [score, ...u.toefl.scores];
      delete u.toefl.pendingMock;
    });
    app.logAttempt({ at: Date.now(), kind: 'toefl', title: 'TOEFL full mock test', seconds: 0, scores: {}, detail: { fullMock: true, overall: score.overall } });
    setSaved(score);
  }, [pending]); // saves once speaking is in

  if (saved) {
    return (
      <div className="stack">
        <h1>Mock test result</h1>
        <GapCard score={saved} showPlan />
        <div className="row">
          <a className="btn primary" href={href('/toefl/mistakes')}>
            See your mistake log
          </a>
          <a className="btn" href={href('/toefl')}>
            TOEFL home
          </a>
        </div>
      </div>
    );
  }
  return (
    <div className="stack">
      <h1>Mock test result</h1>
      <div className="card stack">
        {pending ? (
          <>
            <p style={{ margin: 0 }}>Reading, Listening and Writing are done. Finish the Speaking part to get your full result.</p>
            <button className="btn primary" onClick={() => go('/toefl/mock')}>
              <Icon name="mic" /> Continue to Speaking
            </button>
          </>
        ) : (
          <>
            <p style={{ margin: 0 }}>There is no mock test in progress.</p>
            <a className="btn primary" href={href('/toefl/full-mock')} style={{ alignSelf: 'flex-start' }}>
              Start a full mock test
            </a>
          </>
        )}
      </div>
    </div>
  );
}
