import { useState } from 'react';
import type { GenerateOutputs, RetellResult } from '../../../shared/tasks.ts';
import { analyzeHesitation } from '../../engine/hesitation.ts';
import { workingLevel } from '../../engine/path.ts';
import { fluencyScore } from '../../engine/scoring.ts';
import { aiTask } from '../../lib/api.ts';
import { useApp } from '../../lib/store.tsx';
import type { Assessment } from '../../speech/index.ts';
import { HesitationChips } from '../components/Hesitation.tsx';
import { Icon } from '../components/Icon.tsx';
import { MicControl, PlayBlob, useElapsed, useListen, useSpeak } from '../components/speaking.tsx';

type Passage = GenerateOutputs['retell'];

/** Hear a short talk once or twice, then retell it in your own words. */
export function Retell() {
  const app = useApp();
  const level = workingLevel(app.user);
  const mic = useListen();
  const { speak, speaking, stop } = useSpeak();
  const elapsed = useElapsed();
  const [topic, setTopic] = useState('');
  const [passage, setPassage] = useState<Passage | null>(null);
  const [plays, setPlays] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ a: Assessment; r: RetellResult } | null>(null);

  async function load() {
    setBusy(true);
    setError(null);
    setResult(null);
    setPlays(0);
    try {
      setPassage((await aiTask('generate', { kind: 'retell', level, topic: topic || undefined })) as Passage);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function play() {
    if (!passage) return;
    setPlays((n) => n + 1);
    await speak(passage.text);
  }

  async function retell() {
    if (!passage) return;
    const a = await mic.listen({ maxSeconds: 90, endSilenceMs: 3500, noSpeechMs: 15_000, record: true });
    if (!a || !a.text.trim()) return;
    setBusy(true);
    try {
      const r = await aiTask('retell', { level, text: passage.text, keyPoints: passage.keyPoints, transcript: a.text });
      setResult({ a, r });
      const real = a.engine !== 'typed';
      await app.logAttempt({
        at: Date.now(),
        kind: 'retell',
        title: `Retell: ${passage.title}`,
        seconds: elapsed(),
        hesitation: real ? analyzeHesitation(a) : undefined,
        scores: { vocabulary: r.languageScore, grammar: r.languageScore, ...(real ? { fluency: fluencyScore(a, false), pronunciation: a.pron } : {}) },
        detail: { content: r.contentScore },
      });
      await app.addMistakes(
        r.corrections.map((c) => ({ kind: c.kind, said: c.original, better: c.corrected, why: c.explanation })),
        'Retell',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <h1>Listen and retell</h1>
      <p className="muted">Like summarising a meeting for a colleague: listen (twice at most), then retell the main points in your own words.</p>
      <div className="card row">
        <input type="text" placeholder="Topic (optional), e.g. a team update, a product launch" value={topic} onChange={(e) => setTopic(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
        <button className="btn primary" onClick={load} disabled={busy}>
          <Icon name="refresh" size={16} /> {passage ? 'New talk' : 'Get a talk'}
        </button>
      </div>
      {error && <div className="banner error">{error}</div>}
      {passage && (
        <div className="card stack">
          <div className="spread">
            <h3 style={{ margin: 0 }}>{passage.title}</h3>
            <span className="small muted">Played {plays} / 2</span>
          </div>
          <div className="row">
            <button className="btn" onClick={() => (speaking ? stop() : play())} disabled={!speaking && plays >= 2}>
              <Icon name={speaking ? 'stop' : 'volume'} size={18} /> {speaking ? 'Stop' : plays ? 'Play again' : 'Listen'}
            </button>
          </div>
          {plays > 0 && !result && (
            <MicControl {...mic} onStart={retell} onStop={mic.stop} onTyped={mic.submitTyped} disabled={busy || speaking} hint="Tap and retell the main points; pause to finish" />
          )}
          {busy && <div className="muted">Checking your retelling…</div>}
        </div>
      )}
      {result && passage && (
        <div className="stack fade-in">
          <div className="card stack">
            <div className="spread">
              <h3 style={{ margin: 0 }}>Main points</h3>
              <span className={`chip ${result.r.contentScore >= 70 ? 'good' : result.r.contentScore >= 40 ? 'ok' : 'bad'}`}>Content {Math.round(result.r.contentScore)}</span>
            </div>
            {passage.keyPoints.map((k, i) => (
              <div key={k} className="row">
                <span className={`chip ${result.r.covered[i] ? 'good' : 'bad'}`}>{result.r.covered[i] ? 'got it' : 'missed'}</span>
                <span>{k}</span>
              </div>
            ))}
          </div>
          <div className="card stack">
            <h3>Your retelling</h3>
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
              <h3 style={{ margin: 0 }}>A model retelling</h3>
              <button className="btn small" onClick={() => speak(result.r.betterRetell)}>
                <Icon name="volume" size={16} /> Listen
              </button>
            </div>
            <p>{result.r.betterRetell}</p>
            <details>
              <summary>Show the original talk</summary>
              <p className="small">{passage.text}</p>
            </details>
          </div>
        </div>
      )}
    </div>
  );
}
