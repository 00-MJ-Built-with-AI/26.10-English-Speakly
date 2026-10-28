import { useEffect, useMemo, useState } from 'react';
import type { WeeklyResult } from '../../../shared/tasks.ts';
import { SOUNDS } from '../../content/sounds.ts';
import { confirmedLevel, levelProgress, workingLevel } from '../../engine/path.ts';
import { bestStreak, dateKey, skillHistory, streak, weekStats } from '../../engine/progress.ts';
import { overallSpeaking, toeflBandOf } from '../../engine/scoring.ts';
import { LEARNED_BOX } from '../../engine/srs.ts';
import { aiTask } from '../../lib/api.ts';
import { href } from '../../lib/router.ts';
import { useApp } from '../../lib/store.tsx';
import { SKILLS, type Attempt, type Mistake, type Skill } from '../../lib/types.ts';
import { LEVELS } from '../../../shared/tasks.ts';
import { Icon } from '../components/Icon.tsx';
import { BaselineCompare } from '../components/Baseline.tsx';
import { ScoreRing, SKILL_COLORS, SKILL_LABELS } from '../components/ScoreRing.tsx';

export function ProgressPage() {
  const { user, repo } = useApp();
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [mistakes, setMistakes] = useState<Mistake[]>([]);
  const [weekly, setWeekly] = useState<WeeklyResult | null>(null);
  const [loadingWeekly, setLoadingWeekly] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    repo.list<Attempt>('attempts', { since: Date.now() - 90 * 86_400_000 }).then(setAttempts);
    repo.list<Mistake>('mistakes', { limit: 1000 }).then(setMistakes);
  }, [repo]);

  const overall = overallSpeaking(user);
  const week = useMemo(() => weekStats(user, attempts), [user, attempts]);
  const totalMin = Math.round(Object.values(user.daily).reduce((a, b) => a + b, 0) / 60);
  const weakSounds = SOUNDS.filter((s) => user.sounds[s.id] != null)
    .sort((a, b) => user.sounds[a.id] - user.sounds[b.id])
    .slice(0, 5);
  const learned = mistakes.filter((m) => m.box >= LEARNED_BOX).length;
  const dueNow = mistakes.filter((m) => m.box < LEARNED_BOX && m.due <= Date.now()).length;

  async function writeWeekly() {
    setLoadingWeekly(true);
    setError(null);
    try {
      const top = mistakes
        .filter((m) => m.at >= week.from && m.kind !== 'pronunciation')
        .slice(0, 8)
        .map((m) => `${m.said} → ${m.better}`);
      setWeekly(
        await aiTask('weekly', {
          level: workingLevel(user),
          minutes: week.minutes,
          activeDays: week.activeDays,
          skills: week.skills,
          topMistakes: top,
          weakSounds: weakSounds.map((s) => s.title),
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingWeekly(false);
    }
  }

  return (
    <div className="stack">
      <h1>Progress</h1>
      <div className="card">
        <div className="grid grid-4">
          {SKILLS.map((k) => (
            <ScoreRing key={k} value={user.skills[k]} color={SKILL_COLORS[k]} label={SKILL_LABELS[k]} />
          ))}
        </div>
        <hr />
        <div className="grid grid-3">
          <Stat label="Overall speaking" value={overall != null ? String(overall) : '–'} />
          <Stat label="TOEFL speaking (est.)" value={user.toeflBand != null ? `${user.toeflBand.toFixed(1)} / 6` : overall != null ? `${toeflBandOf(overall).toFixed(1)} / 6` : '–'} />
          <Stat label="Confirmed level" value={confirmedLevel(user) ?? 'Not yet'} hint="Every unit up to this level is done" />
        </div>
      </div>

      <BaselineCompare />

      <div className="card">
        <h3>Skills over time</h3>
        <Chart attempts={attempts} />
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3>This week</h3>
          <div className="grid grid-2">
            <Stat label="Minutes" value={String(week.minutes)} />
            <Stat label="Active days" value={`${week.activeDays} / 7`} />
            <Stat label="Streak" value={`${streak(user)} day${streak(user) === 1 ? "" : "s"}`} hint={`Best ${bestStreak(user)}`} />
            <Stat label="All time" value={`${totalMin} min`} />
          </div>
          <hr />
          {SKILLS.map((k) => (
            <div key={k} className="spread small" style={{ padding: '3px 0' }}>
              <span>{SKILL_LABELS[k]}</span>
              <span>
                {week.skills[k].now || '–'}{' '}
                {week.skills[k].change !== 0 && (
                  <span style={{ color: week.skills[k].change > 0 ? 'var(--good)' : 'var(--bad)' }}>
                    {week.skills[k].change > 0 ? '+' : ''}
                    {week.skills[k].change}
                  </span>
                )}
              </span>
            </div>
          ))}
          <hr />
          {weekly ? (
            <div className="stack">
              <b>{weekly.headline}</b>
              <p className="small">{weekly.body}</p>
              <ul className="small" style={{ margin: 0 }}>
                {weekly.focus.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>
          ) : (
            <button className="btn small" onClick={writeWeekly} disabled={loadingWeekly}>
              {loadingWeekly ? 'Writing…' : 'Write my weekly report'}
            </button>
          )}
          {error && <div className="banner error">{error}</div>}
        </div>
        <div className="card">
          <h3>Practice calendar</h3>
          <Heatmap daily={user.daily} goal={user.settings.dailyGoalMinutes} />
          <hr />
          <h3>Mistake bank</h3>
          <p className="small">
            {mistakes.length} saved · {learned} learned · {dueNow} due now
          </p>
          <a className="btn small" href={href('/review')}>
            Review now
          </a>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3>Path</h3>
          {LEVELS.map((l) => {
            const p = levelProgress(user, l);
            return (
              <div key={l} style={{ marginBottom: 8 }}>
                <div className="spread small">
                  <b>{l}</b>
                  <span className="muted">
                    {p.done}/{p.total}
                  </span>
                </div>
                <div className="bar">
                  <span style={{ width: `${(p.done / p.total) * 100}%`, background: p.done === p.total ? 'var(--good)' : undefined }} />
                </div>
              </div>
            );
          })}
        </div>
        <div className="card">
          <h3>Sounds to work on</h3>
          {weakSounds.length ? (
            weakSounds.map((s) => (
              <a key={s.id} className="list-item" href={href(`/practice/sounds/${s.id}`)}>
                <span className="grow">{s.title}</span>
                <span className={`chip ${user.sounds[s.id] >= 80 ? 'good' : user.sounds[s.id] >= 60 ? 'ok' : 'bad'}`}>{Math.round(user.sounds[s.id])}</span>
              </a>
            ))
          ) : (
            <p className="small muted">Do a few sound drills or conversations and your weakest sounds will show here.</p>
          )}
          <hr />
          <div className="row">
            <a className="btn" href={href('/recordings')}>
              <Icon name="play" size={16} /> My recordings
            </a>
            <a className="btn" href={href('/practice/fillers')}>
              <Icon name="wave" size={16} /> Fillers and pauses
            </a>
            <a className="btn" href={href('/report')}>
              <Icon name="book" size={16} /> Progress report (PDF)
            </a>
            {user.settings.showGamification && (
              <a className="btn" href={href('/achievements')}>
                <Icon name="trophy" size={16} /> Achievements
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <div className="small muted">{label}</div>
      <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>{value}</div>
      {hint && <div className="small faint">{hint}</div>}
    </div>
  );
}

/** Line chart of daily skill averages over the last 60 days. */
function Chart({ attempts }: { attempts: Attempt[] }) {
  const series = SKILLS.map((k) => ({ k, pts: skillHistory(attempts, k, 60) }));
  const days = [...new Set(series.flatMap((s) => s.pts.map((p) => p.day)))].sort();
  if (days.length < 2) return <p className="small muted">Your chart appears after a couple of days of practice.</p>;
  const W = 640;
  const H = 200;
  const pad = 28;
  const x = (d: string) => pad + (days.indexOf(d) / (days.length - 1)) * (W - pad * 2);
  const y = (v: number) => H - pad - (v / 100) * (H - pad * 2);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }} role="img" aria-label="Skill scores over time">
        {[0, 25, 50, 75, 100].map((v) => (
          <g key={v}>
            <line x1={pad} x2={W - pad} y1={y(v)} y2={y(v)} stroke="var(--line)" />
            <text x={4} y={y(v) + 4} fontSize="10" fill="var(--faint)">
              {v}
            </text>
          </g>
        ))}
        {series.map(({ k, pts }) =>
          pts.length ? (
            <g key={k}>
              <polyline fill="none" stroke={SKILL_COLORS[k as Skill]} strokeWidth="2.5" strokeLinejoin="round" points={pts.map((p) => `${x(p.day)},${y(p.value)}`).join(' ')} />
              {pts.map((p) => (
                <circle key={p.day} cx={x(p.day)} cy={y(p.value)} r="3" fill={SKILL_COLORS[k as Skill]}>
                  <title>
                    {SKILL_LABELS[k as Skill]} {p.value} on {p.day}
                  </title>
                </circle>
              ))}
            </g>
          ) : null,
        )}
      </svg>
      <div className="row small">
        {SKILLS.map((k) => (
          <span key={k} className="row" style={{ gap: 4 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: SKILL_COLORS[k] }} /> {SKILL_LABELS[k]}
          </span>
        ))}
      </div>
    </div>
  );
}

function Heatmap({ daily, goal }: { daily: Record<string, number>; goal: number }) {
  const cells = [];
  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - (7 * 12 - 1) - today.getDay());
  for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
    const m = (daily[dateKey(d.getTime())] ?? 0) / 60;
    const lvl = m <= 0 ? '' : m < goal / 2 ? 'l1' : m < goal ? 'l2' : 'l3';
    cells.push(<span key={d.toISOString()} className={lvl} title={`${d.toLocaleDateString()}: ${Math.round(m)} min`} />);
  }
  return (
    <div style={{ overflowX: 'auto' }}>
      <div className="heat">{cells}</div>
    </div>
  );
}
