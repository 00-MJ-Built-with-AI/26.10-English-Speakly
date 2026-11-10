import { describe, expect, it } from 'vitest';
import listJson from '../public/words/list.json';
import packJson from '../public/words/pack-01.json';
import { checkWritten, dayNumber, dueRanks, gapSentence, gradeWord, keySentence, KNOWN, makeQuestion, spelled, nextNew, packOf, packRange, seenInPack, type WordCard, type WordState } from '../src/engine/words.ts';

const list: string[] = listJson;
const pack1: Omit<WordCard, 'rank'>[] = packJson;
const cards: WordCard[] = pack1.map((c, i) => ({ ...c, rank: i + 1 }));

describe('word data', () => {
  it('has 5,000 different words in order', () => {
    expect(list).toHaveLength(5000);
    expect(new Set(list).size).toBe(5000);
    expect(list.slice(0, 3)).toEqual(['the', 'be', 'to']);
  });
  it('has a complete first pack that follows the list', () => {
    expect(pack1.map((c) => c.word)).toEqual(list.slice(0, 100));
    for (const c of pack1) {
      expect(c.paragraph).toContain('**');
      expect(c.arabic).toMatch(/[\u0600-\u06FF]/);
      expect(c.arabicDesc).toMatch(/[\u0600-\u06FF]/);
      expect(c.english.length).toBeGreaterThan(5);
    }
  });
});

describe('word course', () => {
  const now = Date.parse('2026-11-10T12:00:00');
  it('maps ranks to packs', () => {
    expect(packOf(1)).toBe(1);
    expect(packOf(100)).toBe(1);
    expect(packOf(101)).toBe(2);
    expect(packRange(50)).toEqual([4901, 5000]);
  });
  it('gives the next unseen words from written packs only', () => {
    const items: Record<string, WordState> = { 1: [KNOWN, 0], 3: [1, 0] };
    expect(nextNew(items, 3, new Set([1]))).toEqual([2, 4, 5]);
    expect(nextNew({}, 2, new Set([2]))).toEqual([101, 102]);
    expect(nextNew({}, 5, new Set([1]), 2)).toEqual([]);
    expect(seenInPack(items, 1)).toBe(2);
  });
  it('spaces reviews at 1, 3, 7, 14 and 30 days and resets on a miss', () => {
    const t = dayNumber(now);
    let s: WordState = gradeWord(undefined, true, now);
    expect(s).toEqual([1, t + 1]);
    s = gradeWord(s, true, now);
    expect(s).toEqual([2, t + 3]);
    s = gradeWord(s, true, now);
    expect(s).toEqual([3, t + 7]);
    s = gradeWord(s, true, now);
    expect(s).toEqual([4, t + 14]);
    s = gradeWord(s, true, now);
    expect(s).toEqual([5, t + 30]);
    expect(gradeWord(s, false, now)).toEqual([1, t + 1]);
    expect(gradeWord([0, 0], true, now)).toEqual([1, t + 1]);
  });
  it('lists due words but never known ones', () => {
    const t = dayNumber(now);
    expect(dueRanks({ 5: [2, t], 6: [KNOWN, 0], 7: [1, t + 1], 8: [6, t - 1], 9: [1, t - 2] }, now)).toEqual([9, 5]);
  });
  it('builds questions with one right answer and four different options', () => {
    for (const c of cards) {
      const q = makeQuestion(c, cards);
      expect(q.options).toHaveLength(4);
      expect(new Set(q.options).size).toBe(4);
      const right = q.options[q.answer];
      expect(right).toBe(q.kind === 'meaning' ? c.english : q.kind === 'arabic' ? c.arabic : c.word);
      if (q.kind === 'cloze') expect(q.prompt).toContain('_____');
      if (q.kind === 'cloze') expect(q.prompt).not.toContain('**');
    }
  });
  it('picks the sentence that has the word for reading aloud', () => {
    expect(keySentence('It rained. We found a **place** to sleep. It was warm.')).toBe('We found a place to sleep.');
  });
});

describe('writing the word', () => {
  const card = { rank: 300, word: 'acquire', pos: 'verb', academic: true, paragraph: 'How easily one **acquires** bad habits! They went to **acquire** culture.', english: 'to get', arabic: 'يكتسب', arabicDesc: '', other: [] };
  it('blanks the word in its first sentence', () => {
    expect(gapSentence(card)).toEqual({ before: 'How easily one ', answer: 'acquires', after: ' bad habits!' });
  });
  it('accepts the sentence form or the base form, and spots one-letter slips', () => {
    expect(checkWritten(' Acquires ', 'acquires', 'acquire')).toBe('right');
    expect(checkWritten('acquire', 'acquires', 'acquire')).toBe('base');
    expect(checkWritten('aquires', 'acquires', 'acquire')).toBe('almost');
    expect(checkWritten('get', 'acquires', 'acquire')).toBe('wrong');
    expect(spelled('cat')).toBe('C, A, T');
  });
  it('can blank a word in every card', () => {
    for (const c of cards) expect(gapSentence(c).answer.length).toBeGreaterThan(0);
  });
});
