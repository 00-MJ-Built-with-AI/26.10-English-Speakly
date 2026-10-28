import { describe, expect, it } from 'vitest';
import { dbfs, micVerdict, percentile } from '../src/engine/audiocheck.ts';

describe('mic check', () => {
  it('converts levels and spots problems', () => {
    expect(dbfs(1)).toBe(0);
    expect(Math.round(dbfs(0.01))).toBe(-40);
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.9)).toBe(10);
    const good = micVerdict(-60, -22, 3, 1);
    expect(good.ok).toBe(true);
    expect(good.issues).toHaveLength(0);
    const noisy = micVerdict(-28, -20, 20, 0.5);
    expect(noisy.ok).toBe(false);
    expect(noisy.issues.map((i) => i.text).join(' ')).toMatch(/noisy|headphones|recognise/);
  });
});

describe('spending', () => {
  it('prices tokens and adds up a day', async () => {
    const { tokenCost } = await import('../shared/pricing.ts');
    const { addUsage, dayTotal } = await import('../src/lib/usage.ts');
    expect(tokenCost({ model: 'claude-opus-5-5', input: 1_000_000, output: 100_000, cacheRead: 0, cacheWrite: 0 })).toBeCloseTo(6);
    expect(tokenCost({ model: 'claude-haiku-5-5', input: 1_000_000, output: 0, cacheRead: 0, cacheWrite: 0 })).toBeCloseTo(0.1);
    const d = addUsage(addUsage(undefined, { ai: 0.02, aiCalls: 1 }), { speech: 0.01, sttSec: 30 });
    expect(dayTotal(d)).toBeCloseTo(0.03);
    expect(d.aiCalls).toBe(1);
  });
});

describe('weekly focus', () => {
  it('picks the two weakest areas', async () => {
    const { computeFocus, mondayKey } = await import('../src/engine/focus.ts');
    const { emptyUser } = await import('../src/lib/types.ts');
    expect(mondayKey(new Date(2026, 9, 29, 9).getTime())).toBe('2026-10-26');
    expect(mondayKey(new Date(2026, 9, 26, 9).getTime())).toBe('2026-10-26');
    const u = emptyUser();
    expect(computeFocus(u, [], [])[0].to).toBe('/tutor');
    u.sounds = { 'th-voiceless': 40, r: 70 };
    u.skills = { pronunciation: 70, fluency: 40, grammar: 70, vocabulary: 72 };
    const now = Date.now();
    const hes = { fillers: 3, crutches: 0, repeats: 2, pauses: 4, longPauses: 3, startDelayMs: 4000, wordsPerMinute: 90, perMinute: 6, score: 40, speechMs: 60000 };
    const f = computeFocus(u, [{ at: now, kind: 'tutor', title: 't', scores: {}, seconds: 60, hesitation: hes }], [], now);
    expect(f).toHaveLength(2);
    expect(f.map((x) => x.kind)).toEqual(expect.arrayContaining(['hesitation', 'sound']));
    expect(f.find((x) => x.kind === 'sound')?.to).toBe('/practice/sounds/th-voiceless');
  });
});

describe('numbers and spelling', () => {
  it('says numbers in words', async () => {
    const { numberToWords, ordinalWords, yearWords } = await import('../src/engine/numbers.ts');
    expect(numberToWords(1_250_000)).toBe('one million two hundred fifty thousand');
    expect(numberToWords(47)).toBe('forty seven');
    expect(ordinalWords(3)).toBe('third');
    expect(ordinalWords(21)).toBe('twenty first');
    expect(ordinalWords(20)).toBe('twentieth');
    expect(yearWords(2026)).toContain('twenty twenty six');
    expect(yearWords(2005)).toContain('two thousand five');
  });
  it('accepts digits or words, and rejects wrong answers', async () => {
    const { acceptNumber } = await import('../src/engine/numbers.ts');
    const price = { category: 'price' as const, written: '$24.99', sentence: '', spoken: ['twenty four ninety nine', 'twenty four dollars and ninety nine cents'], compact: '2499' };
    expect(acceptNumber(price, 'It costs $24.99.')).toBe(true);
    expect(acceptNumber(price, 'twenty-four ninety-nine')).toBe(true);
    expect(acceptNumber(price, 'twenty four dollars and ninety nine cents')).toBe(true);
    expect(acceptNumber(price, '$42.99')).toBe(false);
    const spell = { category: 'spell' as const, written: 'KHALID', sentence: '', spoken: ['k h a l i d'], compact: 'khalid' };
    expect(acceptNumber(spell, 'K. H. A. L. I. D.')).toBe(true);
    expect(acceptNumber(spell, 'K H A L E D')).toBe(false);
    const email = { category: 'email' as const, written: 'sara.khan84@gmail.com', sentence: '', spoken: ['sara dot khan eighty four at gmail dot com'], compact: 'sarakhan84gmailcom' };
    expect(acceptNumber(email, 'sara.khan84@gmail.com')).toBe(true);
    expect(acceptNumber(email, 'sara dot khan eighty four at gmail dot com')).toBe(true);
    const date = { category: 'date' as const, written: 'March 14', sentence: '', spoken: ['march fourteenth'], compact: '14' };
    expect(acceptNumber(date, 'March 14th')).toBe(true);
    expect(acceptNumber(date, 'May 14th')).toBe(false);
  });
  it('makes items for every category', async () => {
    const { makeItem, CATEGORY_LABELS } = await import('../src/engine/numbers.ts');
    for (const c of Object.keys(CATEGORY_LABELS)) {
      const it = makeItem(c as never);
      expect(it.written.length).toBeGreaterThan(0);
      expect(it.spoken.length).toBeGreaterThan(0);
    }
  });
});

describe('story builder and tongue twisters', () => {
  it('spots the story words in any common form', async () => {
    const { usedWord, drawWords } = await import('../src/content/stories.ts');
    expect(usedWord('forget', 'I forgot my keys')).toBe(true);
    expect(usedWord('forget', "I'm always forgetting things")).toBe(true);
    expect(usedWord('nervous', 'she waited nervously')).toBe(true);
    expect(usedWord('umbrella', 'it was raining')).toBe(false);
    expect(drawWords()).toHaveLength(3);
  });
  it('points every twister at a real sound drill', async () => {
    const { TWISTERS } = await import('../src/content/twisters.ts');
    const { SOUNDS } = await import('../src/content/sounds.ts');
    for (const t of TWISTERS) expect(SOUNDS.some((s) => s.id === t.sound), t.id).toBe(true);
    expect(new Set(TWISTERS.map((t) => t.id)).size).toBe(TWISTERS.length);
  });
});
