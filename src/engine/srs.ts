import type { Mistake } from '../lib/types.ts';

const DAY = 86_400_000;
/** Days until the next review for each box (Leitner). Box 6 = learned. */
export const INTERVALS = [0, 1, 3, 7, 14, 30];
export const LEARNED_BOX = 6;

export function newMistake(m: Pick<Mistake, 'kind' | 'said' | 'better' | 'why' | 'source'>, now = Date.now()): Mistake {
  return { ...m, at: now, box: 0, due: now, reps: 0, lapses: 0 };
}

export interface SrsFields {
  box: number;
  due: number;
  reps: number;
  lapses: number;
}

/** After a review: right moves it up a box, wrong sends it back to box 1 (tomorrow). */
export function review<T extends SrsFields>(m: T, correct: boolean, now = Date.now()): T {
  if (correct) {
    const box = Math.min(LEARNED_BOX, m.box + 1);
    const days = box >= LEARNED_BOX ? 3650 : INTERVALS[box];
    return { ...m, box, reps: m.reps + 1, due: startOfDay(now) + days * DAY };
  }
  return { ...m, box: 1, reps: m.reps + 1, lapses: m.lapses + 1, due: startOfDay(now) + DAY };
}

export function startOfDay(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Same mistake already in the bank? Compare the corrected forms loosely. */
export function sameMistake(a: Pick<Mistake, 'better' | 'said'>, b: Pick<Mistake, 'better' | 'said'>): boolean {
  const n = (s: string) => s.toLowerCase().replace(/[^a-z' ]/g, '').trim();
  return n(a.better) === n(b.better) || (n(a.said) === n(b.said) && n(a.said).length > 0);
}
