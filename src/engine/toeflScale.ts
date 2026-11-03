/**
 * New TOEFL iBT (2026) score scales. Sections and the total are reported on a 1-6 band scale
 * (half bands); for two years reports also show comparable 0-30 section and 0-120 total scores.
 * Concordance from ETS ("TOEFL iBT score scale update: what you need to know").
 */
export type Section = 'reading' | 'listening' | 'writing' | 'speaking';
export const SECTIONS: Section[] = ['reading', 'listening', 'writing', 'speaking'];
export const SECTION_LABELS: Record<Section, string> = { reading: 'Reading', listening: 'Listening', writing: 'Writing', speaking: 'Speaking' };

/** Lowest 0-30 section score for each band (from the ETS table). */
const SECTION_FLOORS: Record<Section, [number, number][]> = {
  reading: [[6, 29], [5.5, 27], [5, 24], [4.5, 22], [4, 18], [3.5, 12], [3, 6], [2.5, 4], [2, 3], [1.5, 2], [1, 0]],
  listening: [[6, 28], [5.5, 26], [5, 22], [4.5, 20], [4, 17], [3.5, 13], [3, 9], [2.5, 6], [2, 4], [1.5, 2], [1, 0]],
  writing: [[6, 29], [5.5, 27], [5, 24], [4.5, 21], [4, 17], [3.5, 15], [3, 13], [2.5, 11], [2, 7], [1.5, 3], [1, 0]],
  speaking: [[6, 28], [5.5, 27], [5, 25], [4.5, 23], [4, 20], [3.5, 18], [3, 16], [2.5, 13], [2, 10], [1.5, 5], [1, 0]],
};

/** Lowest comparable 0-120 total for each overall band. */
const TOTAL_FLOORS: [number, number][] = [[6, 114], [5.5, 107], [5, 95], [4.5, 86], [4, 72], [3.5, 58], [3, 44], [2.5, 34], [2, 24], [1.5, 12], [1, 0]];

export function bandFromSection30(section: Section, score: number): number {
  return SECTION_FLOORS[section].find(([, lo]) => score >= lo)?.[0] ?? 1;
}

/** A typical (middle) 0-30 score for a section band, for estimates and plans. */
export function section30FromBand(section: Section, band: number): number {
  const rows = SECTION_FLOORS[section];
  const i = rows.findIndex(([b]) => b <= band);
  if (i < 0) return 0;
  const lo = rows[i][1];
  const hi = i === 0 ? 30 : rows[i - 1][1] - 1;
  return Math.round((lo + hi) / 2);
}

/** The comparable 0-120 range of an overall band, e.g. 5.5 -> [107, 113]. */
export function totalRange(band: number): [number, number] {
  const i = TOTAL_FLOORS.findIndex(([b]) => b <= band);
  if (i < 0) return [0, 11];
  return [TOTAL_FLOORS[i][1], i === 0 ? 120 : TOTAL_FLOORS[i - 1][1] - 1];
}

export function bandFromTotal(total: number): number {
  return TOTAL_FLOORS.find(([, lo]) => total >= lo)?.[0] ?? 1;
}

/** Overall band: the average of the four section bands, rounded to the nearest half band. */
export function overallBand(bands: Record<Section, number>): number {
  return Math.round((SECTIONS.reduce((a, s) => a + bands[s], 0) / 4) * 2) / 2;
}

/** Estimated 0-30 from the share of points earned in practice (0-1). */
export function section30FromShare(share: number): number {
  return Math.max(0, Math.min(30, Math.round(share * 30)));
}

/** One score report: official (from the photo) or estimated (from a mock test). */
export interface ToeflScore {
  id: string;
  at: number;
  /** Test date, YYYY-MM-DD. */
  date: string;
  source: 'official' | 'mock';
  overall: number;
  bands: Record<Section, number>;
  /** Comparable 0-30 section scores, when known. */
  scores30?: Partial<Record<Section, number>>;
  /** Comparable 0-120 total, when known. */
  total?: number;
}

/** Comparable 0-120 total: the reported one, else the sum of section scores, else estimated from bands. */
export function comparableTotal(s: ToeflScore): number {
  if (s.total != null) return s.total;
  return SECTIONS.reduce((a, k) => a + (s.scores30?.[k] ?? section30FromBand(k, s.bands[k])), 0);
}

/**
 * KAUST (checked 2026-11-03): its pages still state the old 0-120 scale, 79 on the admissions FAQ and 81
 * on "Applying to KAUST"; ETS places both in band 4.0 (72-85). Below TOEFL 90 (band 4.5) admitted students
 * take a mandatory English course. The learner chose a higher goal: 5.5, with 5.0 as the floor.
 */
export const KAUST = {
  publishedTotals: [79, 81],
  etsBand: 4,
  englishCourseBelowBand: 4.5,
  defaultTarget: 5.5,
  defaultMinimum: 5,
  source: 'https://www.kaust.edu.sa/en/study/applying-to-kaust',
  etsGuide: 'https://toeflaccess.ets.org/help/en/articles/12839102-how-to-set-score-requirements-for-the-updated-toefl-scale-1-6',
};
