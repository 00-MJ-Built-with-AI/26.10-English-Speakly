import { useEffect, useRef, useState } from 'react';
import type { OpinionResult } from '../../../shared/tasks.ts';
import { analyzeHesitation } from '../../engine/hesitation.ts';
import { workingLevel } from '../../engine/path.ts';
import { fluencyScore } from '../../engine/scoring.ts';
import { aiTask } from '../../lib/api.ts';
import { useApp } from '../../lib/store.tsx';
import type { Assessment } from '../../speech/index.ts';
import { HesitationChips } from '../components/Hesitation.tsx';
import { Icon } from '../components/Icon.tsx';
import { MicControl, PlayBlob, useElapsed, useListen, useSpeak } from '../components/speaking.tsx';

const QUESTIONS = [
  'Is it better to work from home or in an office?',
  'Should students be allowed to use AI tools for homework?',
  'Is it more important to have a job you love or a job that pays well?',
  'Do you prefer to learn alone or in a group? Why?',
  'Should companies let employees choose their own working hours?',
  'Is social media good or bad for young people?',
  'What is the most important skill for success at work?',
  'Should public transportation be free?',
  'Is it better to live in a big city or a small town?',
  'Should everyone learn a second language at school?',
  'Are meetings a good use of time?',
  'Is it a good idea to change jobs often early in your career?',
  'Should governments spend more on space exploration?',
  'Is it better to plan your weekend or decide on the day?',
  'Do online reviews help customers make better decisions?',
  'Should university education be free?',
  'Is it better to read the news every day or once a week?',
  'Should companies pay for their employees to learn languages?',
  'Do people work better under pressure?',
  'Is it important to have a five-year plan?',
];

const PARTS = [
  { key: 'point', label: 'Point', hint: 'In my opinion, ... / I strongly believe ...' },
  { key: 'reason', label: 'Reason', hint: 'The main reason is that ... / This is because ...' },
  { key: 'example', label: 'Example', hint: 'For example, ... / Last year, I ...' },
  { key: 'conclusion', label: 'Conclusion', hint: "So overall, ... / That's why I think ..." },
] as const;

const PREP = 15;
const ANSWER = 60;

/** TOEFL-style: a question, optional 15 s to think, 60 s to answer with a clear structure. */
export function Opinion() {
  const app = useApp();
  const mic = useListen();
  const { speak } = useSpeak();
  const elapsed = useElapsed();
  const [q, setQ] = useState(() => QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)]);
  const [prep, setPrep] = useState(true);
  const [phase, setPhase] = useState<'ready' | 'prep' | 'answer' | 'checking' | 'done'>('ready');
  const [left, setLeft] = useState(0);
  const [result, setResult] = useState<{ a: Assessment; r: OpinionResult } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  useEffect(() => () => clearInterval(timer.current), []);

  const countdown = (seconds: number) => {
    clearInterval(timer.current);
    const end = Date.now() + seconds * 1000;
    setLeft(seconds);
    timer.current = setInterval(() => setLeft(Math.max(0, Math.ceil((end - Date.now()) / 1000))), 250);
  };

  async function go() {
    setResult(null);
    setError(null);
    await speak(q);
    if (prep) {
      setPhase('prep');
      countdown(PREP);
      await new Promise((r) => setTimeout(r, PREP * 1000));
    }
    setPhase('answer');
    countdown(ANSWER);
    const a = await mic.listen({ maxSeconds: ANSWER, endSilenceMs: 6000, noSpeechMs: 15_000, record: true });
    clearInterval(timer.current);
    if (!a?.text.trim()) {
      setPhase('ready');
      return;
    }
    setPhase('checking');
    try {
      const r = await aiTask('opinion', { level: workingLevel(app.user), question: q, transcript: a.text, seconds: a.speechMs / 1000 });
      setResult({ a, r });
      const real = a.engine !== 'typed';
      await app.logAttempt({
        at: Date.now(),
        kind: 'opinion',
        title: `Opinion: ${q}`,
        seconds: elapsed(),
        hesitation: real ? analyzeHesitation(a) : undefined,
        scores: real ? { fluency: fluencyScore(a, true), pronunciation: a.pron } : {},
        detail: { band: r.band },
      });
      app.saveRecording(a.audio, { title: `Opinion: ${q}`, kind: 'opinion', seconds: Math.round(a.speechMs / 1000), text: a.text, score: r.band });
      await app.addMistakes(
        r.corrections.map((c) => ({ kind: c.kind, said: c.original, better: c.corrected, why: c.explanation })),
        '60-second opinion',
      );
      setPhase('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase('ready');
    }
  }

  return (
    <div className="stack">
      <div className="spread">
        <h1>60-second opinion</h1>
        {(phase === 'ready' || phase === 'done') && (
          <button className="btn small" onClick={() => (setQ(QUESTIONS.filter((x) => x !== q)[Math.floor(Math.random() * (QUESTIONS.length - 1))]), setPhase('ready'), setResult(null))}>
            <Icon name="refresh" size={16} /> Another question
          </button>
        )}
      </div>
      <div className="card stack">
        <div className="prompt-text">{q}</div>
        <div className="grid grid-4">
          {PARTS.map((p) => {
            const got = result?.r[p.key];
            return (
              <div key={p.key} className="soft small" style={got ? { borderColor: got.present ? 'var(--good)' : 'var(--bad)' } : undefined}>
                <div className="spread">
                  <b>{p.label}</b>
                  {got && <span className={`chip ${got.present ? 'good' : 'bad'}`}>{got.present ? 'yes' : 'missing'}</span>}
                </div>
                <div className="muted">{got?.quote ? `“${got.quote}”` : p.hint}</div>
              </div>
            );
          })}
        </div>
        {phase === 'ready' && (
          <div className="row">
            <button className="btn primary big" onClick={go}>
              <Icon name="mic" /> Start
            </button>
            <label className="row small">
              <input type="checkbox" checked={prep} onChange={(e) => setPrep(e.target.checked)} /> {PREP} seconds to think first
            </label>
          </div>
        )}
        {phase === 'prep' && (
          <div style={{ textAlign: 'center' }}>
            <div className="small muted">Think: your point, one reason, one example.</div>
            <div className="countdown">{left}</div>
          </div>
        )}
        {phase === 'answer' && (
          <div className="stack" style={{ textAlign: 'center' }}>
            <span className={`chip ${left > 10 ? 'brand' : 'bad'}`} style={{ alignSelf: 'center', fontSize: '1rem' }}>
              {left} s
            </span>
            <MicControl {...mic} onStart={() => {}} onStop={mic.stop} onTyped={mic.submitTyped} hint="Speak; tap to finish early" />
          </div>
        )}
        {phase === 'checking' && <div className="muted">Checking your answer…</div>}
        {error && <div className="banner error">{error}</div>}
      </div>
      {result && (
        <div className="stack fade-in">
          <div className="card stack">
            <div className="spread">
              <h3 style={{ margin: 0 }}>Your answer</h3>
              <span className="chip brand">Band {result.r.band.toFixed(1)}</span>
            </div>
            <div className="soft">“{result.a.text}”</div>
            {result.a.engine !== 'typed' && (
              <>
                <HesitationChips h={analyzeHesitation(result.a)} />
                <PlayBlob blob={result.a.audio} />
              </>
            )}
            <p>{result.r.feedback}</p>
            {result.r.corrections.map((c, k) => (
              <div key={k} className="small">
                <s className="muted">{c.original}</s> → <b>{c.corrected}</b> <span className="muted">{c.explanation}</span>
              </div>
            ))}
          </div>
          <div className="card stack">
            <div className="spread">
              <h3 style={{ margin: 0 }}>A model answer</h3>
              <button className="btn small" onClick={() => speak(result.r.betterAnswer)}>
                <Icon name="volume" size={16} /> Listen
              </button>
            </div>
            <p>{result.r.betterAnswer}</p>
          </div>
          <button className="btn primary" style={{ alignSelf: 'flex-start' }} onClick={() => (setPhase('ready'), setResult(null))}>
            Try this question again
          </button>
        </div>
      )}
    </div>
  );
}
