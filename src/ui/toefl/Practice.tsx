import { useState, type ReactNode } from 'react';
import type { GenKind, QuestionType } from '../../../shared/toefl.ts';
import { weakTypes } from '../../engine/toeflPlan.ts';
import { skillBand } from '../../engine/toeflSkill.ts';
import { SECTION_LABELS, type Section } from '../../engine/toeflScale.ts';
import { aiTask } from '../../lib/api.ts';
import { href } from '../../lib/router.ts';
import { useApp } from '../../lib/store.tsx';
import { Icon } from '../components/Icon.tsx';
import { useElapsed } from '../components/speaking.tsx';
import { KIND_LABEL, KIND_SECTION, recordOutcome, SECTION_KINDS } from './record.ts';
import { TaskView, type TaskOutcome } from './tasks.tsx';

type Difficulty = 'easier' | 'standard' | 'harder';
const MCQ_TYPES: QuestionType[] = ['main-idea', 'detail', 'inference', 'vocabulary', 'purpose', 'organization', 'attitude'];
const MCQ_KINDS: GenKind[] = ['daily', 'academic', 'conversation', 'announcement', 'talk', 'notes'];

/** Default difficulty from the current band for this skill. */
function useDefaultDifficulty(section: Section): Difficulty {
  const { user } = useApp();
  const b = skillBand(user.toefl, section, user.toeflBand)?.band;
  if (b == null) return 'standard';
  return b >= 5 ? 'harder' : b <= 3.5 ? 'easier' : 'standard';
}

/** Saves a finished set: stats, the attempt log, and writing corrections into the mistake bank. */
function useRecord() {
  const app = useApp();
  return async (kind: GenKind, o: TaskOutcome, seconds: number) => {
    if (o.revision) return;
    app.update((u) => recordOutcome(u, kind, o));
    await app.logAttempt({
      at: Date.now(),
      kind: 'toefl',
      title: `TOEFL ${SECTION_LABELS[KIND_SECTION[kind]]}: ${KIND_LABEL[kind]}`,
      seconds,
      scores: o.writing ? { grammar: o.writing.score * 20, vocabulary: o.writing.score * 20 } : {},
      detail: { section: KIND_SECTION[kind], task: kind, points: o.points, max: o.max },
    });
    if (o.writing?.corrections.length) {
      await app.addMistakes(
        o.writing.corrections.map((c) => ({ kind: c.kind, said: c.original, better: c.corrected, why: c.explanation })),
        `TOEFL ${KIND_LABEL[kind]}`,
      );
    }
  };
}

/** Practice-only listening settings: speed and voices (the real test is normal speed). */
export function ListenSettings() {
  const { user, update } = useApp();
  const t = user.toefl;
  return (
    <div className="row small">
      <span className="muted">Speed:</span>
      {[0.8, 1, 1.2].map((r) => (
        <button key={r} className={`btn small ${t.listenRate === r ? 'primary' : 'ghost'}`} onClick={() => update((u) => (u.toefl.listenRate = r))}>
          {r}x
        </button>
      ))}
      <span className="muted">Voices:</span>
      {(['standard', 'varied'] as const).map((v) => (
        <button key={v} className={`btn small ${t.listenVoices === v ? 'primary' : 'ghost'}`} onClick={() => update((u) => (u.toefl.listenVoices = v))}>
          {v === 'standard' ? 'Same' : 'Varied'}
        </button>
      ))}
    </div>
  );
}

interface RunnerProps {
  section: Section;
  title: string;
  kinds: GenKind[];
  initialKind?: GenKind;
  /** Extra instruction passed to the item writer (e.g. a grammar pattern). */
  topic?: string;
  intro?: ReactNode;
  /** Hide the difficulty buttons (drills where level matters less). */
  fixedDifficulty?: Difficulty;
}

/** Pick a task type, get a fresh AI-written set, see answers and explanations. */
export function PracticeRunner({ section, title, kinds, initialKind, topic, intro, fixedDifficulty }: RunnerProps) {
  const app = useApp();
  const t = app.user.toefl;
  const [kind, setKind] = useState<GenKind>(initialKind && kinds.includes(initialKind) ? initialKind : kinds[0]);
  const def = useDefaultDifficulty(section);
  const [difficulty, setDifficulty] = useState<Difficulty>(fixedDifficulty ?? def);
  const weak = weakTypes(t.typeStats).filter((x) => (MCQ_TYPES as string[]).includes(x)) as QuestionType[];
  const [useFocus, setUseFocus] = useState(Boolean(weak[0]));
  const [item, setItem] = useState<{ kind: GenKind; data: unknown; n: number } | null>(null);
  const [outcome, setOutcome] = useState<TaskOutcome | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const elapsed = useElapsed();
  const record = useRecord();

  async function load(k = kind) {
    setLoading(true);
    setError(null);
    setOutcome(null);
    try {
      const focusType = useFocus && weak[0] && MCQ_KINDS.includes(k) ? weak[0] : undefined;
      const data = await aiTask('toeflGen', { kind: k, difficulty, focusType, topic });
      setItem({ kind: k, data, n: Date.now() });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function done(o: TaskOutcome) {
    if (!item) return;
    setOutcome(o);
    await record(item.kind, o, elapsed());
  }

  const listening = section === 'listening';
  return (
    <div className="stack">
      <h1>{title}</h1>
      {intro}
      <div className="card stack">
        {kinds.length > 1 && (
          <div className="row">
            {kinds.map((k) => (
              <button key={k} className={`btn small ${kind === k ? 'primary' : ''}`} onClick={() => (setKind(k), setItem(null), setOutcome(null))}>
                {KIND_LABEL[k]}
              </button>
            ))}
          </div>
        )}
        {!fixedDifficulty && (
          <div className="row small">
            <span className="muted">Difficulty:</span>
            {(['easier', 'standard', 'harder'] as const).map((d) => (
              <button key={d} className={`btn small ${difficulty === d ? 'primary' : 'ghost'}`} onClick={() => setDifficulty(d)}>
                {d === 'easier' ? 'Lower module' : d === 'harder' ? 'Upper module' : 'Standard'}
              </button>
            ))}
            {weak[0] && MCQ_KINDS.includes(kind) && (
              <label className="row">
                <input type="checkbox" checked={useFocus} onChange={(e) => setUseFocus(e.target.checked)} /> More “{weak[0]}” questions (your weakest)
              </label>
            )}
          </div>
        )}
        {listening && <ListenSettings />}
        {section === 'writing' && (
          <div className="small muted">
            On the real test you type everything yourself: no dictation tools like Wispr Flow, no spellcheck, no pasting. <a href={href('/toefl/typing')}>Typing practice</a>
          </div>
        )}
        <button className="btn primary" onClick={() => load()} disabled={loading} style={{ alignSelf: 'flex-start' }}>
          <Icon name="refresh" size={16} /> {loading ? 'Writing a new set…' : item ? 'New set' : 'Start'}
        </button>
        {error && <div className="banner error">{error}</div>}
      </div>
      {item && (
        <div className="card" key={item.n}>
          <TaskView kind={item.kind} data={item.data} mode="practice" onSubmit={done} />
          {outcome && !outcome.writing && (
            <div className="row" style={{ marginTop: 14 }}>
              <span className={`chip ${outcome.points / outcome.max >= 0.8 ? 'good' : outcome.points / outcome.max >= 0.6 ? 'ok' : 'bad'}`}>
                {outcome.points} / {outcome.max} correct
              </span>
              <button className="btn primary small" onClick={() => load(item.kind)} disabled={loading}>
                Next set <Icon name="next" size={14} />
              </button>
            </div>
          )}
          {outcome?.writing && (
            <button className="btn primary small" onClick={() => load(item.kind)} disabled={loading} style={{ marginTop: 14 }}>
              New prompt <Icon name="next" size={14} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** The real test tasks of one section. */
export function SectionPractice({ section, task }: { section: Exclude<Section, 'speaking'>; task?: string }) {
  const kinds = SECTION_KINDS[section];
  return <PracticeRunner section={section} title={`${SECTION_LABELS[section]}: test tasks`} kinds={kinds.map((k) => k.kind)} initialKind={kinds.find((k) => k.key === task)?.kind} />;
}

/** Ten minutes a day: a short mixed set for one skill, leaning on the weakest question type. */
const DRILLS: Record<Exclude<Section, 'speaking'>, GenKind[]> = {
  reading: ['complete', 'paraphrase', 'daily'],
  listening: ['response', 'implied', 'dictation'],
  writing: ['build', 'spelling', 'email'],
};

export function Drill({ section }: { section: Exclude<Section, 'speaking'> }) {
  const app = useApp();
  const weak = weakTypes(app.user.toefl.typeStats).filter((x) => (MCQ_TYPES as string[]).includes(x)) as QuestionType[];
  const difficulty = useDefaultDifficulty(section);
  const kinds = DRILLS[section];
  const [step, setStep] = useState(-1);
  const [data, setData] = useState<unknown>(null);
  const [results, setResults] = useState<TaskOutcome[]>([]);
  const [error, setError] = useState<string | null>(null);
  const elapsed = useElapsed();
  const record = useRecord();

  async function go(n: number) {
    setStep(n);
    setData(null);
    setError(null);
    if (n >= kinds.length) {
      app.logAttempt({ at: Date.now(), kind: 'toefl', title: `TOEFL ${SECTION_LABELS[section]} daily drill`, seconds: elapsed(), scores: {}, detail: { section, drill: true } });
      return;
    }
    try {
      const k = kinds[n];
      setData(await aiTask('toeflGen', { kind: k, difficulty, focusType: weak[0] && MCQ_KINDS.includes(k) ? weak[0] : undefined }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function done(o: TaskOutcome) {
    setResults((r) => [...r, o]);
    await record(kinds[step], o, 0);
  }

  if (step < 0) {
    return (
      <div className="stack">
        <h1>{SECTION_LABELS[section]}: daily drill</h1>
        <div className="card stack">
          <p style={{ margin: 0 }}>About 10 minutes, three short parts with feedback:</p>
          <ol className="small" style={{ margin: 0 }}>
            {kinds.map((k) => (
              <li key={k}>{KIND_LABEL[k]}</li>
            ))}
          </ol>
          {weak[0] && <div className="small muted">Questions lean toward your weakest type: {weak[0]}.</div>}
          {section === 'listening' && <ListenSettings />}
          <button className="btn primary big" onClick={() => go(0)}>
            <Icon name="bolt" /> Start the drill
          </button>
        </div>
      </div>
    );
  }
  if (step >= kinds.length) {
    const points = results.reduce((a, r) => a + (r.writing ? r.points * 2 : r.points), 0);
    const max = results.reduce((a, r) => a + (r.writing ? 10 : r.max), 0);
    return (
      <div className="stack">
        <h1>Drill done</h1>
        <div className="card stack">
          <span className={`chip ${points / max >= 0.8 ? 'good' : points / max >= 0.6 ? 'ok' : 'bad'}`} style={{ alignSelf: 'flex-start', fontSize: '1rem' }}>
            {Math.round((points / Math.max(1, max)) * 100)}% today
          </span>
          <div className="row">
            <a className="btn primary" href={href(`/toefl/${section}`)}>
              Back to {SECTION_LABELS[section]}
            </a>
            <a className="btn" href={href('/toefl/mistakes')}>
              Mistake log
            </a>
          </div>
        </div>
      </div>
    );
  }
  const answered = results.length > step;
  return (
    <div className="stack">
      <div className="small muted">
        Daily drill · part {step + 1} of {kinds.length}: {KIND_LABEL[kinds[step]]}
      </div>
      {error && (
        <div className="card stack">
          <div className="banner error">{error}</div>
          <button className="btn" onClick={() => go(step)}>
            Try again
          </button>
        </div>
      )}
      {!data && !error && <div className="card muted">Writing the next part…</div>}
      {data != null && (
        <div className="card" key={step}>
          <TaskView kind={kinds[step]} data={data} mode="practice" onSubmit={done} />
          {answered && (
            <button className="btn primary" onClick={() => go(step + 1)} style={{ marginTop: 14 }}>
              {step + 1 < kinds.length ? 'Next part' : 'Finish'} <Icon name="next" size={14} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
