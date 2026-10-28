import { useState } from 'react';
import type { JournalResult } from '../../../shared/tasks.ts';
import { drawWords, usedWord } from '../../content/stories.ts';
import { analyzeHesitation } from '../../engine/hesitation.ts';
import { workingLevel } from '../../engine/path.ts';
import { fluencyScore } from '../../engine/scoring.ts';
import { aiTask } from '../../lib/api.ts';
import { useApp } from '../../lib/store.tsx';
import type { Assessment } from '../../speech/index.ts';
import { HesitationChips } from '../components/Hesitation.tsx';
import { Icon } from '../components/Icon.tsx';
import { MicControl, PlayBlob, useElapsed, useListen, useSpeak } from '../components/speaking.tsx';

/** Three random words, one short spoken story that uses them all. */
export function Story() {
  const app = useApp();
  const mic = useListen();
  const { speak } = useSpeak();
  const elapsed = useElapsed();
  const [words, setWords] = useState(() => drawWords());
  const [result, setResult] = useState<{ a: Assessment; r: JournalResult } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function tell() {
    setResult(null);
    setError(null);
    const a = await mic.listen({ maxSeconds: 90, endSilenceMs: 4000, noSpeechMs: 15_000, record: true });
    if (!a?.text.trim()) return;
    setBusy(true);
    try {
      const prompt = `Tell a short story that uses these three words: ${words.join(', ')}.`;
      const r = await aiTask('journal', { level: workingLevel(app.user), prompt, transcript: a.text, seconds: a.speechMs / 1000 });
      setResult({ a, r });
      const real = a.engine !== 'typed';
      await app.logAttempt({
        at: Date.now(),
        kind: 'story',
        title: `Story: ${words.join(', ')}`,
        seconds: elapsed(),
        hesitation: real ? analyzeHesitation(a) : undefined,
        scores: { grammar: r.grammarScore, vocabulary: r.vocabularyScore, ...(real ? { fluency: fluencyScore(a, false), pronunciation: a.pron } : {}) },
        detail: { used: words.filter((w) => usedWord(w, a.text)).length },
      });
      await app.addMistakes(
        r.corrections.map((c) => ({ kind: c.kind, said: c.original, better: c.corrected, why: c.explanation })),
        'Story builder',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <div className="spread">
        <h1>Story builder</h1>
        <button className="btn small" onClick={() => (setWords(drawWords()), setResult(null))}>
          <Icon name="refresh" size={16} /> New words
        </button>
      </div>
      <p className="muted">Tell a short story (30-90 seconds) that uses all three words. No preparation: start talking and let the story happen.</p>
      <div className="card stack" style={{ textAlign: 'center' }}>
        <div className="row" style={{ justifyContent: 'center' }}>
          {words.map((w) => {
            const used = result ? usedWord(w, result.a.text) : null;
            return (
              <span key={w} className={`chip ${used == null ? 'brand' : used ? 'good' : 'bad'}`} style={{ fontSize: '1.2rem', padding: '8px 16px' }}>
                {w}
                {used != null && (used ? ' ✓' : ' ✗')}
              </span>
            );
          })}
        </div>
        {!result && <MicControl {...mic} onStart={tell} onStop={mic.stop} onTyped={mic.submitTyped} disabled={busy} hint="Tap and tell your story; pause to finish" />}
        {busy && <div className="muted">Listening to your story…</div>}
        {error && <div className="banner error">{error}</div>}
      </div>
      {result && (
        <div className="stack fade-in">
          <div className="card stack">
            <h3 style={{ margin: 0 }}>Your story</h3>
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
              <h3 style={{ margin: 0 }}>Told more naturally</h3>
              <button className="btn small" onClick={() => speak(result.r.polished)}>
                <Icon name="volume" size={16} /> Listen
              </button>
            </div>
            <p>{result.r.polished}</p>
          </div>
          <div className="row">
            <button className="btn primary" onClick={() => (setWords(drawWords()), setResult(null))}>
              New words
            </button>
            <button className="btn" onClick={() => setResult(null)}>
              Tell it again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
