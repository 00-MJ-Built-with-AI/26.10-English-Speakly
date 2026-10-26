import type { Assessment } from '../speech/types.ts';
import type { Level, Skill, UserDoc } from '../lib/types.ts';

/** Score bands, same as the EF SET-style report the learner already has (0-100). */
export const BANDS: [Level, number, number][] = [
  ['A1', 0, 30],
  ['A2', 31, 40],
  ['B1', 41, 50],
  ['B2', 51, 60],
  ['C1', 61, 70],
  ['C2', 71, 100],
];

export const LEVEL_NAMES: Record<Level, string> = {
  A1: 'Beginner',
  A2: 'Elementary',
  B1: 'Intermediate',
  B2: 'Upper Intermediate',
  C1: 'Advanced',
  C2: 'Proficient',
};

export function cefrOf(score: number): Level {
  const s = Math.round(score);
  return (BANDS.find(([, lo, hi]) => s >= lo && s <= hi) ?? BANDS[0])[0];
}

/** Rough new-TOEFL band (1-6, halves) from a 0-100 speaking score. */
export function toeflBandOf(score: number): number {
  const s = Math.max(0, Math.min(100, score));
  // Band floors: A1 1, A2 2 (31), B1 3 (41), B2 4 (51), C1 5 (61), C2 6 (71+).
  const anchors: [number, number][] = [
    [0, 1],
    [31, 2],
    [41, 3],
    [51, 4],
    [61, 5],
    [76, 6],
  ];
  let band = 1;
  for (let i = 0; i < anchors.length; i++) {
    const [lo, b] = anchors[i];
    const next = anchors[i + 1];
    if (s >= lo) band = next ? b + (s - lo) / (next[0] - lo) : b;
  }
  return Math.min(6, Math.floor(band * 2) / 2);
}

const clamp = (x: number) => Math.max(0, Math.min(100, x));

/**
 * Fluency for this app = smooth speech AND starting quickly. The learner's main problem is
 * freezing before speaking, so the delay before the first word counts.
 */
export function fluencyScore(a: Assessment, expectQuickStart: boolean): number {
  const pace = clamp(((Math.min(a.wordsPerMinute, 160) - 40) / 110) * 100);
  const pauses = clamp(100 - a.longPauses * 15);
  let s = 0.5 * a.fluency + 0.3 * pace + 0.2 * pauses;
  if (expectQuickStart) {
    const startS = a.startDelayMs / 1000;
    const start = clamp(100 - Math.max(0, startS - 1.2) * 22);
    s = 0.75 * s + 0.25 * start;
  }
  return Math.round(clamp(s));
}

/** Moves a skill toward a new measurement; early measurements count more. */
export function blend(previous: number | null, measured: number, weight = 0.25): number {
  if (previous == null) return Math.round(measured);
  return Math.round(previous + (measured - previous) * weight);
}

/** Applies measured skill scores to the user (pronunciation/fluency only from real speech). */
export function applySkills(user: UserDoc, scores: Partial<Record<Skill, number>>, weight = 0.25): void {
  for (const [k, v] of Object.entries(scores) as [Skill, number][]) {
    if (v == null || Number.isNaN(v)) continue;
    user.skills[k] = blend(user.skills[k], v, weight);
  }
}

export function overallSpeaking(user: UserDoc): number | null {
  const vals = Object.values(user.skills).filter((v): v is number => v != null);
  if (!vals.length) return null;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

export function levelIndex(l: Level): number {
  return ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].indexOf(l);
}

/** Pass marks for each part of a unit check, rising with the level. */
export const PASS_MARK: Record<Level, { pron: number; fluency: number; startSeconds: number }> = {
  A1: { pron: 60, fluency: 45, startSeconds: 6 },
  A2: { pron: 65, fluency: 50, startSeconds: 5 },
  B1: { pron: 70, fluency: 55, startSeconds: 4 },
  B2: { pron: 74, fluency: 60, startSeconds: 3.5 },
  C1: { pron: 78, fluency: 65, startSeconds: 3 },
  C2: { pron: 82, fluency: 70, startSeconds: 2.5 },
};
