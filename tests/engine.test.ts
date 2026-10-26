import { describe, expect, it } from 'vitest';
import { UNITS } from '../src/content/units.ts';
import { SOUNDS } from '../src/content/sounds.ts';
import { combineBands, repeatBand, REPEAT_SETS, INTERVIEW_SETS } from '../src/content/toefl.ts';
import { currentUnit, recordCheck, unitState } from '../src/engine/path.ts';
import { addPractice, bestStreak, dateKey, streak } from '../src/engine/progress.ts';
import { blend, cefrOf, fluencyScore, toeflBandOf } from '../src/engine/scoring.ts';
import { review, newMistake, sameMistake, LEARNED_BOX } from '../src/engine/srs.ts';
import { align, takeSentences, wordAccuracy, words } from '../src/engine/text.ts';
import { emptyUser } from '../src/lib/types.ts';
import { combine, typedAssessment } from '../src/speech/score.ts';
import type { Assessment } from '../src/speech/types.ts';

describe('content', () => {
  it('has a full syllabus with unique ids and complete units', () => {
    expect(UNITS.length).toBeGreaterThanOrEqual(36);
    expect(new Set(UNITS.map((u) => u.id)).size).toBe(UNITS.length);
    for (const level of ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']) expect(UNITS.some((u) => u.level === level)).toBe(true);
    for (const u of UNITS) {
      expect(u.shadow.length).toBeGreaterThanOrEqual(4);
      expect(u.fast.length).toBe(4);
      expect(u.canDo.length).toBeGreaterThan(0);
      for (const s of u.sounds) expect(SOUNDS.some((x) => x.id === s), `${u.id} sound ${s}`).toBe(true);
    }
  });
  it('TOEFL sets match the 2026 format', () => {
    for (const s of REPEAT_SETS) expect(s.sentences).toHaveLength(7);
    for (const s of INTERVIEW_SETS) expect(s.questions).toHaveLength(4);
  });
});

describe('text', () => {
  it('normalises words', () => {
    expect(words("I'm OK, it's fine-ish!")).toEqual(["i'm", 'ok', "it's", 'fine', 'ish']);
  });
  it('aligns and scores word accuracy', () => {
    expect(wordAccuracy('I went to the office', 'I went to office')).toBeCloseTo(0.8);
    const ops = align(['a', 'b', 'c'], ['a', 'x', 'c']);
    expect(ops.map((o) => o.type)).toEqual(['match', 'sub', 'match']);
  });
  it('splits streamed text into sentences', () => {
    expect(takeSentences('Hello there. How are')).toEqual({ sentences: ['Hello there.'], rest: 'How are' });
    expect(takeSentences('It costs 3.5 dollars. Ok').sentences).toEqual(['It costs 3.5 dollars.']);
  });
});

describe('scoring', () => {
  it('maps scores to CEFR like the EF SET report', () => {
    expect(cefrOf(73)).toBe('C2');
    expect(cefrOf(68)).toBe('C1');
    expect(cefrOf(51)).toBe('B2');
    expect(cefrOf(58)).toBe('B2');
    expect(cefrOf(12)).toBe('A1');
  });
  it('maps to TOEFL bands', () => {
    expect(toeflBandOf(10)).toBe(1);
    expect(toeflBandOf(55)).toBe(4);
    expect(toeflBandOf(90)).toBe(6);
  });
  it('blends skills', () => {
    expect(blend(null, 60)).toBe(60);
    expect(blend(60, 80, 0.25)).toBe(65);
  });
  it('penalises a slow start in fluency', () => {
    const a = { fluency: 80, wordsPerMinute: 130, longPauses: 0, startDelayMs: 1000 } as Assessment;
    expect(fluencyScore({ ...a, startDelayMs: 6000 }, true)).toBeLessThan(fluencyScore(a, true));
  });
});

describe('speech scoring', () => {
  it('marks skipped reference words as omissions', () => {
    const w = (word: string, ms: number) => ({ word, accuracy: 90, error: 'None' as const, phonemes: [], offsetMs: ms, durationMs: 300 });
    const a = combine('azure', [{ text: 'I went office', words: [w('I', 0), w('went', 400), w('office', 800)], fluency: 80, durationMs: 1100 }], 'I went to the office');
    expect(a.words.map((x) => x.error)).toEqual(['None', 'None', 'Omission', 'Omission', 'None']);
    expect(a.completeness).toBeCloseTo(60);
    expect(a.pron).toBeGreaterThan(0);
  });
  it('typed answers give no pronunciation evidence', () => {
    const a = typedAssessment('hello world', 'hello world');
    expect(a.engine).toBe('typed');
    expect(a.pron).toBe(0);
    expect(a.completeness).toBe(100);
  });
});

describe('path', () => {
  it('starts at the first unit and tests out', () => {
    const user = emptyUser();
    expect(currentUnit(user)?.id).toBe(UNITS[0].id);
    const missing = recordCheck(user, UNITS[0].id, {
      pronunciation: { passed: true, score: 80 },
      grammar: { passed: false, score: 40 },
      task: { passed: true, score: 70 },
    });
    expect(missing).toEqual(['grammar']);
    expect(unitState(user, UNITS[0].id).status).toBe('open');
    recordCheck(user, UNITS[0].id, { grammar: { passed: true, score: 80 } });
    expect(unitState(user, UNITS[0].id).status).toBe('done');
    expect(unitState(user, UNITS[0].id).viaTestOut).toBe(false);
    expect(unitState(user, UNITS[1].id).status).toBe('open');
    expect(currentUnit(user)?.id).toBe(UNITS[1].id);
  });
  it('marks a first-try pass as a test-out', () => {
    const user = emptyUser();
    recordCheck(user, UNITS[0].id, { pronunciation: { passed: true, score: 80 }, grammar: { passed: true, score: 80 }, task: { passed: true, score: 80 } });
    expect(unitState(user, UNITS[0].id).viaTestOut).toBe(true);
  });
});

describe('progress', () => {
  it('counts streaks', () => {
    const user = emptyUser();
    const day = 86_400_000;
    const now = new Date(2026, 9, 26, 12).getTime();
    addPractice(user, 600, now);
    addPractice(user, 600, now - day);
    addPractice(user, 600, now - 3 * day);
    expect(streak(user, now)).toBe(2);
    expect(bestStreak(user)).toBe(2);
    expect(dateKey(now)).toBe('2026-10-26');
  });
});

describe('mistake bank', () => {
  it('moves through boxes and resets on a lapse', () => {
    const now = new Date(2026, 9, 26, 12).getTime();
    let m = newMistake({ kind: 'grammar', said: 'he go', better: 'he goes', why: '-s', source: 'test' }, now);
    m = review(m, true, now);
    expect(m.box).toBe(1);
    m = review(m, true, now);
    expect(m.box).toBe(2);
    m = review(m, false, now);
    expect(m.box).toBe(1);
    expect(m.lapses).toBe(1);
    for (let i = 0; i < 10; i++) m = review(m, true, now);
    expect(m.box).toBe(LEARNED_BOX);
    expect(sameMistake({ said: 'x', better: 'He goes.' }, { said: 'y', better: 'he goes' })).toBe(true);
  });
});

describe('toefl', () => {
  it('combines bands', () => {
    expect(repeatBand(1, 95)).toBe(6);
    expect(repeatBand(0.2, 30)).toBeLessThanOrEqual(2);
    expect(combineBands(4, [5, 5, 4, 4])).toBe(4);
    expect(combineBands(5, [6, 6, 5, 5])).toBe(5);
  });
});
