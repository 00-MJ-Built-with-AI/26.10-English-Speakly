import { describe, expect, it } from 'vitest';
import { analyzeGap, buildPlan, weakTypes } from '../src/engine/toeflPlan.ts';
import { calibrate, practiceBand, skillBand, weakestSkill } from '../src/engine/toeflSkill.ts';
import { planToIcs, readiness, reviewNext, weekKey } from '../src/engine/toeflExtras.ts';
import { bandFromSection30, bandFromTotal, comparableTotal, overallBand, section30FromBand, totalRange, type ToeflScore } from '../src/engine/toeflScale.ts';

const score = (bands: ToeflScore['bands'], scores30?: ToeflScore['scores30'], total?: number): ToeflScore => ({
  id: 'x',
  at: 0,
  date: '2026-10-20',
  source: 'official',
  overall: overallBand(bands),
  bands,
  scores30,
  total,
});

describe('TOEFL scale (ETS concordance)', () => {
  it('maps section and total scores to bands', () => {
    expect(bandFromSection30('reading', 22)).toBe(4.5);
    expect(bandFromSection30('speaking', 19)).toBe(3.5);
    expect(bandFromSection30('writing', 30)).toBe(6);
    expect(bandFromTotal(79)).toBe(4);
    expect(bandFromTotal(86)).toBe(4.5);
    expect(bandFromTotal(71)).toBe(3.5);
  });
  it('averages bands to half steps', () => {
    expect(overallBand({ reading: 5, listening: 4.5, writing: 4, speaking: 4 })).toBe(4.5);
    expect(overallBand({ reading: 4, listening: 4, writing: 3.5, speaking: 3.5 })).toBe(4);
  });
  it('estimates 0-30 inside each band and the comparable total', () => {
    expect(bandFromSection30('listening', section30FromBand('listening', 4.5))).toBe(4.5);
    expect(comparableTotal(score({ reading: 5, listening: 5, writing: 4, speaking: 4 }, undefined, 88))).toBe(88);
    expect(comparableTotal(score({ reading: 5, listening: 5, writing: 4, speaking: 4 }, { reading: 25, listening: 23, writing: 18, speaking: 21 }))).toBe(87);
  });
});

describe('KAUST gap plan (1-6 bands)', () => {
  const s = score({ reading: 5.5, listening: 5, writing: 4, speaking: 4.5 });
  it('finds the sections furthest below the target band', () => {
    const g = analyzeGap(s, 5.5, 5);
    expect(g.overall).toBe(5);
    expect(g.meetsMinimum).toBe(true);
    expect(g.meetsTarget).toBe(false);
    expect(g.focus.slice(0, 2)).toEqual(['writing', 'speaking']);
    expect(g.sections.find((x) => x.section === 'writing')?.gap).toBe(1.5);
    expect(g.sections.find((x) => x.section === 'reading')?.gap).toBe(0);
    expect(totalRange(5.5)).toEqual([107, 113]);
    expect(totalRange(6)).toEqual([114, 120]);
  });
  it('builds 50-minute days weighted to the gaps, with a section test, a mock and a rest day', () => {
    const plan = buildPlan(analyzeGap(s, 5.5, 5), 10);
    expect(plan).toHaveLength(10);
    expect(plan[3].items[0].label).toBe('Writing section test');
    expect(plan[6].items[0].label).toMatch(/mock/i);
    expect(plan[9].items[0].label).toMatch(/rest/i);
    for (const d of [plan[0], plan[1], plan[4]]) expect(d.items.reduce((a, i) => a + i.minutes, 0)).toBeGreaterThanOrEqual(45);
    const items = plan.flatMap((d) => d.items);
    expect(items.filter((i) => i.label.startsWith('Writing')).length).toBeGreaterThan(items.filter((i) => i.label.startsWith('Reading')).length);
  });
  it('lists weak question types', () => {
    expect(weakTypes({ inference: { right: 2, total: 6 }, detail: { right: 5, total: 6 }, vocab: { right: 0, total: 2 } })).toEqual(['inference']);
  });
});

describe('skill band estimate', () => {
  const log = (section: 'reading' | 'listening', at: number, points: number, max: number) => ({ at, section, points, max });
  it('needs three practice results and maps the share to a band', () => {
    expect(practiceBand([log('reading', 1, 5, 5)], 'reading')).toBeNull();
    const p = practiceBand([log('reading', 1, 4, 5), log('reading', 2, 4, 5), log('reading', 3, 4, 5), log('listening', 4, 0, 5)], 'reading');
    expect(p?.band).toBe(5); // 80% -> 24/30, the Reading 5.0 floor
  });
  it('uses the latest test and blends in newer practice', () => {
    const T = Date.parse('2026-12-01');
    const d = { scores: [score({ reading: 4, listening: 4, writing: 4, speaking: 4 })], log: [] as ReturnType<typeof log>[], sectionTests: [{ at: T, section: 'reading' as const, band: 5 }] };
    expect(skillBand(d, 'reading')?.band).toBe(5);
    expect(skillBand(d, 'listening')?.band).toBe(4);
    d.log = [log('reading', T + 1, 1, 1), log('reading', T + 2, 1, 1), log('reading', T + 3, 1, 1)];
    expect(skillBand(d, 'reading')?.band).toBe(5.5);
    expect(skillBand(d, 'speaking', 5)?.band).toBe(4.5);
  });
});

describe('plan offset and weakest skill', () => {
  it('moves the weekly mock with the day offset', () => {
    const g = analyzeGap(score({ reading: 5.5, listening: 5, writing: 4, speaking: 4.5 }), 5.5, 5);
    const plan = buildPlan(g, null, 50, 3);
    expect(plan[3].items[0].label).toMatch(/mock/i);
    expect(plan[0].items[0].label).toBe('Writing section test');
  });
  it('picks the skill with the lowest band, unknown counting as 4', () => {
    const toefl = { scores: [score({ reading: 5, listening: 5, writing: 4.5, speaking: 5 })], log: [], sectionTests: [], target: 5.5 };
    expect(weakestSkill({ toefl, toeflBand: null })).toBe('writing');
    expect(weakestSkill({ toefl: { ...toefl, scores: [] }, toeflBand: 5 })).toBe('writing');
  });
});

describe('review, readiness and calendar', () => {
  it('schedules missed questions and drops them after two right answers', () => {
    const now = Date.parse('2026-11-03T10:00:00');
    const a = reviewNext({ box: 0, due: now }, true, now)!;
    expect(a.box).toBe(1);
    expect(a.due - now).toBe(3 * 86_400_000);
    expect(reviewNext(a, true, now)).toBeNull();
    expect(reviewNext(a, false, now)!.box).toBe(0);
  });
  it('predicts ready, close or not yet against the goal', () => {
    const now = Date.parse('2026-11-03');
    const s = (bands: ToeflScore['bands']) => ({ ...score(bands), at: now - 86_400_000, date: '2026-11-02' });
    // One official score plus a section test per skill at the same band: enough results for a narrow range.
    const d = (bands: ToeflScore['bands']) => ({ scores: [s(bands)], log: [], sectionTests: (Object.keys(bands) as (keyof typeof bands)[]).map((k) => ({ at: now - 2 * 86_400_000, section: k, band: bands[k] })) });
    expect(readiness(d({ reading: 6, listening: 6, writing: 5.5, speaking: 5.5 }), null, 5.5, 5, now).verdict).toBe('ready');
    expect(readiness(d({ reading: 5.5, listening: 5, writing: 5, speaking: 5 }), null, 5.5, 5, now).verdict).toBe('close');
    expect(readiness(d({ reading: 5.5, listening: 5, writing: 4, speaking: 5 }), null, 5.5, 5, now).verdict).toBe('not-yet');
    expect(readiness({ scores: [], log: [], sectionTests: [] }, null, 5.5, 5, now).verdict).toBe('need-data');
    const r = readiness({ scores: [s({ reading: 5, listening: 5, writing: 5, speaking: 5 })], log: [], sectionTests: [] }, null, 5.5, 5, now).skills[0];
    expect([r.lo, r.band, r.hi]).toEqual([4, 5, 6]);
  });
  it('writes the plan as a calendar file', () => {
    const ics = planToIcs([{ day: 1, items: [{ label: 'Reading, test', to: '/x', minutes: 20 }] }], new Date(2026, 10, 4), 19, 0);
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('DTSTART:20261104T190000');
    expect(ics).toContain('DTEND:20261104T192000');
    expect(ics).toContain(String.raw`Reading\, test`);
  });
  it('finds the Monday of a week', () => {
    expect(weekKey(new Date(2026, 10, 5).getTime())).toBe('2026-11-02');
    expect(weekKey(new Date(2026, 10, 2).getTime())).toBe('2026-11-02');
    expect(weekKey(new Date(2026, 10, 1).getTime())).toBe('2026-10-26');
  });
});

describe('calibration', () => {
  it('learns the gap between estimate and official result and shifts later estimates', () => {
    const mock = { ...score({ reading: 4.5, listening: 5, writing: 4, speaking: 4.5 }), source: 'mock' as const, at: Date.parse('2026-10-10') };
    const official = score({ reading: 5, listening: 5, writing: 3.5, speaking: 4.5 }); // dated 2026-10-20
    const d = { scores: [mock], log: [], sectionTests: [] };
    const c = calibrate(d, official, null);
    expect(c.calibration).toEqual({ reading: 0.5, listening: 0, writing: -0.5, speaking: 0 });
    expect(c.entries).toHaveLength(4);
    // A later section test of 4.5 in Reading now reads as 5.0; the official score itself is not shifted.
    const after = { scores: [official, mock], log: [], sectionTests: [{ at: Date.parse('2026-11-01'), section: 'reading' as const, band: 4.5 }], calibration: c.calibration };
    expect(skillBand(after, 'reading')?.band).toBe(5);
    expect(skillBand(after, 'writing')?.band).toBe(3.5);
  });
});
