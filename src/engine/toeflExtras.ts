/** Wrong-answer review, readiness, weekly numbers, calendar export and sound tracking for TOEFL. */
import { soundForPhoneme } from '../content/sounds.ts';
import type { Assessment } from '../speech/types.ts';
import type { PlanDay } from './toeflPlan.ts';
import { bandHistory, skillBand, type SkillData } from './toeflSkill.ts';
import { SECTIONS, type Section } from './toeflScale.ts';

const DAY = 86_400_000;

/** Monday of the week, as YYYY-MM-DD (local time). */
export function weekKey(at: number): string {
  const d = new Date(at);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const todayKey = (now = Date.now()) => {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** First review a day after the miss, then 3 days after a right answer; two right answers and it is learned. */
export const REVIEW_GAPS = [1, 3];

/** The next state of a review item after an answer, or null once it is learned. */
export function reviewNext<T extends { box: number; due: number }>(item: T, right: boolean, now = Date.now()): T | null {
  if (right) {
    const box = item.box + 1;
    if (box >= 2) return null;
    return { ...item, box, due: now + REVIEW_GAPS[box] * DAY };
  }
  return { ...item, box: 0, due: now + REVIEW_GAPS[0] * DAY };
}

export interface SkillReadiness {
  section: Section;
  band: number | null;
  lo: number | null;
  hi: number | null;
  /** How many results the estimate rests on. */
  points: number;
}

export type Verdict = 'ready' | 'close' | 'not-yet' | 'need-data';

const half = (x: number) => Math.min(6, Math.max(1, Math.round(x * 2) / 2));

/**
 * A predicted band per skill with a likely range (wider with fewer or more scattered results),
 * and a verdict against the goal: ready to book when every skill is at the target and even the
 * low end of the range clears the minimum.
 */
export function readiness(d: SkillData, toeflBand: number | null, target: number, minimum: number, now = Date.now()): { skills: SkillReadiness[]; verdict: Verdict } {
  const skills = SECTIONS.map((section): SkillReadiness => {
    const est = skillBand(d, section, toeflBand);
    if (!est) return { section, band: null, lo: null, hi: null, points: 0 };
    const recent = bandHistory(d, section)
      .filter((p) => now - p.at < 60 * DAY)
      .map((p) => p.band);
    // The current estimate counts as one more result.
    const values = [...recent, est.band];
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const sd = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length);
    const width = Math.max(values.length >= 3 ? 0.5 : 1, sd);
    return { section, band: est.band, lo: half(est.band - width), hi: half(est.band + width), points: recent.length };
  });
  let verdict: Verdict;
  if (skills.some((s) => s.band == null)) verdict = 'need-data';
  else if (skills.every((s) => s.band! >= target && s.lo! >= minimum)) verdict = 'ready';
  else if (skills.every((s) => s.band! >= minimum)) verdict = 'close';
  else verdict = 'not-yet';
  return { skills, verdict };
}

/** Plan days as an iCalendar file: one event per day at the given local time. */
export function planToIcs(plan: PlanDay[], start: Date, hour: number, minute: number): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
  const esc = (s: string) => s.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Speakly//TOEFL plan//EN', 'CALSCALE:GREGORIAN'];
  plan.forEach((day, k) => {
    const s = new Date(start);
    s.setDate(s.getDate() + k);
    s.setHours(hour, minute, 0, 0);
    const minutes = day.items.reduce((a, i) => a + i.minutes, 0);
    const e = new Date(s.getTime() + minutes * 60_000);
    lines.push(
      'BEGIN:VEVENT',
      `UID:speakly-toefl-${stamp(s)}-${k}@speakly`,
      `DTSTAMP:${stamp(new Date())}`,
      `DTSTART:${stamp(s)}`,
      `DTEND:${stamp(e)}`,
      `SUMMARY:${esc(`TOEFL practice (${minutes} min)`)}`,
      `DESCRIPTION:${esc(day.items.map((i) => `- ${i.label} (${i.minutes} min)`).join('\n'))}`,
      'END:VEVENT',
    );
  });
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

/** Phoneme accuracy per sound drill in one spoken answer (Azure only; empty otherwise). */
export function soundSamples(a: Assessment): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  for (const w of a.words) {
    if (w.error === 'Omission') continue;
    for (const p of w.phonemes ?? []) {
      const s = soundForPhoneme(p.phoneme);
      if (s) (out[s.id] ??= []).push(p.accuracy);
    }
  }
  return out;
}

/** Adds samples to running totals, halving old data so recent answers count more. */
export function addSoundSamples(store: Record<string, { sum: number; n: number }>, samples: Record<string, number[]>): void {
  for (const [id, xs] of Object.entries(samples)) {
    const cur = (store[id] ??= { sum: 0, n: 0 });
    if (cur.n > 80) {
      cur.sum /= 2;
      cur.n /= 2;
    }
    cur.sum += xs.reduce((a, b) => a + b, 0);
    cur.n += xs.length;
  }
}

/** Sounds averaging under 75 with at least 5 samples, weakest first. */
export function weakSounds(store: Record<string, { sum: number; n: number }>): { id: string; score: number }[] {
  return Object.entries(store)
    .filter(([, v]) => v.n >= 5 && v.sum / v.n < 75)
    .map(([id, v]) => ({ id, score: Math.round(v.sum / v.n) }))
    .sort((a, b) => a.score - b.score);
}

export const DAY_MS = DAY;
