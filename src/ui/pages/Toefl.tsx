import { useEffect, useMemo, useRef, useState } from 'react';
import type { ToeflResult } from '../../../shared/tasks.ts';
import { combineBands, INTERVIEW_SECONDS, INTERVIEW_SETS, REPEAT_SECONDS, REPEAT_SETS, repeatBand, type InterviewSet, type RepeatSet } from '../../content/toefl.ts';
import { fluencyScore } from '../../engine/scoring.ts';
import { analyzeHesitation, combineHesitation } from '../../engine/hesitation.ts';
import { wordAccuracy } from '../../engine/text.ts';
import { aiTask } from '../../lib/api.ts';
import { go, href } from '../../lib/router.ts';
import { useApp } from '../../lib/store.tsx';
import type { Attempt } from '../../lib/types.ts';
import type { Assessment } from '../../speech/index.ts';
import { Icon } from '../components/Icon.tsx';
import { ExamCard } from '../components/ExamCard.tsx';
import { analyzeBands, gapSummary, weakTypes } from '../../engine/toeflPlan.ts';
import { MONDAY, ReadinessCard, TodayPlan } from '../toefl/Extras.tsx';
import { skillBand } from '../../engine/toeflSkill.ts';
import { SECTION_LABELS, SECTIONS, type Section } from '../../engine/toeflScale.ts';
import { addSoundSamples, soundSamples } from '../../engine/toeflExtras.ts';
import { MicControl, PlayBlob, ScoreChips, useElapsed, useListen, useSpeak, WordScores } from '../components/speaking.tsx';

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
const bandText = (b: number | null) => (b == null ? '–' : b.toFixed(1));

/** TOEFL overview: band per skill vs the goal, today's plan, the full mock and score tools. */
export function ToeflHub() {
  const { user, repo } = useApp();
  const [history, setHistory] = useState<Attempt[]>([]);
  useEffect(() => {
    repo.list<Attempt>('attempts', { limit: 500 }).then((a) => setHistory(a.filter((x) => x.kind === 'toefl')));
  }, [repo]);
  const t = user.toefl;
  const est = Object.fromEntries(SECTIONS.map((s) => [s, skillBand(t, s, user.toeflBand)])) as Record<Section, ReturnType<typeof skillBand>>;
  const known = SECTIONS.filter((s) => est[s]);
  // Unknown skills count as band 4 for planning until there is data.
  const bands = Object.fromEntries(SECTIONS.map((s) => [s, est[s]?.band ?? 4])) as Record<Section, number>;
  const gap = analyzeBands(bands, t.target, t.minimum);
  const weak = weakTypes(t.typeStats);
  const { update } = useApp();
  return (
    <div className="stack">
      <h1>TOEFL iBT (2026 format)</h1>
      <div className="card stack">
        <div className="spread">
          <h3 style={{ margin: 0 }}>Goal: band {t.target.toFixed(1)}</h3>
          <a className="small" href={href('/toefl/scores')}>
            Scores and goal
          </a>
        </div>
        <div className="grid grid-4">
          {SECTIONS.map((s) => {
            const b = est[s]?.band;
            const g = b != null ? Math.max(0, t.target - b) : null;
            return (
              <a key={s} className="soft" href={href(`/toefl/${s}`)} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div className="small muted">{SECTION_LABELS[s]}</div>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: g === 0 ? 'var(--good)' : 'var(--brand)' }}>{b != null ? b.toFixed(1) : '–'}</div>
                <div className="small muted">{g == null ? 'no data yet' : g ? `+${g.toFixed(1)} to go` : 'at target'}</div>
              </a>
            );
          })}
        </div>
        <p className="small" style={{ margin: 0 }}>
          {known.length === 4
            ? gapSummary(gap)
            : `Minimum ${t.minimum.toFixed(1)}, target ${t.target.toFixed(1)} in every section. Add your score report, or take a section test or the full mock, to fill in the missing skills.`}
        </p>
      </div>
      {t.pendingMock && (
        <div className="banner info">
          A mock test is waiting for its Speaking part. <a href={href('/toefl/full-mock?finish=1')}>Finish it</a>
        </div>
      )}
      {MONDAY() && (
        <div className="banner info">
          It's Monday: your <a href={href('/toefl/weekly')}>weekly TOEFL report</a> is ready.
        </div>
      )}
      <TodayPlan />
      <ReadinessCard />
      <ExamCard history={history} />
      <div className="grid grid-2">
        <button className="btn primary big" onClick={() => go('/toefl/full-mock')}>
          <Icon name="trophy" /> Full mock test (about 75 min)
        </button>
        <a className="btn big" href={href('/toefl/mistakes')}>
          <Icon name="chart" /> Mistake log{weak.length ? ` (weakest: ${weak[0]})` : ''}
        </a>
      </div>
      <div className="grid grid-3">
        <a className="list-item" href={href('/toefl/review')} style={{ marginTop: 0 }}>
          <span className="grow">
            <b>Wrong-answer review</b>
            <div className="small muted">{t.review.filter((r) => r.due <= Date.now()).length} due · {t.review.length} in review</div>
          </span>
        </a>
        <a className="list-item" href={href('/toefl/weekly')} style={{ marginTop: 0 }}>
          <span className="grow">
            <b>Weekly report</b>
            <div className="small muted">Bands, minutes, weak types, next focus</div>
          </span>
        </a>
        <a className="list-item" href={href('/toefl/bank')} style={{ marginTop: 0 }}>
          <span className="grow">
            <b>Question bank and offline packs</b>
            <div className="small muted">Instant sets, practice without internet</div>
          </span>
        </a>
        <a className="list-item" href={href('/kaust')} style={{ marginTop: 0 }}>
          <span className="grow">
            <b>KAUST application coach</b>
            <div className="small muted">Statement, faculty emails, interview, research pitch</div>
          </span>
        </a>
        <a className="list-item" href={href('/toefl/exam-day')} style={{ marginTop: 0 }}>
          <span className="grow">
            <b>Exam-day checklist</b>
            <div className="small muted">{user.settings.examDate ? `Exam ${user.settings.examDate}` : 'Countdown and what to prepare'}</div>
          </span>
        </a>
      </div>
      <label className="card row small" style={{ flexWrap: 'nowrap' }}>
        <input type="checkbox" checked={t.arabic} onChange={(e) => update((u) => (u.toefl.arabic = e.target.checked))} />
        <span>
          <b>Arabic explanations</b> — add a short Arabic explanation under every question you miss (uses a little AI each time).
        </span>
      </label>
      {history.length > 0 && (
        <div className="card">
          <h3>Recent results</h3>
          {history.slice(0, 10).map((h, k) => {
            const d = h.detail as { band?: number; overall?: number; points?: number; max?: number } | undefined;
            const v = d?.band ?? d?.overall;
            return (
              <div key={k} className="spread" style={{ padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
                <span>{h.title}</span>
                <span className="row">
                  <span className="small muted">{new Date(h.at).toLocaleDateString()}</span>
                  <span className="chip brand">{v != null ? bandText(v) : d?.max ? `${Number(d.points).toFixed(d.max === 5 ? 1 : 0)}/${d.max}` : '–'}</span>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function useCountdown(running: boolean, seconds: number, key: unknown) {
  const [left, setLeft] = useState(seconds);
  const start = useRef(0);
  useEffect(() => {
    setLeft(seconds);
    if (!running) return;
    start.current = performance.now();
    const t = setInterval(() => setLeft(Math.max(0, seconds - (performance.now() - start.current) / 1000)), 200);
    return () => clearInterval(t);
  }, [running, seconds, key]);
  return left;
}

export function ToeflRepeat({ mock }: { mock: boolean }) {
  const app = useApp();
  const mic = useListen();
  const { speak, speaking } = useSpeak();
  const elapsed = useElapsed();
  const [set, setSet] = useState<RepeatSet>(() => pick(REPEAT_SETS));
  const [i, setI] = useState(-1);
  const [results, setResults] = useState<(Assessment | null)[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const acc = useRef<(Assessment | null)[]>([]);
  const s = set.sentences[i];
  const left = useCountdown(mic.state === 'listening', s ? REPEAT_SECONDS(s) : 10, i);

  async function newSet() {
    setLoading(true);
    setError(null);
    try {
      const r = (await aiTask('generate', { kind: 'toefl-repeat', level: 'B2' })) as { topic: string; sentences: string[] };
      setSet({ id: `ai-${Date.now()}`, topic: r.topic, sentences: r.sentences.slice(0, 7) });
      setI(-1);
      setResults([]);
      acc.current = [];
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function item(n: number) {
    setI(n);
    const sentence = set.sentences[n];
    await speak(sentence, 1);
    const a = await mic.listen({ reference: sentence, maxSeconds: REPEAT_SECONDS(sentence), endSilenceMs: 1500, noSpeechMs: REPEAT_SECONDS(sentence) * 1000, record: true });
    acc.current[n] = a;
    setResults([...acc.current]);
    if (a?.engine === 'azure') app.update((u) => addSoundSamples(u.toefl.sounds, soundSamples(a)));
    if (mock) {
      if (n + 1 < set.sentences.length) item(n + 1);
      else finishSet(acc.current);
    }
  }

  const bands = useMemo(() => set.sentences.map((sent, k) => (results[k] ? repeatBand(wordAccuracy(sent, results[k]!.text), results[k]!.pron) : null)), [results, set]);

  async function finishSet(rs = results) {
    const b = set.sentences.map((sent, k) => (rs[k] ? repeatBand(wordAccuracy(sent, rs[k]!.text), rs[k]!.pron) : 1));
    const band = Math.round(avg(b) * 2) / 2;
    const real = rs.filter((a): a is Assessment => Boolean(a && a.engine !== 'typed'));
    if (mock) {
      go(`/toefl/mock-interview?rb=${band}`);
      return;
    }
    await app.logAttempt({
      at: Date.now(),
      kind: 'toefl',
      title: `Listen and Repeat: ${set.topic}`,
      seconds: elapsed(),
      scores: real.length ? { pronunciation: avg(real.map((a) => a.pron)) } : {},
      detail: { band, task: 'repeat' },
    });
    setDone(true);
  }

  if (i < 0) {
    return (
      <div className="stack">
        <a className="small" href={href('/toefl')}>
          ← TOEFL
        </a>
        <h1>{mock ? 'Mock test, part 1: Listen and Repeat' : 'Listen and Repeat'}</h1>
        <div className="card stack">
          <p>
            Topic: <b>{set.topic}</b>. You will hear 7 sentences, one at a time{mock ? ', only once' : ''}. Repeat each sentence exactly as you heard it. The microphone opens automatically.
          </p>
          {error && <div className="banner error">{error}</div>}
          <div className="row">
            <button className="btn primary big" onClick={() => item(0)}>
              Start
            </button>
            {!mock && (
              <button className="btn" onClick={newSet} disabled={loading}>
                <Icon name="refresh" size={16} /> {loading ? 'Making…' : 'New set'}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="stack">
        <h1>Listen and Repeat: {bandText(Math.round(avg(bands.map((b) => b ?? 1)) * 2) / 2)} / 6</h1>
        {set.sentences.map((sent, k) => (
          <div key={k} className="card stack">
            <div className="spread">
              <span className="small muted">{k + 1}</span>
              <span className="chip brand">{bandText(bands[k])}</span>
            </div>
            {results[k] ? <WordScores a={results[k]!} /> : <p>{sent}</p>}
            <div className="row">
              <PlayBlob blob={results[k]?.audio} />
              <button className="btn small" onClick={() => speak(sent)}>
                <Icon name="volume" size={14} /> Model
              </button>
            </div>
          </div>
        ))}
        <div className="row">
          <button className="btn primary" onClick={() => location.reload()}>
            Another set
          </button>
          <a className="btn" href={href('/toefl')}>
            TOEFL home
          </a>
        </div>
      </div>
    );
  }

  const r = results[i];
  return (
    <div className="stack">
      <div className="spread">
        <span className="small muted">
          Sentence {i + 1} of 7 · {set.topic}
        </span>
        {mic.state === 'listening' && <span className="chip bad">{Math.ceil(left)} s</span>}
      </div>
      <div className="card stack" style={{ textAlign: 'center' }}>
        {speaking ? (
          <div className="stack">
            <Icon name="volume" size={48} />
            <div className="muted">Listen…</div>
          </div>
        ) : mic.state === 'listening' ? (
          <div className="stack">
            <div className="prompt-text">Repeat now</div>
            <div className="partial">{mic.partial}</div>
          </div>
        ) : r !== undefined && !mock ? (
          <div className="stack" style={{ textAlign: 'left' }}>
            {r ? <WordScores a={r} /> : <p>{s}</p>}
            {r && <ScoreChips a={r} showFluency={false} />}
            <div className="row">
              <button className="btn small" onClick={() => speak(s)}>
                <Icon name="volume" size={14} /> Hear again
              </button>
              <button className="btn small" onClick={() => item(i)}>
                <Icon name="refresh" size={14} /> Retry
              </button>
              {i + 1 < 7 ? (
                <button className="btn primary" onClick={() => item(i + 1)}>
                  Next <Icon name="next" size={16} />
                </button>
              ) : (
                <button className="btn primary" onClick={() => finishSet()}>
                  See results
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="muted">…</div>
        )}
        {mic.error && <div className="banner error">{mic.error}</div>}
        {mic.state === 'listening' && !mic.canListen && <MicControl {...mic} onStart={() => {}} onStop={mic.stop} onTyped={mic.submitTyped} canListen={false} />}
      </div>
    </div>
  );
}

export function ToeflInterview({ mock }: { mock: boolean }) {
  const app = useApp();
  const mic = useListen();
  const { speak, speaking } = useSpeak();
  const elapsed = useElapsed();
  const repeatB = useMemo(() => {
    const v = new URLSearchParams(location.hash.split('?')[1] ?? '').get('rb');
    return v ? Number(v) : null;
  }, []);
  const [set, setSet] = useState<InterviewSet>(() => pick(INTERVIEW_SETS));
  const [i, setI] = useState(-1);
  const [answers, setAnswers] = useState<(Assessment | null)[]>([]);
  const [scores, setScores] = useState<(ToeflResult | null)[]>([]);
  const [showText, setShowText] = useState(!mock);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const left = useCountdown(mic.state === 'listening', INTERVIEW_SECONDS, i);
  const pending = useRef<Promise<unknown>[]>([]);
  const logged = useRef(false);

  async function newSet() {
    setLoading(true);
    setError(null);
    try {
      const r = (await aiTask('generate', { kind: 'toefl-interview', level: 'B2' })) as { topic: string; intro: string; questions: string[] };
      setSet({ id: `ai-${Date.now()}`, topic: r.topic, intro: r.intro, questions: r.questions.slice(0, 4) });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function ask(n: number) {
    setI(n);
    if (n === 0) await speak(set.intro);
    await speak(set.questions[n]);
    const a = await mic.listen({ maxSeconds: INTERVIEW_SECONDS, endSilenceMs: 7000, noSpeechMs: 15_000, record: true });
    setAnswers((x) => {
      const y = [...x];
      y[n] = a;
      return y;
    });
    const p = a
      ? aiTask('toefl', {
          question: set.questions[n],
          transcript: a.text,
          seconds: a.speechMs / 1000,
          pronunciation: a.engine !== 'typed' ? a.pron : undefined,
          fluency: a.engine !== 'typed' ? fluencyScore(a, true) : undefined,
        })
          .then((r) =>
            setScores((x) => {
              const y = [...x];
              y[n] = r;
              return y;
            }),
          )
          .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      : Promise.resolve();
    pending.current.push(p);
    if (mock && n + 1 < set.questions.length) ask(n + 1);
  }

  async function finish() {
    setFinished(true);
    await Promise.all(pending.current);
  }

  useEffect(() => {
    if (!finished || logged.current || scores.filter(Boolean).length < answers.filter(Boolean).length) return;
    logged.current = true;
    const bands = scores.filter((s): s is ToeflResult => Boolean(s)).map((s) => s.band);
    const overall = combineBands(repeatB, bands);
    const real = answers.filter((a): a is Assessment => Boolean(a && a.engine !== 'typed'));
    (async () => {
      await app.logAttempt({
        at: Date.now(),
        kind: 'toefl',
        title: mock ? `Mock test: ${set.topic}` : `Take an Interview: ${set.topic}`,
        seconds: elapsed(),
        hesitation: combineHesitation(real.map(analyzeHesitation)),
        scores: real.length ? { pronunciation: avg(real.map((a) => a.pron)), fluency: avg(real.map((a) => fluencyScore(a, true))) } : {},
        detail: { band: overall, repeat: repeatB, interview: bands },
      });
      if (overall != null)
        app.update((u) => {
          u.toeflBand = u.toeflBand == null ? overall : Math.round((u.toeflBand * 0.6 + overall * 0.4) * 2) / 2;
          // Part of a full mock: hand the speaking band back to it.
          if (mock && u.toefl.pendingMock) u.toefl.pendingMock.speakingBand = overall;
          if (mock) u.toefl.sectionTests = [...u.toefl.sectionTests, { at: Date.now(), section: 'speaking' as const, band: overall }].slice(-100);
        });
      await app.addMistakes(
        scores.flatMap((s) => s?.corrections ?? []).map((c) => ({ kind: c.kind, said: c.original, better: c.corrected, why: c.explanation })),
        'TOEFL interview',
      );
      answers.forEach((a, k) => a && app.saveRecording(a.audio, { title: `TOEFL: ${set.questions[k]}`, kind: 'toefl', seconds: Math.round(a.speechMs / 1000), text: a.text, score: scores[k]?.band }));
    })();
  }, [finished, scores]); // runs once every answer has a score

  if (i < 0) {
    return (
      <div className="stack">
        <a className="small" href={href('/toefl')}>
          ← TOEFL
        </a>
        <h1>{mock ? 'Mock test, part 2: Take an Interview' : 'Take an Interview'}</h1>
        {mock && repeatB != null && <div className="banner info">Part 1 done: Listen and Repeat {bandText(repeatB)} / 6.</div>}
        <div className="card stack">
          <p>
            Topic: <b>{set.topic}</b>. An interviewer asks 4 questions. Answer each one right away; you have 45 seconds. Aim for a direct answer, a reason, and an example.
          </p>
          <label className="row small">
            <input type="checkbox" checked={showText} onChange={(e) => setShowText(e.target.checked)} /> Show questions as text
          </label>
          {error && <div className="banner error">{error}</div>}
          <div className="row">
            <button className="btn primary big" onClick={() => ask(0)}>
              Start
            </button>
            {!mock && (
              <button className="btn" onClick={newSet} disabled={loading}>
                <Icon name="refresh" size={16} /> {loading ? 'Making…' : 'New topic'}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (finished) {
    const bands = scores.filter((s): s is ToeflResult => Boolean(s)).map((s) => s.band);
    const waiting = scores.filter(Boolean).length < answers.filter(Boolean).length;
    const overall = combineBands(repeatB, bands);
    return (
      <div className="stack">
        <h1>{waiting ? 'Scoring your answers…' : `Speaking estimate: ${bandText(overall)} / 6`}</h1>
        {repeatB != null && <div className="card spread"><span>Listen and Repeat</span><span className="chip brand">{bandText(repeatB)}</span></div>}
        {set.questions.map((q, k) => {
          const s = scores[k];
          const a = answers[k];
          return (
            <div key={k} className="card stack">
              <div className="spread">
                <b>{q}</b>
                {s && <span className="chip brand">{bandText(s.band)}</span>}
              </div>
              {a && <div className="soft small">“{a.text || '(nothing heard)'}”</div>}
              {s && (
                <div className="small stack">
                  <div>
                    <b>Delivery:</b> {s.delivery}
                  </div>
                  <div>
                    <b>Language use:</b> {s.languageUse}
                  </div>
                  <div>
                    <b>Topic development:</b> {s.topicDevelopment}
                  </div>
                  <div className="banner info">{s.tip}</div>
                </div>
              )}
              {a && <PlayBlob blob={a.audio} />}
            </div>
          );
        })}
        <div className="row">
          {mock && app.user.toefl.pendingMock?.speakingBand != null && (
            <button className="btn primary" onClick={() => go('/toefl/full-mock?finish=1')}>
              <Icon name="trophy" size={16} /> See your full mock result
            </button>
          )}
          <a className={`btn ${mock && app.user.toefl.pendingMock ? '' : 'primary'}`} href={href('/toefl')}>
            TOEFL home
          </a>
        </div>
      </div>
    );
  }

  const answered = answers[i] !== undefined;
  return (
    <div className="stack">
      <div className="spread">
        <span className="small muted">
          Question {i + 1} of 4 · {set.topic}
        </span>
        {mic.state === 'listening' && <span className={`chip ${left > 10 ? 'brand' : 'bad'}`}>{Math.ceil(left)} s</span>}
      </div>
      <div className="card stack" style={{ textAlign: 'center' }}>
        {speaking ? (
          <div className="stack">
            <Icon name="volume" size={48} />
            <div className="muted">The interviewer is speaking…</div>
          </div>
        ) : null}
        {(showText || answered) && <div className="prompt-text">{set.questions[i]}</div>}
        {mic.state === 'listening' && (
          <div className="stack">
            <span className="status-pill" style={{ alignSelf: 'center' }}>
              <span className="dot live" /> Answer now
            </span>
            <div className="partial">{mic.partial}</div>
            <button className="btn small" onClick={mic.stop} style={{ alignSelf: 'center' }}>
              I'm done
            </button>
            {!mic.canListen && <MicControl {...mic} onStart={() => {}} onStop={mic.stop} onTyped={mic.submitTyped} canListen={false} />}
          </div>
        )}
        {answered && mic.state === 'idle' && !mock && (
          <div className="row" style={{ justifyContent: 'center' }}>
            {i + 1 < 4 ? (
              <button className="btn primary" onClick={() => ask(i + 1)}>
                Next question <Icon name="next" size={16} />
              </button>
            ) : (
              <button className="btn primary" onClick={finish}>
                See results
              </button>
            )}
          </div>
        )}
        {answered && mic.state === 'idle' && mock && i + 1 >= 4 && (
          <button className="btn primary" onClick={finish} style={{ alignSelf: 'center' }}>
            See results
          </button>
        )}
        {error && <div className="banner error">{error}</div>}
      </div>
    </div>
  );
}
