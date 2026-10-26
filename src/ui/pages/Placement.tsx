import { useMemo, useState } from 'react';
import { levelSteps } from '../../content/placement.ts';
import { unitsByLevel } from '../../content/units.ts';
import { checkPassed, evaluateCheck, type CheckOutcome, type CheckResults } from '../../engine/check.ts';
import { levelProgress, testOutLevel } from '../../engine/path.ts';
import { LEVEL_NAMES } from '../../engine/scoring.ts';
import { href } from '../../lib/router.ts';
import { useApp } from '../../lib/store.tsx';
import type { Level, UnitPart } from '../../lib/types.ts';
import { LEVELS } from '../../../shared/tasks.ts';
import { CheckRunner } from '../components/CheckRunner.tsx';
import { Icon } from '../components/Icon.tsx';
import { useElapsed } from '../components/speaking.tsx';

const PARTS: UnitPart[] = ['pronunciation', 'grammar', 'task'];
const PART_NAME: Record<UnitPart, string> = { pronunciation: 'Pronunciation', grammar: 'Grammar in speech', task: 'Speaking task' };

/** Fast-track level test: one short block per level, stopping at the first level not passed. */
export function Placement() {
  const app = useApp();
  const { user } = app;
  const firstOpen = LEVELS.find((l) => levelProgress(user, l).done < levelProgress(user, l).total) ?? 'C2';
  const [start, setStart] = useState<Level>(firstOpen);
  const [level, setLevel] = useState<Level | null>(null);
  const [passed, setPassed] = useState<Level[]>([]);
  const [between, setBetween] = useState<{ level: Level; o: CheckOutcome } | null>(null);
  const [final, setFinal] = useState<{ level: Level; o: CheckOutcome } | null>(null);
  const elapsed = useElapsed();
  const steps = useMemo(() => (level ? levelSteps(level) : []), [level]);

  async function blockDone(r: CheckResults) {
    if (!level) return;
    const o = evaluateCheck(level, PARTS, r);
    const ok = checkPassed(o);
    if (ok) app.update((u) => testOutLevel(u, level));
    await app.logAttempt(
      { at: Date.now(), kind: 'placement', title: `Level test: ${level} ${ok ? 'passed' : 'not yet'}`, seconds: elapsed(), scores: o.scores, hesitation: o.hesitation, detail: { level, parts: o.parts } },
      { skillWeight: 0.3 },
    );
    await app.addMistakes(o.mistakes, `Level test ${level}`);
    const next = LEVELS[LEVELS.indexOf(level) + 1];
    if (ok) {
      setPassed((p) => [...p, level]);
      if (next) setBetween({ level, o });
      else setFinal({ level, o });
    } else {
      setFinal({ level, o });
    }
    setLevel(null);
  }

  if (final) {
    const ok = checkPassed(final.o);
    const startUnit = ok ? null : unitsByLevel(final.level)[0];
    return (
      <div className="stack">
        <h1>{ok ? 'You passed every level!' : passed.length ? `Confirmed up to ${passed[passed.length - 1]}` : 'Start of your path'}</h1>
        <div className="card stack">
          {passed.length > 0 && (
            <p>
              Marked as done: <b>{passed.join(', ')}</b> ({passed.reduce((n, l) => n + unitsByLevel(l).length, 0)} units).
            </p>
          )}
          {!ok && (
            <>
              <p>
                <b>{final.level}</b> ({LEVEL_NAMES[final.level]}) needs work in:
              </p>
              <div className="row">
                {PARTS.map((p) => {
                  const r = final.o.parts[p];
                  return r ? (
                    <span key={p} className={`chip ${r.passed ? 'good' : 'bad'}`}>
                      {PART_NAME[p]} {Math.round(r.score)}
                    </span>
                  ) : null;
                })}
              </div>
              <p className="small muted">Each {final.level} unit still starts with its own short check, so anything you already know is skipped there.</p>
            </>
          )}
        </div>
        <div className="row">
          {startUnit && (
            <a className="btn primary big" href={href(`/unit/${startUnit.id}`)}>
              Start {final.level}: {startUnit.title} <Icon name="next" />
            </a>
          )}
          <a className="btn" href={href('/path')}>
            See my path
          </a>
        </div>
      </div>
    );
  }

  if (between) {
    const next = LEVELS[LEVELS.indexOf(between.level) + 1];
    return (
      <div className="stack">
        <h1>{between.level} passed</h1>
        <div className="card stack">
          <p>All {unitsByLevel(between.level).length} {between.level} units are now marked done.</p>
          <div className="row">
            {PARTS.map((p) => (
              <span key={p} className="chip good">
                {PART_NAME[p]} {Math.round(between.o.parts[p]?.score ?? 0)}
              </span>
            ))}
          </div>
        </div>
        <div className="row">
          <button
            className="btn primary big"
            onClick={() => {
              setBetween(null);
              setLevel(next);
            }}
          >
            Continue to {next} <Icon name="next" />
          </button>
          <button className="btn" onClick={() => (setFinal({ level: between.level, o: between.o }), setBetween(null))}>
            Stop here
          </button>
        </div>
      </div>
    );
  }

  if (level) return <CheckRunner key={level} level={level} steps={steps} label={`Level ${level}`} recordTitle={`Level test ${level}`} onFinish={blockDone} finishLabel="Finish this level" />;

  return (
    <div className="stack">
      <a className="small" href={href('/path')}>
        ← Path
      </a>
      <h1>Fast-track level test</h1>
      <div className="card stack">
        <p>
          One short block per level (about 2½ minutes each): read 2 sentences, answer 3 quick prompts, and talk for 30-60 seconds. Pass a block and every unit of that level is marked done. The test stops at
          the first level you don't pass, so you start your path exactly there.
        </p>
        <label className="field">
          <span>Start at</span>
          <select value={start} onChange={(e) => setStart(e.target.value as Level)}>
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {l} · {LEVEL_NAMES[l]}
                {levelProgress(user, l).done === levelProgress(user, l).total ? ' (done)' : ''}
              </option>
            ))}
          </select>
        </label>
        {start !== 'A1' && LEVELS.indexOf(start) > LEVELS.indexOf(firstOpen) && (
          <div className="banner">Starting above {firstOpen} skips checking the levels below it.</div>
        )}
        {!app.engine.canListen && <div className="banner">Pronunciation can only be passed by speaking, so this test needs a microphone.</div>}
        <button className="btn primary big" onClick={() => setLevel(start)}>
          <Icon name="mic" /> Start at {start}
        </button>
      </div>
    </div>
  );
}
