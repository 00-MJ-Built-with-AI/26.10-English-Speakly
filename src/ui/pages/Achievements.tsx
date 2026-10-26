import { ACHIEVEMENTS, levelFromXp } from '../../engine/gamification.ts';
import { useApp } from '../../lib/store.tsx';
import { Icon } from '../components/Icon.tsx';

export function Achievements() {
  const { user } = useApp();
  const lv = levelFromXp(user.xp);
  const unlocked = ACHIEVEMENTS.filter((a) => user.achievements[a.id]).length;
  return (
    <div className="stack">
      <h1>Achievements</h1>
      <div className="card stack">
        <div className="spread">
          <div className="row">
            <span className="level-badge" style={{ fontSize: '1.3rem' }}>
              Lv {lv.level}
            </span>
            <div>
              <b>{user.xp} XP</b>
              <div className="small muted">
                {lv.to - user.xp} XP to level {lv.level + 1}
              </div>
            </div>
          </div>
          <span className="chip brand">
            {unlocked} / {ACHIEVEMENTS.length} badges
          </span>
        </div>
        <div className="bar">
          <span style={{ width: `${((user.xp - lv.from) / (lv.to - lv.from)) * 100}%` }} />
        </div>
        <div className="small faint">5 XP per minute of practice, bonuses for conversations, journal entries, TOEFL practice and unit checks, and 50 XP for each unit you finish.</div>
      </div>
      <div className="grid grid-3">
        {ACHIEVEMENTS.map((a) => {
          const at = user.achievements[a.id];
          const p = !at && a.progress ? a.progress(user) : null;
          return (
            <div key={a.id} className="card" style={{ opacity: at ? 1 : 0.65, marginTop: 0 }}>
              <div className="row">
                <span className="icon-tile" style={at ? { background: 'linear-gradient(135deg, var(--pron), var(--flu))', color: '#fff' } : undefined}>
                  <Icon name={at ? a.icon : 'lock'} />
                </span>
                <div style={{ minWidth: 0 }}>
                  <b>{a.title}</b>
                  <div className="small muted">{a.desc}</div>
                </div>
              </div>
              {at ? (
                <div className="small faint" style={{ marginTop: 8 }}>
                  Unlocked {new Date(at).toLocaleDateString()}
                </div>
              ) : p ? (
                <div style={{ marginTop: 10 }}>
                  <div className="bar">
                    <span style={{ width: `${(p[0] / p[1]) * 100}%` }} />
                  </div>
                  <div className="small faint" style={{ marginTop: 4 }}>
                    {p[0]} / {p[1]}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
