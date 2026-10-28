import { useState } from 'react';
import { cefrOf, overallSpeaking } from '../../engine/scoring.ts';
import { useApp } from '../../lib/store.tsx';
import type { Baseline } from '../../lib/types.ts';

const FIELDS: [keyof Baseline, string][] = [
  ['reading', 'Reading'],
  ['listening', 'Listening'],
  ['writing', 'Writing'],
  ['speaking', 'Speaking'],
];

/** Enter scores from an earlier test (0-100, like EF SET) to compare with later. */
export function BaselineForm({ onSaved }: { onSaved?: () => void }) {
  const { user, update } = useApp();
  const [b, setB] = useState<Baseline>(user.baseline ?? { test: 'EF SET', date: '' });
  const num = (v: string) => (v === '' ? undefined : Math.max(0, Math.min(100, Number(v))));
  return (
    <div className="stack">
      <div className="grid grid-2">
        <label className="field">
          <span>Test</span>
          <input type="text" value={b.test} onChange={(e) => setB({ ...b, test: e.target.value })} />
        </label>
        <label className="field">
          <span>When (month and year)</span>
          <input type="month" value={b.date} onChange={(e) => setB({ ...b, date: e.target.value })} />
        </label>
      </div>
      <div className="grid grid-4">
        {FIELDS.map(([k, label]) => (
          <label key={k} className="field">
            <span>{label}</span>
            <input type="number" min={0} max={100} placeholder="0-100" value={(b[k] as number | undefined) ?? ''} onChange={(e) => setB({ ...b, [k]: num(e.target.value) })} />
          </label>
        ))}
      </div>
      <div className="row">
        <button
          className="btn primary"
          disabled={b.speaking == null}
          onClick={() => {
            update((u) => (u.baseline = b));
            onSaved?.();
          }}
        >
          Save scores
        </button>
        {user.baseline && (
          <button className="btn ghost small danger" onClick={() => update((u) => delete u.baseline)}>
            Remove
          </button>
        )}
      </div>
      <div className="small faint">Scores on a 0-100 scale, like an EF SET certificate. At least the speaking score is needed to compare.</div>
    </div>
  );
}

/** Then vs now: the earlier speaking score next to today's overall speaking score. */
export function BaselineCompare() {
  const { user } = useApp();
  const b = user.baseline;
  if (!b || b.speaking == null) return null;
  const now = overallSpeaking(user);
  const when = b.date ? new Date(`${b.date}-01`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : 'earlier';
  const d = now != null ? now - b.speaking : null;
  return (
    <div className="card stack">
      <h3 style={{ margin: 0 }}>Since your {b.test || 'earlier test'}</h3>
      <div className="grid grid-3">
        <div>
          <div className="small muted">Speaking, {when}</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800 }}>
            {b.speaking} <span className="small muted">{cefrOf(b.speaking)}</span>
          </div>
        </div>
        <div>
          <div className="small muted">Speaking now</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800 }}>
            {now ?? '–'} {now != null && <span className="small muted">{cefrOf(now)}</span>}
          </div>
        </div>
        <div>
          <div className="small muted">Change</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: d == null ? undefined : d > 0 ? 'var(--good)' : d < 0 ? 'var(--bad)' : undefined }}>{d == null ? '–' : `${d > 0 ? '+' : ''}${d}`}</div>
        </div>
      </div>
      <div className="row small">
        {FIELDS.filter(([k]) => k !== 'speaking' && b[k] != null).map(([k, label]) => (
          <span key={k} className="chip">
            {label} then: {b[k] as number} {cefrOf(b[k] as number)}
          </span>
        ))}
      </div>
      <p className="small faint" style={{ margin: 0 }}>
        A rough comparison: Speakly's speaking score uses the same 0-100 and CEFR bands, but it is a different test.
      </p>
    </div>
  );
}
