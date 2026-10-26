import { UNITS } from '../../content/units.ts';
import { unitState } from '../../engine/path.ts';
import { href } from '../../lib/router.ts';
import { useApp } from '../../lib/store.tsx';
import { LEVELS } from '../../../shared/tasks.ts';
import { Icon } from '../components/Icon.tsx';

export function Roleplays() {
  const { user } = useApp();
  return (
    <div>
      <h1>Role-plays</h1>
      <p className="muted">Real situations from work and daily life. The tutor plays the other person; you get a full report at the end.</p>
      {LEVELS.map((level) => (
        <section key={level} className="section">
          <div className="section-title">{level}</div>
          <div className="grid grid-2">
            {UNITS.filter((u) => u.level === level).map((u) => {
              const locked = unitState(user, u.id).status === 'locked';
              return (
                <a key={u.id} className="list-item" href={href(`/tutor?kind=roleplay&unit=${u.id}`)} style={{ marginTop: 0, opacity: locked ? 0.75 : 1 }}>
                  <span className="icon-tile">
                    <Icon name="users" />
                  </span>
                  <span className="grow">
                    <b>{u.roleplay.title}</b>
                    <div className="small muted">
                      You: {u.roleplay.userRole}. Goal: {u.roleplay.userGoal}.
                    </div>
                  </span>
                </a>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
