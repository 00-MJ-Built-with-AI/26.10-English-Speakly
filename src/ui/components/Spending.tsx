import { dateKey } from '../../engine/progress.ts';
import { href } from '../../lib/router.ts';
import { useApp } from '../../lib/store.tsx';
import { dayTotal } from '../../lib/usage.ts';
import type { UsageDay } from '../../lib/types.ts';

const usd = (v: number) => (v < 0.01 && v > 0 ? '<$0.01' : `$${v.toFixed(2)}`);

function monthTotals(usage: Record<string, UsageDay>): { ai: number; speech: number } {
  const prefix = dateKey().slice(0, 7);
  return Object.entries(usage)
    .filter(([k]) => k.startsWith(prefix))
    .reduce((t, [, d]) => ({ ai: t.ai + d.ai, speech: t.speech + d.speech }), { ai: 0, speech: 0 });
}

/** Estimated spending with the daily limit and the price assumptions behind it. */
export function SpendingCard() {
  const { user, update, status } = useApp();
  const today = user.usage[dateKey()];
  const month = monthTotals(user.usage);
  const cap = user.settings.dailyCapUsd;
  const spent = dayTotal(today);
  const r = user.settings.rates;
  const setRate = (k: keyof typeof r, v: number) => update((u) => (u.settings.rates = { ...u.settings.rates, [k]: v }));
  return (
    <div className="card stack">
      <h3 style={{ margin: 0 }}>Spending (estimate)</h3>
      <div className="grid grid-3">
        <div>
          <div className="small muted">Today</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>{usd(spent)}</div>
          <div className="small faint">
            tutor {usd(today?.ai ?? 0)} · speech {usd(today?.speech ?? 0)}
          </div>
        </div>
        <div>
          <div className="small muted">This month</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>{usd(month.ai + month.speech)}</div>
          <div className="small faint">
            tutor {usd(month.ai)} · speech {usd(month.speech)}
          </div>
        </div>
        <label className="field">
          <span>Daily limit ($)</span>
          <input type="number" min={0} step={0.25} value={cap} onChange={(e) => update((u) => (u.settings.dailyCapUsd = Math.max(0, Number(e.target.value) || 0)))} />
          <div className="small faint">0 = no limit</div>
        </label>
      </div>
      {cap > 0 && (
        <div className="bar">
          <span style={{ width: `${Math.min(100, (spent / cap) * 100)}%`, background: spent >= cap ? 'var(--bad)' : spent >= cap * 0.8 ? 'var(--ok)' : undefined }} />
        </div>
      )}
      <p className="small muted" style={{ margin: 0 }}>
        When today's limit is reached, the AI tutor pauses until tomorrow and speech switches to your browser's free voice and recognition, so drills keep working. The limit is enforced by this app; for a hard stop,
        also set a spend limit in the Anthropic console and a budget in Azure.
        {!status.tutor && !status.speech && ' Nothing is spent in test mode.'}
      </p>
      <details>
        <summary className="small">Price assumptions</summary>
        <p className="small muted">
          AI tutor costs come from the token counts Anthropic reports ({status.model || 'default model'}, list prices). Azure prices vary by region and plan, so these are editable estimates; check your Azure
          price list.
        </p>
        <div className="grid grid-3">
          <label className="field small">
            <span>Recognition $/hour</span>
            <input type="number" min={0} step={0.1} value={r.sttPerHour} onChange={(e) => setRate('sttPerHour', Number(e.target.value) || 0)} />
          </label>
          <label className="field small">
            <span>Voice $/1M chars</span>
            <input type="number" min={0} step={1} value={r.ttsPerMillion} onChange={(e) => setRate('ttsPerMillion', Number(e.target.value) || 0)} />
          </label>
          <label className="field small">
            <span>HD voice $/1M chars</span>
            <input type="number" min={0} step={1} value={r.hdTtsPerMillion} onChange={(e) => setRate('hdTtsPerMillion', Number(e.target.value) || 0)} />
          </label>
        </div>
      </details>
    </div>
  );
}

/** Warning on Today when spending is near or over the daily limit. */
export function SpendingBanner() {
  const { user } = useApp();
  const cap = user.settings.dailyCapUsd;
  const spent = dayTotal(user.usage[dateKey()]);
  if (!cap || spent < cap * 0.8) return null;
  return (
    <a className={`banner ${spent >= cap ? 'error' : ''}`} href={href('/settings')}>
      {spent >= cap
        ? `Today's spending limit (${usd(cap)}) is reached: the AI tutor is paused until tomorrow and speech uses your browser's free voice. Free drills still work.`
        : `You've used ${usd(spent)} of today's ${usd(cap)} limit.`}
    </a>
  );
}
