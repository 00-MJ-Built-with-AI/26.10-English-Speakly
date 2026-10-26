import { UNITS, unitsByLevel } from '../../content/units.ts';
import { currentUnit, levelProgress, unitState } from '../../engine/path.ts';
import { LEVEL_NAMES } from '../../engine/scoring.ts';
import { href } from '../../lib/router.ts';
import { useApp } from '../../lib/store.tsx';
import { LEVELS } from '../../../shared/tasks.ts';
import { Icon } from '../components/Icon.tsx';

export function PathPage() {
  const { user } = useApp();
  const cur = currentUnit(user);
  const done = UNITS.filter((u) => unitState(user, u.id).status === 'done').length;
  return (
    <div>
      <h1>Your path: A1 to C2</h1>
      <p className="muted">
        Every unit starts with a short speaking check. Pass it and the unit is done; miss a part and you only practise that part. {done} of {UNITS.length} units done.
      </p>
      {LEVELS.map((level) => {
        const p = levelProgress(user, level);
        return (
          <section key={level} className="section">
            <div className="level-head">
              <span className="level-badge">{level}</span>
              <div style={{ flex: 1 }}>
                <div className="spread">
                  <b>{LEVEL_NAMES[level]}</b>
                  <span className="small muted">
                    {p.done}/{p.total}
                  </span>
                </div>
                <div className="bar" style={{ marginTop: 6 }}>
                  <span style={{ width: `${(p.done / p.total) * 100}%`, background: p.done === p.total ? 'var(--good)' : undefined }} />
                </div>
              </div>
            </div>
            {unitsByLevel(level).map((u) => {
              const s = unitState(user, u.id);
              const n = UNITS.indexOf(u) + 1;
              return (
                <a key={u.id} className="list-item" href={href(`/unit/${u.id}`)} style={u.id === cur?.id ? { borderColor: 'var(--brand)' } : undefined}>
                  <span className={`unit-num ${s.status}`}>{s.status === 'done' ? <Icon name="check" size={18} /> : s.status === 'locked' ? <Icon name="lock" size={15} /> : n}</span>
                  <span className="grow">
                    <b>{u.title}</b>
                    <div className="small muted">{u.grammar.name}</div>
                  </span>
                  {s.status === 'done' && s.viaTestOut && <span className="chip good">Tested out</span>}
                  {s.status === 'done' && !s.viaTestOut && <span className="chip good">Done</span>}
                  {s.status === 'open' && u.id === cur?.id && <span className="chip brand">Up next</span>}
                  {s.status === 'open' && s.checked && <span className="chip ok">In progress</span>}
                </a>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
