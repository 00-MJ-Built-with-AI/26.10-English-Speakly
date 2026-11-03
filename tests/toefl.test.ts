import { describe, expect, it } from 'vitest';
import { analyzeGap, buildPlan, weakTypes } from '../src/engine/toeflPlan.ts';
import { bandFromSection30, bandFromTotal, comparableTotal, overallBand, section30FromBand, type ToeflScore } from '../src/engine/toeflScale.ts';

const score = (bands: ToeflScore['bands'], scores30?: ToeflScore['scores30'], total?: number): ToeflScore => ({
  id: 'x',
  at: 0,
  date: '2026-11-20',
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

describe('KAUST gap plan', () => {
  it('finds the sections furthest below an even share of the target', () => {
    const s = score({ reading: 5, listening: 4.5, writing: 3.5, speaking: 3.5 }, { reading: 25, listening: 21, writing: 15, speaking: 18 });
    const g = analyzeGap(s, 85, 79);
    expect(g.total).toBe(79);
    expect(g.meetsMinimum).toBe(true);
    expect(g.meetsTarget).toBe(false);
    expect(g.focus.slice(0, 2)).toEqual(['writing', 'speaking']);
    expect(g.sections.find((x) => x.section === 'writing')?.gap).toBe(7);
  });
  it('builds daily plans weighted to the gaps, with mocks and a rest day', () => {
    const s = score({ reading: 5, listening: 4.5, writing: 3.5, speaking: 3.5 }, { reading: 25, listening: 21, writing: 15, speaking: 18 });
    const plan = buildPlan(analyzeGap(s, 85, 79), 10);
    expect(plan).toHaveLength(10);
    expect(plan[6].items[0].label).toMatch(/mock/i);
    expect(plan[9].items[0].label).toMatch(/rest/i);
    const writing = plan.flatMap((d) => d.items).filter((i) => i.label.startsWith('Writing')).length;
    const reading = plan.flatMap((d) => d.items).filter((i) => i.label.startsWith('Reading')).length;
    expect(writing).toBeGreaterThan(reading);
  });
  it('lists weak question types', () => {
    expect(weakTypes({ inference: { right: 2, total: 6 }, detail: { right: 5, total: 6 }, vocab: { right: 0, total: 2 } })).toEqual(['inference']);
  });
});
