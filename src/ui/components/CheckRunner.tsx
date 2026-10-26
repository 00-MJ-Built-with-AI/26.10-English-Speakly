import { useState } from 'react';
import type { CheckResults, CheckStep } from '../../engine/check.ts';
import { aiTask } from '../../lib/api.ts';
import { useApp } from '../../lib/store.tsx';
import type { Level } from '../../lib/types.ts';
import type { Assessment } from '../../speech/index.ts';
import { Icon } from './Icon.tsx';
import { MicControl, ScoreChips, useListen, useSpeak, WordScores } from './speaking.tsx';

/**
 * Runs a list of speaking-check steps (read aloud, quick prompts, open question) and hands
 * back everything that was said. Used by unit checks and the fast-track level test.
 */
export function CheckRunner({
  level,
  steps,
  label,
  recordTitle,
  onFinish,
  finishLabel = 'See results',
}: {
  level: Level;
  steps: CheckStep[];
  label?: string;
  recordTitle: string;
  onFinish: (r: CheckResults) => void;
  finishLabel?: string;
}) {
  const app = useApp();
  const mic = useListen();
  const { speak } = useSpeak();
  const [i, setI] = useState(0);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<CheckResults>({ pron: [], grades: [], task: null });
  const [last, setLast] = useState<Assessment | null>(null);
  const [lastGrade, setLastGrade] = useState<{ correct: boolean; corrected: string; feedback: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const step = steps[i];

  async function run() {
    if (!step) return;
    setLast(null);
    setLastGrade(null);
    setError(null);
    try {
      if (step.part === 'pronunciation') {
        const a = await mic.listen({ reference: step.text, maxSeconds: 25, endSilenceMs: 1500, noSpeechMs: 10_000 });
        if (!a) return;
        setResults((r) => ({ ...r, pron: [...r.pron, a] }));
        setLast(a);
      } else if (step.part === 'grammar') {
        const f = step.prompt;
        const a = await mic.listen({ maxSeconds: 20, endSilenceMs: 1500, noSpeechMs: 12_000 });
        if (!a) return;
        setBusy(true);
        const g = await aiTask('grade', { level, instruction: f.instruction, prompt: f.prompt, example: f.example, grammarFocus: step.grammarFocus, transcript: a.text });
        setResults((r) => ({ ...r, grades: [...r.grades, { a, g }] }));
        setLastGrade(g);
        setLast(a);
      } else {
        const a = await mic.listen({ maxSeconds: 75, endSilenceMs: 3500, noSpeechMs: 15_000, record: true });
        if (!a) return;
        setBusy(true);
        const t = await aiTask('task', { level, question: step.question, canDo: step.canDo, transcript: a.text, seconds: a.speechMs / 1000 });
        setResults((r) => ({ ...r, task: { a, r: t } }));
        setLast(a);
        app.saveRecording(a.audio, { title: recordTitle, kind: 'testout', seconds: Math.round(a.speechMs / 1000), text: a.text });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function retry() {
    if (step.part === 'pronunciation') setResults((r) => ({ ...r, pron: r.pron.slice(0, -1) }));
    if (step.part === 'grammar') setResults((r) => ({ ...r, grades: r.grades.slice(0, -1) }));
    if (step.part === 'task') setResults((r) => ({ ...r, task: null }));
    setLast(null);
    setLastGrade(null);
  }

  if (!step) return null;
  return (
    <div className="stack">
      <div className="spread">
        <span className="small muted">
          {label ? `${label} · ` : ''}Step {i + 1} of {steps.length}
        </span>
        <div className="bar" style={{ width: 160 }}>
          <span style={{ width: `${((i + (last ? 1 : 0)) / steps.length) * 100}%` }} />
        </div>
      </div>
      <div className="card stack">
        {step.part === 'pronunciation' && (
          <>
            <div className="section-title">Read this aloud</div>
            <div className="prompt-text">{step.text}</div>
          </>
        )}
        {step.part === 'grammar' && (
          <>
            <div className="section-title">{step.prompt.instruction}</div>
            <div className="prompt-text">{step.prompt.prompt}</div>
            <div className="small muted">Start speaking as soon as you can.</div>
          </>
        )}
        {step.part === 'task' && (
          <>
            <div className="section-title">Answer in 30 to 60 seconds</div>
            <div className="prompt-text">{step.question}</div>
            <div>
              <button className="btn small" onClick={() => speak(step.question)}>
                <Icon name="volume" size={16} /> Hear the question
              </button>
            </div>
          </>
        )}
        {!last && (
          <MicControl
            {...mic}
            onStart={run}
            onStop={mic.stop}
            onTyped={mic.submitTyped}
            disabled={busy}
            hint={step.part === 'task' ? 'Tap and speak; pause for 3 seconds when finished' : 'Tap and speak'}
          />
        )}
        {busy && <div className="muted">Checking…</div>}
        {error && <div className="banner error">{error}</div>}
        {last && (
          <div className="stack fade-in">
            {step.part === 'pronunciation' ? <WordScores a={last} /> : <div className="soft">“{last.text || '(nothing heard)'}”</div>}
            <ScoreChips a={last} showFluency={step.part !== 'pronunciation'} />
            {lastGrade && (
              <div className={`banner ${lastGrade.correct ? 'info' : ''}`}>
                {lastGrade.correct ? 'Correct. ' : `Better: “${lastGrade.corrected}”. `}
                {lastGrade.feedback}
                {last.engine !== 'typed' && <span className="small"> (started after {(last.startDelayMs / 1000).toFixed(1)} s)</span>}
              </div>
            )}
            <div className="row">
              {i + 1 < steps.length ? (
                <button
                  className="btn primary"
                  onClick={() => {
                    setLast(null);
                    setLastGrade(null);
                    setI(i + 1);
                  }}
                >
                  Next <Icon name="next" size={18} />
                </button>
              ) : (
                <button className="btn primary" onClick={() => onFinish(results)}>
                  {finishLabel}
                </button>
              )}
              <button className="btn ghost small" onClick={retry}>
                <Icon name="refresh" size={16} /> Try again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
