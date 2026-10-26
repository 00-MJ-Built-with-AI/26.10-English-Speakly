import { cefrOf, LEVEL_NAMES } from '../../engine/scoring.ts';

/** Circular 0-100 score, like the score report the learner already knows. */
export function ScoreRing({ value, color, size = 96, label, showLevel = true }: { value: number | null; color: string; size?: number; label?: string; showLevel?: boolean }) {
  const r = size / 2 - 6;
  const c = 2 * Math.PI * r;
  const v = value == null ? 0 : Math.max(0, Math.min(100, value));
  return (
    <div className="ring-card">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${label ?? 'score'} ${value ?? 'not measured yet'}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={5} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray={`${(v / 100) * c} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
        <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fontSize={size * 0.3} fontWeight={800} fill={color}>
          {value == null ? '–' : Math.round(value)}
        </text>
      </svg>
      {label && <div className="label">{label}</div>}
      {showLevel && value != null && (
        <div className="level">
          <b>{cefrOf(value)}</b> {LEVEL_NAMES[cefrOf(value)]}
        </div>
      )}
      {showLevel && value == null && <div className="level faint">Not measured yet</div>}
    </div>
  );
}

export const SKILL_COLORS = {
  pronunciation: 'var(--pron)',
  fluency: 'var(--flu)',
  grammar: 'var(--gram)',
  vocabulary: 'var(--voc)',
} as const;

export const SKILL_LABELS = {
  pronunciation: 'Pronunciation',
  fluency: 'Fluency',
  grammar: 'Grammar',
  vocabulary: 'Vocabulary',
} as const;
