import type { HesitationStats } from '../../engine/hesitation.ts';

/** Compact hesitation summary for one answer or session. */
export function HesitationChips({ h, showStart = true }: { h: HesitationStats; showStart?: boolean }) {
  const tone = (good: boolean, ok: boolean) => (good ? 'good' : ok ? 'ok' : 'bad');
  return (
    <div className="row">
      <span className={`chip ${tone(h.score >= 80, h.score >= 60)}`}>Smoothness {h.score}</span>
      <span className={`chip ${tone(h.perMinute <= 2, h.perMinute <= 5)}`}>{h.perMinute} hesitations/min</span>
      {h.fillers > 0 && <span className="chip">{h.fillers} um/uh</span>}
      {h.repeats > 0 && <span className="chip">{h.repeats} restart{h.repeats === 1 ? '' : 's'}</span>}
      {h.longPauses > 0 && <span className="chip">{h.longPauses} long pause{h.longPauses === 1 ? '' : 's'}</span>}
      {h.crutches > 0 && <span className="chip">{h.crutches} "you know / like"</span>}
      {showStart && <span className={`chip ${tone(h.startDelayMs < 2000, h.startDelayMs < 4000)}`}>Start {(h.startDelayMs / 1000).toFixed(1)} s</span>}
      {h.wordsPerMinute > 0 && <span className="chip">{h.wordsPerMinute} words/min</span>}
    </div>
  );
}
