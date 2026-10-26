import { useMemo, useState } from 'react';
import { unitById } from '../../content/units.ts';
import { evaluateCheck, type CheckOutcome, type CheckStep } from '../../engine/check.ts';
import { nextUnit, recordCheck, unitState } from '../../engine/path.ts';
import { PASS_MARK } from '../../engine/scoring.ts';
import { go, href } from '../../lib/router.ts';
import { useApp } from '../../lib/store.tsx';
import type { UnitPart } from '../../lib/types.ts';
import type { CheckResults } from '../../engine/check.ts';
import { CheckRunner } from '../components/CheckRunner.tsx';
import { Icon } from '../components/Icon.tsx';
import { useElapsed } from '../components/speaking.tsx';

export function UnitCheck({ id }: { id: string }) {
  const unit = unitById(id)!;
  const app = useApp();
  const { user, engine } = app;
  const elapsed = useElapsed();
  const state = unitState(user, id);
  const parts: UnitPart[] = useMemo(() => {
    const all: UnitPart[] = ['pronunciation', 'grammar', 'task'];
    return state.status === 'done' ? all : all.filter((p) => !state.parts[p].passed);
  }, []); // decided once, when the check starts
  const steps: CheckStep[] = useMemo(() => {
    const s: CheckStep[] = [];
    if (parts.includes('pronunciation')) {
      const longest = [...unit.shadow].sort((a, b) => b.length - a.length);
      s.push({ part: 'pronunciation', text: longest[0] }, { part: 'pronunciation', text: longest[1] });
    }
    if (parts.includes('grammar')) for (const f of unit.fast.slice(0, 3)) s.push({ part: 'grammar', prompt: f, grammarFocus: unit.grammar.name });
    if (parts.includes('task')) s.push({ part: 'task', question: unit.question, canDo: unit.canDo });
    return s;
  }, [parts, unit]);

  const [started, setStarted] = useState(false);
  const [outcome, setOutcome] = useState<{ o: CheckOutcome; r: CheckResults } | null>(null);
  const mark = PASS_MARK[unit.level];

  async function finish(r: CheckResults) {
    const o = evaluateCheck(unit.level, parts, r);
    app.update((u) => {
      recordCheck(u, id, o.parts);
    });
    await app.logAttempt(
      { at: Date.now(), kind: 'testout', title: `${unit.title}: check`, unitId: id, seconds: elapsed(), scores: o.scores, hesitation: o.hesitation, detail: { res: o.parts } },
      { skillWeight: 0.3 },
    );
    await app.addMistakes(o.mistakes, unit.title);
    setOutcome({ o, r });
  }

  if (outcome) {
    const { o, r } = outcome;
    const done = unitState(user, id).status === 'done';
    const nxt = nextUnit(id);
    return (
      <div className="stack">
        <h1>{done ? 'Unit complete!' : 'Check finished'}</h1>
        <p className="muted">{done ? 'You already know this unit. On to the next one.' : 'Practise the parts marked below, then check them again.'}</p>
        {(Object.entries(o.parts) as [UnitPart, { passed: boolean; score: number }][]).map(([p, x]) => (
          <div key={p} className="card spread">
            <div>
              <b>{p === 'task' ? 'Speaking task' : p === 'grammar' ? 'Grammar in speech' : 'Pronunciation'}</b>
              <div className="small muted">Score {Math.round(x.score)}</div>
            </div>
            <span className={`chip ${x.passed ? 'good' : 'bad'}`}>{x.passed ? 'Passed' : 'Needs practice'}</span>
          </div>
        ))}
        {r.task && (
          <div className="card">
            <h3>Feedback on your answer</h3>
            <p>{r.task.r.feedback}</p>
            {r.task.r.corrections.length > 0 && (
              <ul>
                {r.task.r.corrections.map((c, k) => (
                  <li key={k}>
                    <s className="muted">{c.original}</s> → <b>{c.corrected}</b> <span className="small muted">{c.explanation}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        <div className="row">
          {done && nxt ? (
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

  if (!started) {
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
          <button className="btn primary big" onClick={() => setStarted(true)}>
            Begin
          </button>
        </div>
      </div>
    );
  }

  return <CheckRunner level={unit.level} steps={steps} recordTitle={`${unit.title}: check`} onFinish={finish} />;
}
