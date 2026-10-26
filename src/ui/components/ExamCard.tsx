import { examPlan } from '../../engine/exam.ts';
import { overallSpeaking, toeflBandOf } from '../../engine/scoring.ts';
import { useApp } from '../../lib/store.tsx';
import type { Attempt } from '../../lib/types.ts';

const BANDS = [3, 3.5, 4, 4.5, 5, 5.5, 6];

/** TOEFL exam date and target: countdown, gap to target, weekly rhythm and a band chart. */
export function ExamCard({ history }: { history: Attempt[] }) {
  const { user, update } = useApp();
  const s = user.settings;
  const overall = overallSpeaking(user);
  const current = user.toeflBand ?? (overall != null ? toeflBandOf(overall) : null);
  const plan = examPlan(s.examDate, s.targetBand, current);
  const today = new Date();
  const minDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  return (
    <div className="card stack">
      <div className="spread">
        <h3 style={{ margin: 0 }}>My exam</h3>
        {plan.daysLeft != null && plan.daysLeft >= 0 && (
          <span className={`chip ${plan.daysLeft <= 14 ? 'bad' : plan.daysLeft <= 42 ? 'ok' : 'brand'}`}>
            {plan.daysLeft === 0 ? 'Today!' : `${plan.daysLeft} day${plan.daysLeft === 1 ? '' : 's'} to go`}
          </span>
        )}
      </div>
      <div className="grid grid-2">
        <label className="field">
          <span>Exam date</span>
          <input type="date" min={minDate} value={s.examDate ?? ''} onChange={(e) => update((u) => (u.settings.examDate = e.target.value || undefined))} />
        </label>
        <label className="field">
          <span>Target speaking band</span>
          <select value={s.targetBand ?? ''} onChange={(e) => update((u) => (u.settings.targetBand = e.target.value ? Number(e.target.value) : undefined))}>
            <option value="">Not set</option>
            {BANDS.map((b) => (
              <option key={b} value={b}>
                {b.toFixed(1)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {plan.target != null && current != null && (
        <div className="small">
          Now about <b>{current.toFixed(1)}</b>, target <b>{plan.target.toFixed(1)}</b>:{' '}
          {plan.gap! <= 0 ? <span style={{ color: 'var(--good)' }}>you're at or above your target. Keep it steady.</span> : <>{plan.gap!.toFixed(1)} band{plan.gap === 1 ? '' : 's'} to go.</>}
        </div>
      )}
      {plan.advice && <div className="banner info">{plan.advice}</div>}
      <BandChart history={history} target={s.targetBand} />
    </div>
  );
}

function BandChart({ history, target }: { history: Attempt[]; target?: number }) {
  const pts = history
    .map((h) => ({ at: h.at, band: (h.detail as { band?: number } | undefined)?.band }))
    .filter((p): p is { at: number; band: number } => p.band != null)
    .sort((a, b) => a.at - b.at);
  if (pts.length < 2) return <div className="small faint">Your band history appears here after two TOEFL practices.</div>;
  const W = 600;
  const H = 130;
  const t0 = pts[0].at;
  const t1 = pts[pts.length - 1].at || t0 + 1;
  const x = (t: number) => 24 + ((t - t0) / (t1 - t0 || 1)) * (W - 48);
  const y = (b: number) => 10 + ((6 - b) / 5) * (H - 30);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }} role="img" aria-label="TOEFL band over time">
      {[1, 2, 3, 4, 5, 6].map((b) => (
        <g key={b}>
          <line x1={24} x2={W - 24} y1={y(b)} y2={y(b)} stroke="var(--line)" />
          <text x={4} y={y(b) + 4} fontSize="10" fill="var(--faint)">
            {b}
          </text>
        </g>
      ))}
      {target != null && (
        <>
          <line x1={24} x2={W - 24} y1={y(target)} y2={y(target)} stroke="var(--good)" strokeDasharray="6 4" strokeWidth="2" />
          <text x={W - 24} y={y(target) - 4} fontSize="10" fill="var(--good)" textAnchor="end">
            target {target.toFixed(1)}
          </text>
        </>
      )}
      <polyline fill="none" stroke="var(--brand)" strokeWidth="2.5" points={pts.map((p) => `${x(p.at)},${y(p.band)}`).join(' ')} />
      {pts.map((p) => (
        <circle key={p.at} cx={x(p.at)} cy={y(p.band)} r="3.5" fill="var(--brand)">
          <title>
            {new Date(p.at).toLocaleDateString()}: {p.band.toFixed(1)}
          </title>
        </circle>
      ))}
    </svg>
  );
}
