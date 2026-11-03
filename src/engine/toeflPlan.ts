import { comparableTotal, SECTION_LABELS, SECTIONS, section30FromBand, type Section, type ToeflScore } from './toeflScale.ts';

/** Accuracy per question type, from practice. */
export type TypeStats = Record<string, { right: number; total: number }>;

export interface SectionGap {
  section: Section;
  now: number;
  target: number;
  gap: number;
}

export interface GapAnalysis {
  total: number;
  target: number;
  minimum: number;
  meetsMinimum: boolean;
  meetsTarget: boolean;
  sections: SectionGap[];
  /** Sections in the order to work on (largest gap first). */
  focus: Section[];
}

/**
 * How far a score is from the target. Each section gets an even share of the target total
 * (rounded up), and the sections furthest below their share come first.
 */
export function analyzeGap(score: ToeflScore, target: number, minimum: number): GapAnalysis {
  const share = Math.ceil(target / 4);
  const sections = SECTIONS.map((section) => {
    const now = score.scores30?.[section] ?? section30FromBand(section, score.bands[section]);
    return { section, now, target: share, gap: Math.max(0, share - now) };
  });
  const total = comparableTotal(score);
  const focus = [...sections].sort((a, b) => b.gap - a.gap || a.now - b.now).map((s) => s.section);
  return { total, target, minimum, meetsMinimum: total >= minimum, meetsTarget: total >= target, sections, focus };
}

export interface PlanDay {
  day: number;
  items: { label: string; to: string; minutes: number }[];
}

const TASKS: Record<Section, { label: string; to: string; minutes: number }[]> = {
  reading: [
    { label: 'Reading: Complete the Words', to: '/toefl/reading?task=complete', minutes: 6 },
    { label: 'Reading: Read in Daily Life', to: '/toefl/reading?task=daily', minutes: 6 },
    { label: 'Reading: Academic Passage', to: '/toefl/reading?task=academic', minutes: 10 },
  ],
  listening: [
    { label: 'Listening: Choose a Response', to: '/toefl/listening?task=response', minutes: 6 },
    { label: 'Listening: Conversation', to: '/toefl/listening?task=conversation', minutes: 6 },
    { label: 'Listening: Announcement', to: '/toefl/listening?task=announcement', minutes: 5 },
    { label: 'Listening: Academic Talk', to: '/toefl/listening?task=talk', minutes: 8 },
  ],
  writing: [
    { label: 'Writing: Build a Sentence', to: '/toefl/writing?task=build', minutes: 6 },
    { label: 'Writing: Write an Email', to: '/toefl/writing?task=email', minutes: 8 },
    { label: 'Writing: Academic Discussion', to: '/toefl/writing?task=discussion', minutes: 11 },
  ],
  speaking: [
    { label: 'Speaking: Listen and Repeat', to: '/toefl/repeat', minutes: 5 },
    { label: 'Speaking: Take an Interview', to: '/toefl/interview', minutes: 6 },
  ],
};

/** Question types whose accuracy is below 70% with enough data, weakest first. */
export function weakTypes(stats: TypeStats, min = 4): string[] {
  return Object.entries(stats)
    .filter(([, s]) => s.total >= min && s.right / s.total < 0.7)
    .sort((a, b) => a[1].right / a[1].total - b[1].right / b[1].total)
    .map(([t]) => t);
}

/**
 * A daily plan until the exam (at most 14 days shown): about 25 minutes a day, with the sections
 * that need the most points appearing most often, a full mock every 7th day, and rest before the exam.
 */
export function buildPlan(gap: GapAnalysis, daysLeft: number | null): PlanDay[] {
  const days = Math.max(1, Math.min(14, daysLeft ?? 14));
  const weight = (s: Section) => 1 + (gap.sections.find((x) => x.section === s)?.gap ?? 0);
  const order: Section[] = [];
  for (const s of gap.focus) for (let k = 0; k < Math.min(4, weight(s)); k++) order.push(s);
  for (const s of SECTIONS) if (!order.includes(s)) order.push(s);
  const used: Record<Section, number> = { reading: 0, listening: 0, writing: 0, speaking: 0 };
  const plan: PlanDay[] = [];
  let k = 0;
  for (let d = 1; d <= days; d++) {
    if (daysLeft != null && d === daysLeft) {
      plan.push({ day: d, items: [{ label: 'Light review and rest before the exam', to: '/toefl/repeat', minutes: 10 }] });
      continue;
    }
    if (d % 7 === 0) {
      plan.push({ day: d, items: [{ label: 'Full mock test', to: '/toefl/full-mock', minutes: 75 }] });
      continue;
    }
    const items: PlanDay['items'] = [];
    let minutes = 0;
    while (minutes < 22) {
      const s = order[k++ % order.length];
      const t = TASKS[s][used[s]++ % TASKS[s].length];
      if (items.some((x) => x.to === t.to)) continue;
      items.push(t);
      minutes += t.minutes;
    }
    plan.push({ day: d, items });
  }
  return plan;
}

export function gapSummary(g: GapAnalysis): string {
  if (g.meetsTarget) return `${g.total} meets your target of ${g.target} (KAUST minimum ${g.minimum}).`;
  const need = g.target - g.total;
  const top = g.focus.filter((s) => (g.sections.find((x) => x.section === s)?.gap ?? 0) > 0).map((s) => SECTION_LABELS[s]);
  return `${g.total} now; ${need} more point${need === 1 ? '' : 's'} to reach ${g.target}${g.meetsMinimum ? ` (you already meet KAUST's ${g.minimum})` : ` (KAUST minimum ${g.minimum})`}. Most points to gain in: ${top.join(', ') || 'all sections evenly'}.`;
}
