import { describe, expect, it } from 'vitest';
import { applyFix, hardestWords, noteLearned, noteMiss, simpleForms, tutorWordRanks, vocabularyEstimate, weeklyNew, wordsUsed } from '../src/engine/wordStats.ts';
import { emptyWords, KNOWN, type WordCard } from '../src/engine/words.ts';
import pack12 from '../public/words/pack-12.json';

describe('word stats', () => {
  it('counts misses and lists the hardest unlearned words first', () => {
    const w = emptyWords();
    w.items = { 10: [1, 0], 20: [2, 0], 30: [6, 0] };
    noteMiss(w, 10);
    noteMiss(w, 20);
    noteMiss(w, 20);
    noteMiss(w, 30);
    expect(hardestWords(w)).toEqual([
      { rank: 20, misses: 2 },
      { rank: 10, misses: 1 },
    ]);
  });
  it('estimates vocabulary from known, learned and recent known share', () => {
    const w = emptyWords();
    for (let r = 1; r <= 100; r++) w.items[r] = r <= 80 ? [KNOWN, 0] : [1, 0];
    const e = vocabularyEstimate(w);
    expect(e.sure).toBe(80);
    // 80 sure + 10 (half of 20 in review) + 80% of the 4,900 not seen yet
    expect(e.estimate).toBe(80 + 10 + Math.round(0.8 * 4900));
    expect(vocabularyEstimate(emptyWords()).estimate).toBe(0);
  });
  it('keeps a weekly history of new words', () => {
    const w = emptyWords();
    const now = Date.parse('2026-11-12T12:00:00');
    noteLearned(w, 5, now);
    noteLearned(w, 3, now - 8 * 86_400_000);
    const weeks = weeklyNew(w, 2, now);
    expect(weeks.map((x) => x.n)).toEqual([3, 5]);
  });
  it('picks recent words still in early review for the tutor', () => {
    const w = emptyWords();
    w.items = { 5: [KNOWN, 0], 6: [1, 100], 7: [2, 103], 8: [6, 999], 9: [4, 200] };
    expect(tutorWordRanks(w)).toEqual([7, 6]);
  });
  it('spots a word in speech in its common forms', () => {
    expect(simpleForms('study')).toEqual(expect.arrayContaining(['studies', 'studied']));
    expect(simpleForms('stop')).toEqual(expect.arrayContaining(['stopped', 'stopping']));
    expect(simpleForms('decide')).toContain('deciding');
    expect(wordsUsed('I decided to study harder, and I stopped.', [{ rank: 1, word: 'decide' }, { rank: 2, word: 'stop' }, { rank: 3, word: 'rely' }])).toEqual([1, 2]);
  });
  it('applies the learner\'s fix to a card', () => {
    const card = { rank: 694, word: 'wall', english: 'defensive rampart', arabic: 'حائط' } as WordCard;
    expect(applyFix(card, { 694: { english: 'a side of a room or building' } }).english).toBe('a side of a room or building');
    expect(applyFix(card, undefined).english).toBe('defensive rampart');
  });
  it('has families and partners in the packs', () => {
    const cards = pack12 as WordCard[];
    expect(cards.every((c) => Array.isArray(c.family) && Array.isArray(c.partners))).toBe(true);
    expect(cards.some((c) => (c.partners ?? []).length > 0)).toBe(true);
  });
});
