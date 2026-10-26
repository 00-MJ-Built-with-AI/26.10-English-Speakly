import { useMemo, useState } from 'react';
import type { GradeResult, TaskResult } from '../../../shared/tasks.ts';
import { unitById } from '../../content/units.ts';
import { nextUnit, recordCheck, unitState, type PartResult } from '../../engine/path.ts';
import { fluencyScore, PASS_MARK } from '../../engine/scoring.ts';
import { aiTask } from '../../lib/api.ts';
import { go, href } from '../../lib/router.ts';
import { useApp } from '../../lib/store.tsx';
import type { Mistake, UnitPart } from '../../lib/types.ts';
import type { Assessment } from '../../speech/index.ts';
import { Icon } from '../components/Icon.tsx';
import { MicControl, ScoreChips, useElapsed, useListen, useSpeak, WordScores } from '../components/speaking.tsx';

type Step = { part: 'pronunciation'; text: string } | { part: 'grammar'; index: number } | { part: 'task' };

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export function UnitCheck({ id }: { id: string }) {
  const unit = unitById(id)!;
  const app = useApp();
  const { user, engine } = app;
  const mic = useListen();
  const { speak } = useSpeak();
  const elapsed = useElapsed();
  const state = unitState(user, id);
  const parts: UnitPart[] = useMemo(() => {
    const all: UnitPart[] = ['pronunciation', 'grammar', 'task'];
    return state.status === 'done' ? all : all.filter((p) => !state.parts[p].passed);
  }, []); // decided once, when the check starts
  const steps: Step[] = useMemo(() => {
    const s: Step[] = [];
    if (parts.includes('pronunciation')) {
      const longest = [...unit.shadow].sort((a, b) => b.length - a.length);
      s.push({ part: 'pronunciation', text: longest[0] }, { part: 'pronunciation', text: longest[1] });
    }
    if (parts.includes('grammar')) s.push({ part: 'grammar', index: 0 }, { part: 'grammar', index: 1 }, { part: 'grammar', index: 2 });
    if (parts.includes('task')) s.push({ part: 'task' });
    return s;
  }, [parts, unit]);

  const [i, setI] = useState(-1);
  const [busy, setBusy] = useState(false);
  const [pron, setPron] = useState<Assessment[]>([]);
  const [grades, setGrades] = useState<{ a: Assessment; g: GradeResult }[]>([]);
  const [task, setTask] = useState<{ a: Assessment; r: TaskResult } | null>(null);
  const [last, setLast] = useState<Assessment | null>(null);
  const [result, setResult] = useState<Record<UnitPart, PartResult> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const step = steps[i];
  const mark = PASS_MARK[unit.level];

  async function run() {
    if (!step) return;
    setLast(null);
    setError(null);
    try {
      if (step.part === 'pronunciation') {
        const a = await mic.listen({ reference: step.text, maxSeconds: 25, endSilenceMs: 1500, noSpeechMs: 10_000 });
        if (a) {
          setPron((x) => [...x, a]);
          setLast(a);
        }
      } else if (step.part === 'grammar') {
        const f = unit.fast[step.index];
        const a = await mic.listen({ maxSeconds: 20, endSilenceMs: 1500, noSpeechMs: 12_000 });
        if (!a) return;
        setBusy(true);
        const g = await aiTask('grade', { level: unit.level, instruction: f.instruction, prompt: f.prompt, example: f.example, grammarFocus: unit.grammar.name, transcript: a.text });
        setGrades((x) => [...x, { a, g }]);
        setLast(a);
      } else {
        const a = await mic.listen({ maxSeconds: 75, endSilenceMs: 3500, noSpeechMs: 15_000, record: true });
        if (!a) return;
        setBusy(true);
        const r = await aiTask('task', { level: unit.level, question: unit.question, canDo: unit.canDo, transcript: a.text, seconds: a.speechMs / 1000 });
        setTask({ a, r });
        setLast(a);
        app.saveRecording(a.audio, { title: `${unit.title}: check`, kind: 'testout', seconds: Math.round(a.speechMs / 1000), text: a.text });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    const res: Partial<Record<UnitPart, PartResult>> = {};
    const mistakes: Pick<Mistake, 'kind' | 'said' | 'better' | 'why'>[] = [];
    let pronScore: number | undefined;
    let fluency: number | undefined;
    let grammar: number[] = [];
    let vocab: number | undefined;
    if (parts.includes('pronunciation')) {
      pronScore = avg(pron.map((a) => a.pron));
      const typed = pron.every((a) => a.engine === 'typed');
      res.pronunciation = { passed: !typed && pronScore >= mark.pron, score: pronScore };
      for (const a of pron.filter((x) => x.engine !== 'typed'))
        for (const w of a.words)
          if (w.error !== 'Omission' && w.accuracy < 60) mistakes.push({ kind: 'pronunciation', said: w.word, better: w.word, why: `Pronunciation ${Math.round(w.accuracy)}/100` });
    }
    if (parts.includes('grammar')) {
      const correct = grades.filter((x) => x.g.correct).length;
      const typed = grades.every((x) => x.a.engine === 'typed');
      const delay = avg(grades.map((x) => x.a.startDelayMs)) / 1000;
      const quick = typed || delay <= mark.startSeconds;
      grammar = grades.map((x) => x.g.grammarScore);
      res.grammar = { passed: correct >= 2 && quick, score: (correct / 3) * 100 };
      for (const x of grades) if (!x.g.correct && x.a.text) mistakes.push({ kind: 'grammar', said: x.a.text, better: x.g.corrected, why: x.g.feedback });
    }
    if (parts.includes('task') && task) {
      const typed = task.a.engine === 'typed';
      fluency = typed ? undefined : fluencyScore(task.a, true);
      grammar = [...grammar, task.r.grammarScore];
      vocab = task.r.vocabularyScore;
      const score = avg([task.r.grammarScore, task.r.vocabularyScore, task.r.coherenceScore, ...(fluency != null ? [fluency] : [])]);
      res.task = { passed: task.r.achieved && (typed || (fluency ?? 0) >= mark.fluency), score };
      for (const c of task.r.corrections) mistakes.push({ kind: c.kind, said: c.original, better: c.corrected, why: c.explanation });
    }
    app.update((u) => {
      recordCheck(u, id, res);
    });
    await app.logAttempt(
      {
        at: Date.now(),
        kind: 'testout',
        title: `${unit.title}: check`,
        unitId: id,
        seconds: elapsed(),
        scores: {
          ...(pronScore != null && pron.some((a) => a.engine !== 'typed') ? { pronunciation: pronScore } : {}),
          ...(fluency != null ? { fluency } : {}),
          ...(grammar.length ? { grammar: avg(grammar) } : {}),
          ...(vocab != null ? { vocabulary: vocab } : {}),
        },
        detail: { res },
      },
      { skillWeight: 0.3 },
    );
    await app.addMistakes(mistakes, unit.title);
    setResult(res as Record<UnitPart, PartResult>);
  }

  if (result) {
    const allPassed = Object.values(result).every((r) => r.passed) && unitState(user, id).status === 'done';
    const nxt = nextUnit(id);
    return (
      <div className="stack">
        <h1>{allPassed ? 'Unit complete!' : 'Check finished'}</h1>
        <p className="muted">{allPassed ? 'You already know this unit. On to the next one.' : 'Practise the parts marked below, then check them again.'}</p>
        {(Object.entries(result) as [UnitPart, PartResult][]).map(([p, r]) => (
          <div key={p} className="card spread">
            <div>
              <b>{p === 'task' ? 'Speaking task' : p === 'grammar' ? 'Grammar in speech' : 'Pronunciation'}</b>
              <div className="small muted">Score {Math.round(r.score)}</div>
            </div>
            <span className={`chip ${r.passed ? 'good' : 'bad'}`}>{r.passed ? 'Passed' : 'Needs practice'}</span>
          </div>
        ))}
        {task && (
          <div className="card">
            <h3>Feedback on your answer</h3>
            <p>{task.r.feedback}</p>
            {task.r.corrections.length > 0 && (
              <ul>
                {task.r.corrections.map((c, k) => (
                  <li key={k}>
                    <s className="muted">{c.original}</s> → <b>{c.corrected}</b> <span className="small muted">{c.explanation}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        <div className="row">
          {allPassed && nxt ? (
            <button className="btn primary big" onClick={() => go(`/unit/${nxt.id}/check`)}>
              Next unit check: {nxt.title} <Icon name="next" />
            </button>
          ) : (
            <a className="btn primary big" href={href(`/unit/${id}`)}>
              Go to lessons
            </a>
          )}
          <a className="btn" href={href('/path')}>
            Back to path
          </a>
        </div>
      </div>
    );
  }

  if (i < 0) {
    return (
      <div className="stack">
        <a href={href(`/unit/${id}`)} className="small">
          ← {unit.title}
        </a>
        <h1>Unit check: {unit.title}</h1>
        <div className="card stack">
          <p>
            {steps.length} short speaking tasks ({parts.map((p) => (p === 'task' ? 'speaking task' : p === 'grammar' ? 'grammar in speech' : 'pronunciation')).join(', ')}). Speak naturally; there is no
            way to fail the unit, only to find what to practise.
          </p>
          <p className="small muted">Tip: for the quick prompts, start talking within {mark.startSeconds} seconds. Starting fast matters as much as being correct.</p>
          {!engine.canListen && <div className="banner">Your browser cannot hear the microphone. You can type answers, but pronunciation can't be scored.</div>}
          <button className="btn primary big" onClick={() => setI(0)}>
            Begin
          </button>
        </div>
      </div>
    );
  }

  const f = step?.part === 'grammar' ? unit.fast[step.index] : null;
  return (
    <div className="stack">
      <div className="spread">
        <span className="small muted">
          Step {i + 1} of {steps.length}
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
        {f && (
          <>
            <div className="section-title">{f.instruction}</div>
            <div className="prompt-text">{f.prompt}</div>
            <div className="small muted">Start speaking as soon as you can.</div>
          </>
        )}
        {step.part === 'task' && (
          <>
            <div className="section-title">Answer in 30 to 60 seconds</div>
            <div className="prompt-text">{unit.question}</div>
            <div>
              <button className="btn small" onClick={() => speak(unit.question)}>
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
            {step.part === 'grammar' && grades[grades.length - 1] && (
              <div className={`banner ${grades[grades.length - 1].g.correct ? 'info' : ''}`}>
                {grades[grades.length - 1].g.correct ? 'Correct. ' : `Better: “${grades[grades.length - 1].g.corrected}”. `}
                {grades[grades.length - 1].g.feedback}
                {last.engine !== 'typed' && <span className="small"> (started after {(last.startDelayMs / 1000).toFixed(1)} s)</span>}
              </div>
            )}
            <div className="row">
              {i + 1 < steps.length ? (
                <button className="btn primary" onClick={() => (setLast(null), setI(i + 1))}>
                  Next <Icon name="next" size={18} />
                </button>
              ) : (
                <button className="btn primary" onClick={finish}>
                  See results
                </button>
              )}
              <button
                className="btn ghost small"
                onClick={() => {
                  if (step.part === 'pronunciation') setPron((x) => x.slice(0, -1));
                  if (step.part === 'grammar') setGrades((x) => x.slice(0, -1));
                  if (step.part === 'task') setTask(null);
                  setLast(null);
                }}
              >
                <Icon name="refresh" size={16} /> Try again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
