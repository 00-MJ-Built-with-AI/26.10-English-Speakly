import { useEffect, useState } from 'react';
import { CHECKUP_EVERY_DAYS, CHECKUP_PASSAGE } from '../../content/checkup.ts';
import { SOUNDS } from '../../content/sounds.ts';
import { checkupScores } from '../../engine/checkup.ts';
import { blend } from '../../engine/scoring.ts';
import { href } from '../../lib/router.ts';
import { useApp } from '../../lib/store.tsx';
import type { Checkup as CheckupT } from '../../lib/types.ts';
import type { Assessment } from '../../speech/index.ts';
import { Icon } from '../components/Icon.tsx';
import { MicControl, PlayBlob, ScoreChips, useElapsed, useListen, useSpeak, WordScores } from '../components/speaking.tsx';

type C = CheckupT & { id: string };

/** Read the same passage every month; see every sound's score and how it changed. */
export function Checkup() {
  const app = useApp();
  const mic = useListen();
  const { speak, speaking, stop } = useSpeak();
  const elapsed = useElapsed();
  const [history, setHistory] = useState<C[] | null>(null);
  const [result, setResult] = useState<{ a: Assessment; c: CheckupT } | null>(null);

  useEffect(() => {
    app.repo.list<CheckupT>('checkups', { limit: 24 }).then(setHistory);
  }, [app.repo]);

  const last = history?.[0];
  const daysSince = last ? Math.floor((Date.now() - last.at) / 86_400_000) : null;

  async function read() {
    const a = await mic.listen({ reference: CHECKUP_PASSAGE, maxSeconds: 150, endSilenceMs: 3000, noSpeechMs: 12_000, record: true });
    if (!a || a.engine === 'typed') return;
    const sounds = checkupScores(a);
    const audioPath = await app.saveRecording(a.audio, { title: 'Accent check-up', kind: 'checkup', seconds: Math.round(a.speechMs / 1000), text: CHECKUP_PASSAGE, score: Math.round(a.pron) });
    const c: CheckupT = { at: Date.now(), pron: Math.round(a.pron), accuracy: Math.round(a.accuracy), fluency: Math.round(a.fluency), prosody: a.prosody == null ? null : Math.round(a.prosody), sounds, audioPath };
    const id = await app.repo.add('checkups', c);
    setHistory((h) => [{ ...c, id }, ...(h ?? [])]);
    setResult({ a, c });
    app.update((u) => {
      for (const [k, v] of Object.entries(sounds)) u.sounds[k] = blend(u.sounds[k] ?? null, v, 0.5);
    });
    await app.logAttempt({ at: Date.now(), kind: 'checkup', title: 'Accent check-up', seconds: elapsed(), scores: { pronunciation: a.pron, fluency: a.fluency } });
  }

  const prev = result ? history?.find((h) => h.at < result.c.at) : undefined;
  const shown = result?.c ?? last;
  const before = result ? prev : history?.[1];

  return (
    <div className="stack">
      <h1>Accent check-up</h1>
      <p className="muted">
        Read the same passage once a month. It contains every sound you practise, so you can see exactly which ones improved. About one minute.
      </p>
      {daysSince != null && !result && (
        <div className={`banner ${daysSince >= CHECKUP_EVERY_DAYS ? '' : 'info'}`}>
          Last check-up {daysSince === 0 ? 'today' : `${daysSince} day${daysSince === 1 ? '' : 's'} ago`}.{daysSince >= CHECKUP_EVERY_DAYS ? ' Time for a new one.' : ''}
        </div>
      )}
      <div className="card stack">
        <div className="spread">
          <div className="section-title">Read this aloud</div>
          <button className="btn small" onClick={() => (speaking ? stop() : speak(CHECKUP_PASSAGE))}>
            <Icon name={speaking ? 'stop' : 'volume'} size={16} /> {speaking ? 'Stop' : 'Model'}
          </button>
        </div>
        {result ? <WordScores a={result.a} /> : <p style={{ fontSize: '1.15rem', lineHeight: 1.7 }}>{CHECKUP_PASSAGE}</p>}
        {result && (
          <>
            <ScoreChips a={result.a} />
            <PlayBlob blob={result.a.audio} />
          </>
        )}
        {!result && <MicControl {...mic} onStart={read} onStop={mic.stop} onTyped={mic.submitTyped} hint="Tap and read the whole passage; pause to finish" />}
        {!app.engine.canListen && <div className="banner">The check-up needs a microphone.</div>}
      </div>

      {shown && (
        <div className="card">
          <div className="spread">
            <h3 style={{ margin: 0 }}>Sound by sound</h3>
            <span className="small muted">
              {new Date(shown.at).toLocaleDateString()}
              {before ? ` vs ${new Date(before.at).toLocaleDateString()}` : ''}
            </span>
          </div>
          <div style={{ marginTop: 10 }}>
            {SOUNDS.filter((s) => shown.sounds[s.id] != null)
              .sort((a, b) => shown.sounds[a.id] - shown.sounds[b.id])
              .map((s) => {
                const v = shown.sounds[s.id];
                const d = before?.sounds[s.id] != null ? v - before.sounds[s.id] : null;
                return (
                  <a key={s.id} href={href(`/practice/sounds/${s.id}`)} className="spread" style={{ padding: '6px 0', borderBottom: '1px solid var(--line)', color: 'var(--text)' }}>
                    <span>{s.title}</span>
                    <span className="row">
                      {d != null && d !== 0 && <span style={{ color: d > 0 ? 'var(--good)' : 'var(--bad)', fontWeight: 700 }}>{d > 0 ? `+${d}` : d}</span>}
                      <span className={`chip ${v >= 80 ? 'good' : v >= 60 ? 'ok' : 'bad'}`}>{v}</span>
                    </span>
                  </a>
                );
              })}
          </div>
        </div>
      )}

      {history && history.length > 1 && (
        <div className="card">
          <h3>All check-ups</h3>
          {history.map((h) => (
            <div key={h.id} className="spread small" style={{ padding: '4px 0' }}>
              <span>{new Date(h.at).toLocaleDateString()}</span>
              <span className="row">
                <span className="chip">Overall {h.pron}</span>
                {h.prosody != null && <span className="chip">Rhythm {h.prosody}</span>}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
