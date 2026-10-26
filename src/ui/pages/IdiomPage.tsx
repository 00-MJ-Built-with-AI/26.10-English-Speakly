import { useState } from 'react';
import type { GradeResult } from '../../../shared/tasks.ts';
import { IDIOMS, idiomOfTheDay, type Idiom } from '../../content/idioms.ts';
import { workingLevel } from '../../engine/path.ts';
import { aiTask } from '../../lib/api.ts';
import { useApp } from '../../lib/store.tsx';
import type { Assessment } from '../../speech/index.ts';
import { Icon } from '../components/Icon.tsx';
import { MicControl, ScoreChips, useElapsed, useListen, useSpeak, WordScores } from '../components/speaking.tsx';

/** One workplace idiom a day: hear it, say the example, then use it in your own sentence. */
export function IdiomPage() {
  const app = useApp();
  const mic = useListen();
  const { speak } = useSpeak();
  const elapsed = useElapsed();
  const [idiom, setIdiom] = useState<Idiom>(() => idiomOfTheDay());
  const [said, setSaid] = useState<Assessment | null>(null);
  const [own, setOwn] = useState<{ a: Assessment; g: GradeResult } | null>(null);
  const [step, setStep] = useState<'example' | 'own' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const today = idiomOfTheDay();

  async function sayExample() {
    setStep('example');
    const a = await mic.listen({ reference: idiom.example, maxSeconds: 20, endSilenceMs: 1400, noSpeechMs: 8000 });
    setStep(null);
    if (a) setSaid(a);
  }

  async function sayOwn() {
    setStep('own');
    const a = await mic.listen({ maxSeconds: 30, endSilenceMs: 2000, noSpeechMs: 12_000 });
    setStep(null);
    if (!a?.text.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const g = await aiTask('grade', {
        level: workingLevel(app.user),
        instruction: `Use "${idiom.phrase}" naturally in your own sentence about your life or work.`,
        prompt: idiom.meaning,
        example: idiom.example,
        grammarFocus: `correct, natural use of "${idiom.phrase}"`,
        transcript: a.text,
      });
      setOwn({ a, g });
      await app.addVocab([{ phrase: idiom.phrase, meaning: idiom.meaning, example: idiom.example }], 'Idiom of the day');
      await app.logAttempt({ at: Date.now(), kind: 'idiom', title: `Idiom: ${idiom.phrase}`, seconds: elapsed(), scores: { vocabulary: g.vocabularyScore }, detail: { correct: g.correct } });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <div className="spread">
        <h1>{idiom.phrase === today.phrase ? 'Idiom of the day' : 'Idiom'}</h1>
        <button
          className="btn small"
          onClick={() => {
            const others = IDIOMS.filter((x) => x.phrase !== idiom.phrase);
            setIdiom(others[Math.floor(Math.random() * others.length)]);
            setSaid(null);
            setOwn(null);
          }}
        >
          <Icon name="refresh" size={16} /> Another one
        </button>
      </div>
      <div className="card stack">
        <div className="row">
          <div className="prompt-text">{idiom.phrase}</div>
          <span className="chip">{idiom.level}</span>
        </div>
        <p className="muted" style={{ margin: 0 }}>
          {idiom.meaning}
        </p>
        <div className="soft">“{idiom.example}”</div>
        <div className="row">
          <button className="btn small" onClick={() => speak(idiom.example)}>
            <Icon name="volume" size={16} /> Listen
          </button>
          <button className="btn small" onClick={() => speak(idiom.example, 0.75)}>
            <Icon name="slow" size={16} /> Slow
          </button>
        </div>
      </div>

      <div className="card stack">
        <h3>1. Say the example</h3>
        {said && (
          <>
            <WordScores a={said} />
            <ScoreChips a={said} showFluency={false} />
          </>
        )}
        {step !== 'own' && <MicControl {...mic} onStart={sayExample} onStop={mic.stop} onTyped={mic.submitTyped} hint={said ? 'Tap to try again' : 'Tap and read the example'} />}
      </div>

      <div className="card stack">
        <h3>2. Use it in your own sentence</h3>
        <p className="small muted">Something true about your work or life. This is where it sticks.</p>
        {own && (
          <div className="stack fade-in">
            <div className="soft">“{own.a.text}”</div>
            <div className={`banner ${own.g.correct ? 'info' : ''}`}>
              {own.g.correct ? 'Natural and correct! ' : `Better: “${own.g.corrected}”. `}
              {own.g.feedback}
            </div>
            <div className="small muted">Added to My phrases.</div>
          </div>
        )}
        {busy && <div className="muted">Checking…</div>}
        {error && <div className="banner error">{error}</div>}
        {step !== 'example' && <MicControl {...mic} onStart={sayOwn} onStop={mic.stop} onTyped={mic.submitTyped} disabled={busy} hint={own ? 'Tap to try another sentence' : 'Tap and use the idiom'} />}
      </div>
    </div>
  );
}
