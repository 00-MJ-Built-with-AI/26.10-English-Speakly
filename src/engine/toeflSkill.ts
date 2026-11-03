import { bandFromSection30, section30FromShare, type Section, type ToeflScore } from './toeflScale.ts';

/** The parts of the learner's TOEFL data the skill estimate needs. */
export interface SkillData {
  scores: ToeflScore[];
  log: { at: number; section: Section; points: number; max: number }[];
  sectionTests: { at: number; section: Section; band: number }[];
  /** How far estimates were off at the last official result (official minus estimate), per skill. */
  calibration?: Partial<Record<Section, number>>;
}

export type BandSource = 'official' | 'mock' | 'test' | 'practice';

export interface BandPoint {
  at: number;
  band: number;
  source: BandSource;
}

/** Band estimate from the last `n` practice results of a section (at least 3), or null. */
export function practiceBand(log: SkillData['log'], section: Section, n = 20): BandPoint | null {
  const recent = log.filter((x) => x.section === section && x.max > 0).slice(-n);
  if (recent.length < 3) return null;
  const share = recent.reduce((a, x) => a + x.points, 0) / recent.reduce((a, x) => a + x.max, 0);
  return { at: recent[recent.length - 1].at, band: bandFromSection30(section, section30FromShare(share)), source: 'practice' };
}

/** Every band result for a section, oldest first: official scores, mock tests and section tests. */
export function bandHistory(d: SkillData, section: Section): BandPoint[] {
  const points: BandPoint[] = [
    ...d.scores.map((s) => ({ at: s.source === 'official' ? Date.parse(s.date) || s.at : s.at, band: s.bands[section], source: s.source })),
    ...d.sectionTests.filter((t) => t.section === section).map((t) => ({ at: t.at, band: t.band, source: 'test' as const })),
  ];
  return points.sort((a, b) => a.at - b.at);
}

/**
 * The best current estimate for one skill: the latest test result (official, mock or section test),
 * unless practice since then points elsewhere, in which case the two are averaged.
 * For Speaking, pass the running speaking practice band as `speakingPractice` (treated as current).
 */
export function skillBand(d: SkillData, section: Section, speakingPractice?: number | null): BandPoint | null {
  const raw = rawSkillBand(d, section, speakingPractice);
  // Estimates (not an official result on its own) are shifted by what the last official score showed.
  const shift = d.calibration?.[section] ?? 0;
  if (!raw || raw.source === 'official' || !shift) return raw;
  return { ...raw, band: half(raw.band + shift) };
}

const half = (x: number) => Math.min(6, Math.max(1, Math.round(x * 2) / 2));

function rawSkillBand(d: SkillData, section: Section, speakingPractice?: number | null): BandPoint | null {
  const hist = bandHistory(d, section);
  const last = hist[hist.length - 1] ?? null;
  const practice = section === 'speaking' ? (speakingPractice != null ? { at: Date.now(), band: speakingPractice, source: 'practice' as const } : null) : practiceBand(d.log, section);
  if (!last) return practice;
  if (!practice || practice.at <= last.at) return last;
  return { at: practice.at, band: half((last.band + practice.band) / 2), source: last.source };
}

export interface CalibrationEntry {
  at: number;
  section: Section;
  predicted: number;
  official: number;
}

/**
 * Compares a new official result with what the app predicted just before it (mocks, section tests
 * and practice up to the test date) and returns the new per-skill shift: the latest difference,
 * averaged with the previous shift, rounded to half bands and capped at 1.5.
 */
export function calibrate(d: SkillData, official: ToeflScore, speakingPractice: number | null): { calibration: Partial<Record<Section, number>>; entries: CalibrationEntry[] } {
  const at = Date.parse(official.date) || official.at;
  const before: SkillData = {
    scores: d.scores.filter((s) => s.source === 'mock' && s.at < at + 86_400_000),
    log: d.log.filter((x) => x.at < at + 86_400_000),
    sectionTests: d.sectionTests.filter((x) => x.at < at + 86_400_000),
    calibration: d.calibration,
  };
  const calibration = { ...d.calibration };
  const entries: CalibrationEntry[] = [];
  for (const section of ['reading', 'listening', 'writing', 'speaking'] as Section[]) {
    const p = skillBand(before, section, section === 'speaking' ? speakingPractice : null);
    if (!p) continue;
    const diff = official.bands[section] - p.band;
    const prev = d.calibration?.[section];
    const next = Math.max(-1.5, Math.min(1.5, Math.round(((prev != null ? (prev + (prev + diff)) / 2 : diff)) * 2) / 2));
    calibration[section] = next;
    entries.push({ at: Date.now(), section, predicted: p.band, official: official.bands[section] });
  }
  return { calibration, entries };
}

/** The skill furthest below the target (skills with no data yet count as band 4). */
export function weakestSkill(u: { toefl: SkillData & { target: number }; toeflBand: number | null }): Section {
  const order: Section[] = ['writing', 'speaking', 'listening', 'reading'];
  return order.map((s) => ({ s, b: skillBand(u.toefl, s, u.toeflBand)?.band ?? 4 })).sort((x, y) => x.b - y.b)[0].s;
}
