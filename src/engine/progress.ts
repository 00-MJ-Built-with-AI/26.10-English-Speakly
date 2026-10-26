import type { Attempt, Skill, UserDoc } from '../lib/types.ts';

export function dateKey(t: number = Date.now()): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function addPractice(user: UserDoc, seconds: number, at = Date.now()): void {
  if (seconds <= 0) return;
  const k = dateKey(at);
  user.daily[k] = Math.round((user.daily[k] ?? 0) + seconds);
}

/** Days in a row with any practice, counting today if done, else up to yesterday. */
export function streak(user: UserDoc, now = Date.now()): number {
  let n = 0;
  const day = new Date(now);
  if (!user.daily[dateKey(day.getTime())]) day.setDate(day.getDate() - 1);
  while (user.daily[dateKey(day.getTime())]) {
    n++;
    day.setDate(day.getDate() - 1);
  }
  return n;
}

export function bestStreak(user: UserDoc): number {
  const days = Object.keys(user.daily)
    .filter((k) => user.daily[k] > 0)
    .sort();
  let best = 0;
  let run = 0;
  let prev: number | undefined;
  for (const k of days) {
    const [y, m, d] = k.split('-').map(Number);
    const t = new Date(y, m - 1, d).getTime();
    run = prev != null && Math.round((t - prev) / 86_400_000) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = t;
  }
  return best;
}

export function minutesToday(user: UserDoc, now = Date.now()): number {
  return Math.round((user.daily[dateKey(now)] ?? 0) / 60);
}

export interface WeekStats {
  from: number;
  to: number;
  minutes: number;
  activeDays: number;
  sessions: number;
  skills: Record<Skill, { now: number; change: number }>;
  byKind: Record<string, number>;
}

const SK: Skill[] = ['pronunciation', 'fluency', 'grammar', 'vocabulary'];

/** Last 7 days vs. the 7 before, from the attempt history. */
export function weekStats(user: UserDoc, attempts: Attempt[], now = Date.now()): WeekStats {
  const to = now;
  const from = now - 7 * 86_400_000;
  const prevFrom = from - 7 * 86_400_000;
  let minutes = 0;
  let activeDays = 0;
  for (let i = 0; i < 7; i++) {
    const s = user.daily[dateKey(now - i * 86_400_000)] ?? 0;
    minutes += s / 60;
    if (s > 0) activeDays++;
  }
  const inWeek = attempts.filter((a) => a.at >= from && a.at <= to);
  const before = attempts.filter((a) => a.at >= prevFrom && a.at < from);
  const mean = (xs: Attempt[], k: Skill) => {
    const v = xs.map((a) => a.scores[k]).filter((x): x is number => x != null);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };
  const skills = {} as WeekStats['skills'];
  for (const k of SK) {
    const now = mean(inWeek, k) ?? user.skills[k] ?? 0;
    const was = mean(before, k);
    skills[k] = { now: Math.round(now), change: was == null ? 0 : Math.round(now - was) };
  }
  const byKind: Record<string, number> = {};
  for (const a of inWeek) byKind[a.kind] = (byKind[a.kind] ?? 0) + 1;
  return { from, to, minutes: Math.round(minutes), activeDays, sessions: inWeek.length, skills, byKind };
}

/** Points for the history chart: daily average of each skill. */
export function skillHistory(attempts: Attempt[], skill: Skill, days = 60, now = Date.now()): { day: string; value: number }[] {
  const cutoff = now - days * 86_400_000;
  const byDay = new Map<string, number[]>();
  for (const a of attempts) {
    const v = a.scores[skill];
    if (v == null || a.at < cutoff) continue;
    const k = dateKey(a.at);
    byDay.set(k, [...(byDay.get(k) ?? []), v]);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, vs]) => ({ day, value: Math.round(vs.reduce((x, y) => x + y, 0) / vs.length) }));
}
