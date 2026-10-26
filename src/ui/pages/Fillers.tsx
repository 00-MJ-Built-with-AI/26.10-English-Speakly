import { useEffect, useMemo, useState } from 'react';
import { UNITS } from '../../content/units.ts';
import { analyzeHesitation, combineHesitation, TIME_BUYERS, type HesitationStats } from '../../engine/hesitation.ts';
import { workingLevel } from '../../engine/path.ts';
import { dateKey } from '../../engine/progress.ts';
import { fluencyScore, levelIndex } from '../../engine/scoring.ts';
import { useApp } from '../../lib/store.tsx';
import type { Attempt } from '../../lib/types.ts';
import type { Assessment } from '../../speech/index.ts';
import { HesitationChips } from '../components/Hesitation.tsx';
import { Icon } from '../components/Icon.tsx';
import { MicControl, ScoreChips, useElapsed, useListen, useSpeak } from '../components/speaking.tsx';

/** Hesitation trends, natural time-buying phrases, and a no-freeze answer drill. */
export function Fillers() {
  const app = useApp();
  const level = workingLevel(app.user);
  const [history, setHistory] = useState<Attempt[]>([]);
  useEffect(() => {
    app.repo.list<Attempt>('attempts', { since: Date.now() - 60 * 86_400_000 }).then((a) => setHistory(a.filter((x) => x.hesitation)));
  }, [app.repo]);

  const recent = combineHesitation(history.filter((a) => a.at > Date.now() - 7 * 86_400_000).map((a) => a.hesitation!));
  const before = combineHesitation(history.filter((a) => a.at <= Date.now() - 7 * 86_400_000).map((a) => a.hesitation!));
  const phrases = TIME_BUYERS.filter((p) => levelIndex(p.level) <= Math.max(1, levelIndex(level) + 1));

  return (
    <div className="stack">
      <h1>Fillers and pauses</h1>
      <p className="muted">How often you freeze, say "um", or restart a sentence, measured in every conversation, journal entry and open answer.</p>
      <div className="card stack">
        <h3>Last 7 days</h3>
        {recent ? (
          <>
            <HesitationChips h={recent} />
            {before && (
              <p className="small muted">
                Before that: {before.perMinute} hesitations/min, start {(before.startDelayMs / 1000).toFixed(1)} s.{' '}
                {recent.perMinute < before.perMinute ? 'You are getting smoother.' : recent.perMinute > before.perMinute ? 'A bit more hesitant this week; keep practising.' : ''}
              </p>
            )}
            <Trend history={history} />
          </>
        ) : (
          <p className="small muted">No measurements yet. Talk with the tutor, write a journal entry or do a unit check by voice.</p>
        )}
        <p className="small faint">Note: speech recognition often drops "um" and "uh" from the text, so pauses and restarts are the most reliable signs here.</p>
      </div>
      <TimeBuyers phrases={phrases.map((p) => p.phrase)} />
      <NoFreezeDrill />
    </div>
  );
}

function Trend({ history }: { history: Attempt[] }) {
  const pts = useMemo(() => {
    const byDay = new Map<string, HesitationStats[]>();
    for (const a of history) byDay.set(dateKey(a.at), [...(byDay.get(dateKey(a.at)) ?? []), a.hesitation!]);
    return [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, l]) => ({ day, h: combineHesitation(l)! }));
  }, [history]);
  if (pts.length < 2) return null;
  const W = 600;
  const H = 140;
  const max = Math.max(6, ...pts.map((p) => p.h.perMinute));
  const x = (i: number) => 24 + (i / (pts.length - 1)) * (W - 48);
  const y = (v: number) => H - 20 - (v / max) * (H - 40);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }} role="img" aria-label="Hesitations per minute by day">
      <line x1={24} x2={W - 24} y1={H - 20} y2={H - 20} stroke="var(--line)" />
      <polyline fill="none" stroke="var(--flu)" strokeWidth="2.5" points={pts.map((p, i) => `${x(i)},${y(p.h.perMinute)}`).join(' ')} />
      {pts.map((p, i) => (
        <circle key={p.day} cx={x(i)} cy={y(p.h.perMinute)} r="3" fill="var(--flu)">
          <title>
            {p.day}: {p.h.perMinute}/min
          </title>
        </circle>
      ))}
      <text x={24} y={12} fontSize="11" fill="var(--faint)">
        hesitations per minute (lower is better)
      </text>
    </svg>
  );
}

function TimeBuyers({ phrases }: { phrases: string[] }) {
  const mic = useListen();
  const { speak } = useSpeak();
  const [active, setActive] = useState<string | null>(null);
  const [res, setRes] = useState<Record<string, Assessment>>({});
  return (
    <div className="card stack">
      <h3>Buy time like a native speaker</h3>
      <p className="small muted">Instead of "uhh..." or silence, use one of these while you think. Say each one until it feels automatic.</p>
      {phrases.map((p) => (
        <div key={p} className="soft">
          <div className="spread">
            <b>{p}</b>
            <div className="row">
              <button className="btn small" onClick={() => speak(p)}>
                <Icon name="volume" size={16} />
              </button>
              <button
                className="btn small primary"
                disabled={mic.state !== 'idle'}
                onClick={async () => {
                  setActive(p);
                  const a = await mic.listen({ reference: p.replace(/\.\.\./g, ''), maxSeconds: 10, endSilenceMs: 1000, noSpeechMs: 6000 });
                  setActive(null);
                  if (a) setRes((r) => ({ ...r, [p]: a }));
                }}
              >
                <Icon name="mic" size={16} />
              </button>
            </div>
          </div>
          {active === p && <MicControl {...mic} onStart={() => {}} onStop={mic.stop} onTyped={mic.submitTyped} />}
          {res[p] && <ScoreChips a={res[p]} />}
        </div>
      ))}
    </div>
  );
}

/** Tough questions answered at once; the clock starts when the question appears. */
function NoFreezeDrill() {
  const app = useApp();
  const level = workingLevel(app.user);
  const mic = useListen();
  const elapsed = useElapsed();
  const questions = useMemo(() => {
    const pool = UNITS.filter((u) => Math.abs(levelIndex(u.level) - levelIndex(level)) <= 1).map((u) => u.question);
    return [...pool].sort(() => Math.random() - 0.5).slice(0, 4);
  }, [level]);
  const [i, setI] = useState(-1);
  const [answers, setAnswers] = useState<{ a: Assessment; h: HesitationStats }[]>([]);
  const [saved, setSaved] = useState(false);

  async function ask(n: number) {
    setI(n);
    const a = await mic.listen({ maxSeconds: 45, endSilenceMs: 3000, noSpeechMs: 12_000 });
    if (a && a.engine !== 'typed') setAnswers((x) => [...x, { a, h: analyzeHesitation(a) }]);
    else if (a) setAnswers((x) => [...x, { a, h: analyzeHesitation({ ...a, speechMs: 0 }) }]);
  }

  async function save() {
    const real = answers.filter((x) => x.a.engine !== 'typed');
    const h = combineHesitation(real.map((x) => x.h));
    await app.logAttempt({
      at: Date.now(),
      kind: 'fillers',
      title: 'No-freeze drill',
      seconds: elapsed(),
      scores: real.length ? { fluency: real.reduce((s, x) => s + fluencyScore(x.a, true), 0) / real.length } : {},
      hesitation: h,
    });
    setSaved(true);
  }

  const last = answers[i];
  return (
    <div className="card stack">
      <h3>No-freeze drill</h3>
      <p className="small muted">4 questions. Start talking within 2 seconds, use a time-buying phrase if you need to, and keep going for 30 seconds without long pauses.</p>
      {i < 0 ? (
        <button className="btn primary" onClick={() => ask(0)} style={{ alignSelf: 'flex-start' }}>
          Start drill
        </button>
      ) : (
        <>
          <div className="small muted">Question {i + 1} of {questions.length}</div>
          <div className="prompt-text">{questions[i]}</div>
          {mic.state !== 'idle' && <MicControl {...mic} onStart={() => {}} onStop={mic.stop} onTyped={mic.submitTyped} />}
          {last && mic.state === 'idle' && (
            <div className="stack fade-in">
              <div className="soft small">“{last.a.text || '(nothing heard)'}”</div>
              {last.a.engine !== 'typed' ? <HesitationChips h={last.h} /> : <div className="small muted">Typed answer: hesitation can't be measured.</div>}
              {i + 1 < questions.length ? (
                <button className="btn primary" onClick={() => ask(i + 1)} style={{ alignSelf: 'flex-start' }}>
                  Next question <Icon name="next" size={16} />
                </button>
              ) : (
                <button className="btn primary" onClick={save} disabled={saved} style={{ alignSelf: 'flex-start' }}>
                  {saved ? 'Saved' : 'Finish'}
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
