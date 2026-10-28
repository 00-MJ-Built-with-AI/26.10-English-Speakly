import { useState } from 'react';
import { soundById } from '../../content/sounds.ts';
import { TWISTER_SPEEDS, TWISTERS, type Twister } from '../../content/twisters.ts';
import { countWords } from '../../engine/text.ts';
import { useApp } from '../../lib/store.tsx';
import type { Assessment } from '../../speech/index.ts';
import { Icon } from '../components/Icon.tsx';
import { MicControl, ScoreChips, useElapsed, useListen, useSpeak, WordScores } from '../components/speaking.tsx';

/** Tongue twisters for your weakest sounds: clean at slow speed first, then faster. */
export function Twisters() {
  const app = useApp();
  const { user } = app;
  const mic = useListen();
  const { speak } = useSpeak();
  const elapsed = useElapsed();
  const ranked = [...TWISTERS].sort((a, b) => (user.sounds[a.sound] ?? 100) - (user.sounds[b.sound] ?? 100));
  const [t, setT] = useState<Twister>(ranked[0]);
  const [speed, setSpeed] = useState(0);
  const [res, setRes] = useState<{ a: Assessment; wpm: number; pass: boolean } | null>(null);
  const goal = TWISTER_SPEEDS[speed];

  async function attempt() {
    setRes(null);
    const a = await mic.listen({ reference: t.text, maxSeconds: 20, endSilenceMs: 1200, noSpeechMs: 8000 });
    if (!a) return;
    const typed = a.engine === 'typed';
    const wpm = a.speechMs > 0 ? Math.round(countWords(t.text) / (a.speechMs / 60000)) : 0;
    const pass = !typed && a.accuracy >= 80 && a.completeness >= 90 && wpm >= goal.wpm * 0.9;
    setRes({ a, wpm, pass });
    if (!typed) {
      app.update((u) => {
        const best = u.twisters[t.id];
        if (!best || a.accuracy > best.accuracy || (a.accuracy >= best.accuracy - 2 && wpm > best.wpm)) u.twisters[t.id] = { accuracy: Math.round(a.accuracy), wpm };
      });
      await app.logAttempt({ at: Date.now(), kind: 'twister', title: `Tongue twister: ${t.text.slice(0, 40)}…`, seconds: elapsed(), scores: { pronunciation: a.pron }, detail: { speed: goal.label, wpm } }, { skillWeight: 0.1 });
    }
  }

  return (
    <div className="stack">
      <h1>Tongue twisters</h1>
      <p className="muted">Say it cleanly at slow speed first, then speed up. The ones for your weakest sounds are at the top.</p>
      <div className="card stack">
        <div className="row">
          <span className="chip">{soundById(t.sound)?.title}</span>
          {user.twisters[t.id] && (
            <span className="chip good">
              Best: {user.twisters[t.id].accuracy} accuracy · {user.twisters[t.id].wpm} wpm
            </span>
          )}
        </div>
        {res ? <WordScores a={res.a} /> : <div className="prompt-text">{t.text}</div>}
        <div className="row">
          {TWISTER_SPEEDS.map((s, k) => (
            <button key={s.label} className={`btn small ${speed === k ? 'primary' : ''}`} onClick={() => (setSpeed(k), setRes(null))}>
              {s.label} ({s.wpm} wpm)
            </button>
          ))}
          <button className="btn small" onClick={() => speak(t.text, goal.rate)}>
            <Icon name="volume" size={16} /> Hear it {goal.label.toLowerCase()}
          </button>
        </div>
        {res && (
          <div className="stack fade-in">
            <ScoreChips a={res.a} showFluency={false} />
            {res.a.engine !== 'typed' && (
              <div className={`banner ${res.pass ? 'info' : ''}`}>
                {res.pass
                  ? speed < TWISTER_SPEEDS.length - 1
                    ? `Clean at ${goal.label.toLowerCase()} speed (${res.wpm} wpm). Try the next speed!`
                    : `Clean and fast (${res.wpm} wpm). Excellent!`
                  : res.a.accuracy < 80
                    ? 'Slow down and get every sound clean first.'
                    : `Clean, but ${res.wpm} wpm. Aim for about ${goal.wpm}.`}
              </div>
            )}
            {res.pass && speed < TWISTER_SPEEDS.length - 1 && (
              <button className="btn primary small" style={{ alignSelf: 'flex-start' }} onClick={() => (setSpeed(speed + 1), setRes(null))}>
                Next speed <Icon name="next" size={14} />
              </button>
            )}
          </div>
        )}
        <MicControl {...mic} onStart={attempt} onStop={mic.stop} onTyped={mic.submitTyped} hint={res ? 'Tap to try again' : 'Tap and say it'} />
      </div>
      <div className="card">
        <h3>All tongue twisters</h3>
        {ranked.map((x) => (
          <button key={x.id} className="list-item" style={x.id === t.id ? { borderColor: 'var(--brand)' } : undefined} onClick={() => (setT(x), setSpeed(0), setRes(null))}>
            <span className="grow">
              <span className="small">{x.text}</span>
              <div className="small muted">
                {soundById(x.sound)?.title}
                {user.sounds[x.sound] != null ? ` · your score ${Math.round(user.sounds[x.sound])}` : ''}
              </div>
            </span>
            {user.twisters[x.id] && <span className="chip good">{user.twisters[x.id].wpm} wpm</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
