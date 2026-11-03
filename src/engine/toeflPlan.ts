import { comparableTotal, overallBand, SECTION_LABELS, SECTIONS, totalRange, type Section, type ToeflScore } from './toeflScale.ts';

/** Accuracy per question type, from practice. */
export type TypeStats = Record<string, { right: number; total: number }>;

export interface SectionGap {
  section: Section;
  /** Bands (1-6). */
  now: number;
  target: number;
  gap: number;
}

export interface GapAnalysis {
  overall: number;
  /** Comparable 0-120 total, shown alongside the band. */
  total: number;
  target: number;
  minimum: number;
  meetsMinimum: boolean;
  meetsTarget: boolean;
  sections: SectionGap[];
  /** Sections in the order to work on (largest gap first). */
  focus: Section[];
}

/** How far section bands are from the target band; every section aims at the target. */
export function analyzeBands(bands: Record<Section, number>, target: number, minimum: number, total?: number): GapAnalysis {
  const overall = overallBand(bands);
  const sections = SECTIONS.map((section) => ({ section, now: bands[section], target, gap: Math.max(0, target - bands[section]) }));
  const focus = [...sections].sort((a, b) => b.gap - a.gap || a.now - b.now).map((s) => s.section);
  return {
    overall,
    total: total ?? comparableTotal({ bands } as ToeflScore),
    target,
    minimum,
    meetsMinimum: overall >= minimum,
    meetsTarget: overall >= target,
    sections,
    focus,
  };
}

export function analyzeGap(score: ToeflScore, target: number, minimum: number): GapAnalysis {
  return analyzeBands(score.bands, target, minimum, comparableTotal(score));
}

export interface PlanItem {
  label: string;
  to: string;
  minutes: number;
}

export interface PlanDay {
  day: number;
  items: PlanItem[];
}

/** Practice for each skill, rotated through by the plan. */
export const SKILL_TASKS: Record<Section, PlanItem[]> = {
  reading: [
    { label: 'Reading: Complete the Words', to: '/toefl/reading/practice?task=complete', minutes: 6 },
    { label: 'Reading: academic vocabulary', to: '/toefl/reading/vocab', minutes: 5 },
    { label: 'Reading: Academic Passage', to: '/toefl/reading/practice?task=academic', minutes: 10 },
    { label: 'Reading: paraphrase matching', to: '/toefl/reading/paraphrase', minutes: 5 },
    { label: 'Reading: Read in Daily Life', to: '/toefl/reading/practice?task=daily', minutes: 6 },
    { label: 'Reading: speed and comprehension', to: '/toefl/reading/speed', minutes: 8 },
    { label: 'Reading: word-ending spelling', to: '/toefl/reading/spelling', minutes: 5 },
  ],
  listening: [
    { label: 'Listening: Choose a Response', to: '/toefl/listening/practice?task=response', minutes: 6 },
    { label: 'Listening: dictation', to: '/toefl/listening/dictation', minutes: 6 },
    { label: 'Listening: Conversation', to: '/toefl/listening/practice?task=conversation', minutes: 6 },
    { label: 'Listening: implied meaning', to: '/toefl/listening/implied', minutes: 5 },
    { label: 'Listening: Academic Talk', to: '/toefl/listening/practice?task=talk', minutes: 8 },
    { label: 'Listening: note-taking', to: '/toefl/listening/notes', minutes: 10 },
    { label: 'Listening: Announcement', to: '/toefl/listening/practice?task=announcement', minutes: 5 },
  ],
  writing: [
    { label: 'Writing: Build a Sentence', to: '/toefl/writing/practice?task=build', minutes: 6 },
    { label: 'Writing: Write an Email', to: '/toefl/writing/practice?task=email', minutes: 10 },
    { label: 'Writing: grammar drills', to: '/toefl/writing/grammar', minutes: 6 },
    { label: 'Writing: Academic Discussion', to: '/toefl/writing/practice?task=discussion', minutes: 13 },
    { label: 'Writing: your error patterns', to: '/toefl/writing/errors', minutes: 5 },
    { label: 'Writing: phrase bank drill', to: '/toefl/writing/phrases', minutes: 5 },
    { label: 'Writing: 1-minute essay planner', to: '/toefl/writing/planner', minutes: 12 },
    { label: 'Writing: email tone trainer', to: '/toefl/writing/tone', minutes: 5 },
  ],
  speaking: [
    { label: 'Speaking: Listen and Repeat', to: '/toefl/repeat', minutes: 5 },
    { label: 'Speaking: answer structure coach', to: '/toefl/speaking/coach', minutes: 8 },
    { label: 'Speaking: long-sentence repeat', to: '/toefl/speaking/long', minutes: 6 },
    { label: 'Speaking: interview topic bank', to: '/toefl/speaking/bank', minutes: 8 },
    { label: 'Speaking: Take an Interview', to: '/toefl/interview', minutes: 6 },
    { label: 'Speaking: 15-second quick answers', to: '/toefl/speaking/quick', minutes: 3 },
  ],
};

export const SECTION_TEST: Record<Section, PlanItem> = {
  reading: { label: 'Reading section test', to: '/toefl/reading/test', minutes: 20 },
  listening: { label: 'Listening section test', to: '/toefl/listening/test', minutes: 20 },
  writing: { label: 'Writing section test', to: '/toefl/writing/test', minutes: 25 },
  speaking: { label: 'Speaking section test', to: '/toefl/mock', minutes: 8 },
};

/** Days since 2026-01-04 (a Sunday), so the weekly full mock falls on Saturday and the section test on Wednesday. */
export const planOffset = (now = Date.now()) => Math.floor((now - Date.UTC(2026, 0, 4)) / 86_400_000);

/** Question types whose accuracy is below 70% with enough data, weakest first. */
export function weakTypes(stats: TypeStats, min = 4): string[] {
  return Object.entries(stats)
    .filter(([, s]) => s.total >= min && s.right / s.total < 0.7)
    .sort((a, b) => a[1].right / a[1].total - b[1].right / b[1].total)
    .map(([t]) => t);
}

/**
 * A daily plan until the exam (at most 14 days shown) of about `perDay` minutes. `offset` is the
 * number of days since a fixed start, so day 1 is always today and the rotation moves on each day. Sections with the
 * biggest band gap come up most often; day 4 of each week is a section test of the weakest section,
 * day 7 a full mock, and the day before the exam is light.
 */
export function buildPlan(gap: GapAnalysis, daysLeft: number | null, perDay = 50, offset = 0): PlanDay[] {
  const days = Math.max(1, Math.min(14, daysLeft ?? 14));
  // Each half band of gap adds one more turn in the rotation.
  const weight = (s: Section) => 1 + Math.round((gap.sections.find((x) => x.section === s)?.gap ?? 0) * 2);
  const order: Section[] = [];
  for (const s of gap.focus) for (let k = 0; k < Math.min(5, weight(s)); k++) order.push(s);
  const used: Record<Section, number> = { reading: offset, listening: offset, writing: offset, speaking: offset };
  const plan: PlanDay[] = [];
  let k = offset * 3;
  for (let d = 1; d <= days; d++) {
    const a = d + offset;
    if (daysLeft != null && d === daysLeft) {
      plan.push({ day: d, items: [{ label: 'Light review and rest before the exam', to: '/toefl/repeat', minutes: 10 }] });
      continue;
    }
    if (a % 7 === 0) {
      plan.push({ day: d, items: [{ label: 'Full mock test', to: '/toefl/full-mock', minutes: 75 }] });
      continue;
    }
    const items: PlanItem[] = [];
    let minutes = 0;
    if (a % 7 === 4) {
      const t = SECTION_TEST[gap.focus[0]];
      items.push(t);
      minutes += t.minutes;
    }
    let guard = 0;
    while (minutes < perDay - 3 && guard++ < 50) {
      const s = order[k++ % order.length];
      const t = SKILL_TASKS[s][used[s]++ % SKILL_TASKS[s].length];
      if (items.some((x) => x.to === t.to)) continue;
      items.push(t);
      minutes += t.minutes;
    }
    plan.push({ day: d, items });
  }
  return plan;
}

const b = (n: number) => n.toFixed(1);

export function gapSummary(g: GapAnalysis): string {
  const [lo, hi] = totalRange(g.target);
  if (g.meetsTarget) return `Band ${b(g.overall)} (about ${g.total}/120) meets your target of ${b(g.target)}.`;
  const need = g.target - g.overall;
  const top = g.focus.filter((s) => (g.sections.find((x) => x.section === s)?.gap ?? 0) > 0).map((s) => SECTION_LABELS[s]);
  return `Band ${b(g.overall)} now (about ${g.total}/120). Target ${b(g.target)} (${lo}-${hi}/120): ${b(need)} band${need === 1 ? '' : 's'} to go${g.meetsMinimum ? `; you already meet your minimum of ${b(g.minimum)}` : `; minimum ${b(g.minimum)}`}. Most to gain in: ${top.join(', ') || 'all sections evenly'}.`;
}
