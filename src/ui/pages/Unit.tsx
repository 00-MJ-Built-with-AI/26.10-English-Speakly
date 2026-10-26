import { soundById } from '../../content/sounds.ts';
import { unitById, UNITS } from '../../content/units.ts';
import { openUnit, unitState } from '../../engine/path.ts';
import { go, href } from '../../lib/router.ts';
import { useApp } from '../../lib/store.tsx';
import type { UnitPart } from '../../lib/types.ts';
import { Icon } from '../components/Icon.tsx';

const PART_INFO: Record<UnitPart, { title: string; what: string; icon: string }> = {
  pronunciation: { title: 'Pronunciation', what: 'Read sentences aloud clearly', icon: 'wave' },
  grammar: { title: 'Grammar in speech', what: 'Answer quick prompts using the grammar, without freezing', icon: 'bolt' },
  task: { title: 'Speaking task', what: 'Answer an open question fluently', icon: 'chat' },
};

export function UnitPage({ id }: { id: string }) {
  const { user, update } = useApp();
  const unit = unitById(id);
  if (!unit) return <p>Unit not found.</p>;
  const s = unitState(user, unit.id);
  const n = UNITS.indexOf(unit) + 1;
  const lessons: Record<UnitPart, { label: string; to: string }[]> = {
    pronunciation: [
      ...unit.sounds.map((sid) => ({ label: `Sound drill: ${soundById(sid)?.title ?? sid}`, to: `/practice/sounds/${sid}?unit=${unit.id}` })),
      { label: 'Shadow the unit sentences', to: `/practice/shadow?unit=${unit.id}` },
    ],
    grammar: [
      { label: `Grammar: ${unit.grammar.name}`, to: `/grammar/${unit.id}` },
      { label: 'Speak-fast drills', to: `/practice/fast?unit=${unit.id}` },
    ],
    task: [{ label: `Role-play: ${unit.roleplay.title}`, to: `/tutor?kind=unit&unit=${unit.id}` }],
  };
  const missing = (['pronunciation', 'grammar', 'task'] as UnitPart[]).filter((p) => !s.parts[p].passed);

  return (
    <div className="stack">
      <a href={href('/path')} className="small">
        ← Path
      </a>
      <div className="spread">
        <div>
          <div className="row">
            <span className="level-badge">{unit.level}</span>
            <span className="muted small">Unit {n}</span>
          </div>
          <h1 style={{ marginTop: 8 }}>{unit.title}</h1>
          <p className="muted">{unit.topic}</p>
        </div>
        {s.status === 'done' && <span className="chip good">{s.viaTestOut ? 'Tested out' : 'Done'}</span>}
      </div>

      {s.status === 'locked' ? (
        <div className="card">
          <p>This unit opens after the previous one. You can jump here if you are sure the earlier units are easy for you.</p>
          <button
            className="btn"
            onClick={() => {
              update((u) => openUnit(u, unit.id));
            }}
          >
            Jump to this unit
          </button>
        </div>
      ) : (
        <div className="card">
          <div className="spread">
            <div>
              <h2>{!s.checked ? 'Start with the unit check' : s.status === 'done' ? 'Unit complete' : `${missing.length} part${missing.length === 1 ? '' : 's'} to practise`}</h2>
              <p className="muted small">
                {!s.checked
                  ? 'About 3 minutes. If you already know this, you finish the unit right away.'
                  : s.status === 'done'
                    ? 'You can take the check again any time.'
                    : 'Do the lessons for the missed parts, then check those parts again.'}
              </p>
            </div>
            <button className={`btn ${s.status !== 'done' ? 'primary' : ''}`} onClick={() => go(`/unit/${unit.id}/check`)}>
              <Icon name="mic" size={18} /> {!s.checked ? 'Start check' : s.status === 'done' ? 'Retake check' : 'Check again'}
            </button>
          </div>
          {s.checked && (
            <div className="grid grid-3" style={{ marginTop: 12 }}>
              {(['pronunciation', 'grammar', 'task'] as UnitPart[]).map((p) => {
                const ps = s.parts[p];
                return (
                  <div key={p} className="soft">
                    <div className="spread">
                      <b>{PART_INFO[p].title}</b>
                      {ps.passed ? <span className="chip good">Passed</span> : ps.practiced ? <span className="chip brand">Practised</span> : <span className="chip bad">Practise</span>}
                    </div>
                    <div className="small muted">Best {ps.best}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-2">
        <div className="card">
          <h3>You will be able to</h3>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {unit.canDo.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <hr />
          <h3>Useful words</h3>
          <div className="row">
            {unit.vocab.map((v) => (
              <span key={v} className="chip">
                {v}
              </span>
            ))}
          </div>
        </div>
        <div className="card">
          <h3>Grammar</h3>
          <p>
            <b>{unit.grammar.name}</b>
          </p>
          <p className="muted small">{unit.grammar.note}</p>
          <a className="btn small" href={href(`/grammar/${unit.id}`)}>
            Practise the grammar
          </a>
        </div>
      </div>

      <div className="section">
        <div className="section-title">Lessons</div>
        {(['pronunciation', 'grammar', 'task'] as UnitPart[]).map((p) => (
          <div key={p} className="card">
            <div className="row" style={{ marginBottom: 8 }}>
              <span className="icon-tile">
                <Icon name={PART_INFO[p].icon} />
              </span>
              <div>
                <b>{PART_INFO[p].title}</b>
                <div className="small muted">{PART_INFO[p].what}</div>
              </div>
              {s.checked && !s.parts[p].passed && <span className="chip bad" style={{ marginLeft: 'auto' }}>Needed</span>}
            </div>
            {lessons[p].map((l) => (
              <a key={l.to} className="list-item" href={href(l.to)}>
                <span className="grow">{l.label}</span>
                <Icon name="next" size={18} />
              </a>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
