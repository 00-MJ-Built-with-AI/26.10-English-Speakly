import { describe, expect, it } from 'vitest';
import { levelSteps } from '../src/content/placement.ts';
import { JOURNAL_PROMPTS, promptOfTheDay } from '../src/content/journal.ts';
import { checkPassed, evaluateCheck } from '../src/engine/check.ts';
import { analyzeHesitation, combineHesitation } from '../src/engine/hesitation.ts';
import { melodyMatch, pitchTrack, toContour } from '../src/engine/pitch.ts';
import { levelProgress, testOutLevel, currentUnit } from '../src/engine/path.ts';
import { emptyUser } from '../src/lib/types.ts';
import type { Assessment, WordScore } from '../src/speech/types.ts';

const word = (w: string, at: number, dur = 300, accuracy = 90): WordScore => ({ word: w, accuracy, error: 'None', phonemes: [], offsetMs: at, durationMs: dur });
const assessment = (ws: WordScore[], extra: Partial<Assessment> = {}): Assessment => ({
  engine: 'azure',
  text: ws.map((w) => w.word).join(' '),
  words: ws,
  accuracy: 90,
  fluency: 80,
  completeness: 100,
  prosody: 80,
  pron: 85,
  startDelayMs: 800,
  speechMs: (ws.at(-1)?.offsetMs ?? 0) + 300,
  wordsPerMinute: 120,
  longPauses: 0,
  ...extra,
});

describe('fast-track level test', () => {
  it('builds a 6-step block for every level', () => {
    for (const l of ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const) {
      const s = levelSteps(l);
      expect(s.map((x) => x.part)).toEqual(['pronunciation', 'pronunciation', 'grammar', 'grammar', 'grammar', 'task']);
    }
  });
  it('marks a whole level done and moves to the next', () => {
    const u = emptyUser();
    testOutLevel(u, 'A1');
    expect(levelProgress(u, 'A1')).toEqual({ done: 6, total: 6 });
    expect(currentUnit(u)?.level).toBe('A2');
  });
  it('evaluates a check', () => {
    const good = assessment([word('hello', 0), word('there', 400)]);
    const o = evaluateCheck('A1', ['pronunciation', 'grammar'], {
      pron: [good, good],
      grades: [1, 2, 3].map(() => ({ a: good, g: { correct: true, usedTarget: true, corrected: '', feedback: '', grammarScore: 70, vocabularyScore: 60 } })),
      task: null,
    });
    expect(checkPassed(o)).toBe(true);
    const typed = { ...good, engine: 'typed' as const };
    expect(evaluateCheck('A1', ['pronunciation'], { pron: [typed], grades: [], task: null }).parts.pronunciation?.passed).toBe(false);
  });
});

describe('hesitation', () => {
  it('counts fillers, restarts and long pauses', () => {
    const a = assessment([word('um', 0), word('I', 400), word('I', 800), word('think', 1200), word('so', 3200)], { speechMs: 3500 });
    const h = analyzeHesitation(a);
    expect(h.fillers).toBe(1);
    expect(h.repeats).toBe(1);
    expect(h.longPauses).toBe(1);
    expect(h.score).toBeLessThan(100);
    const smooth = analyzeHesitation(assessment([word('I', 0), word('think', 350), word('so', 700)], { speechMs: 1000 }));
    expect(smooth.score).toBeGreaterThan(h.score);
    expect(combineHesitation([h, smooth])?.fillers).toBe(1);
  });
});

describe('journal', () => {
  it('rotates prompts by day', () => {
    expect(JOURNAL_PROMPTS.length).toBeGreaterThan(30);
    expect(promptOfTheDay(new Date(2026, 9, 26))).toBe(promptOfTheDay(new Date(2026, 9, 26, 20)));
    expect(promptOfTheDay(new Date(2026, 9, 26))).not.toBe(promptOfTheDay(new Date(2026, 9, 27)));
  });
});

describe('pitch', () => {
  const sr = 16000;
  const tone = (fn: (t: number) => number, seconds = 0.6) => {
    const s = new Float32Array(sr * seconds);
    let phase = 0;
    for (let i = 0; i < s.length; i++) {
      phase += (2 * Math.PI * fn(i / sr)) / sr;
      s[i] = 0.5 * Math.sin(phase) + 0.2 * Math.sin(2 * phase);
    }
    return s;
  };
  it('finds the pitch of a steady voice-like tone', () => {
    const frames = pitchTrack(tone(() => 200), sr).filter((f) => f.hz != null);
    expect(frames.length).toBeGreaterThan(20);
    const avg = frames.reduce((a, f) => a + f.hz!, 0) / frames.length;
    expect(avg).toBeGreaterThan(190);
    expect(avg).toBeLessThan(210);
  });
  it('matches rising with rising, not with falling', () => {
    const rise = toContour(pitchTrack(tone((t) => 150 + 150 * t), sr));
    const rise2 = toContour(pitchTrack(tone((t) => 220 + 200 * t), sr));
    const fall = toContour(pitchTrack(tone((t) => 300 - 150 * t), sr));
    expect(rise.range).toBeGreaterThan(3);
    expect(melodyMatch(rise, rise2)!).toBeGreaterThan(80);
    expect(melodyMatch(rise, fall)!).toBeLessThan(20);
  });
});

describe('own text', () => {
  it('splits pasted text into shadowable chunks', async () => {
    const { splitForShadowing } = await import('../src/engine/text.ts');
    expect(splitForShadowing('Hi team.  Quick update on the release!\nWe are on track')).toEqual(['Hi team.', 'Quick update on the release!', 'We are on track']);
    const long = 'We reviewed the numbers from the last quarter, compared them with the forecast from January, talked to the sales team about the gaps, and agreed on three changes to the plan for next year.';
    expect(splitForShadowing(long, 15).length).toBeGreaterThan(1);
    expect(splitForShadowing(long, 15).join(' ')).toBe(long);
  });
});

describe('exam plan', () => {
  it('moves through phases as the exam gets closer', async () => {
    const { examPlan, daysUntil } = await import('../src/engine/exam.ts');
    const now = new Date(2026, 9, 26, 10).getTime();
    expect(daysUntil('2026-11-05', now)).toBe(10);
    expect(examPlan(undefined, 5, 4, now).phase).toBe('none');
    expect(examPlan('2027-02-01', 5, 4, now).phase).toBe('build');
    expect(examPlan('2026-11-30', 5, 4, now).phase).toBe('focus');
    const final = examPlan('2026-11-05', 5, 4, now);
    expect(final.phase).toBe('final');
    expect(final.today).not.toBeNull();
    expect(final.gap).toBe(1);
    expect(examPlan('2026-10-01', 5, 4, now).phase).toBe('past');
  });
});

describe('achievements and XP', () => {
  it('gives XP, unit bonuses and unlocks badges once', async () => {
    const { rewardAttempt, levelFromXp, UNIT_BONUS } = await import('../src/engine/gamification.ts');
    const u = emptyUser();
    const a = { at: Date.now(), kind: 'journal' as const, title: 'Journal', seconds: 120, scores: {} };
    const r1 = rewardAttempt(u, a);
    expect(r1.xp).toBe(10 + 15);
    expect(r1.unlocked.map((x) => x.id)).toContain('first-words');
    expect(rewardAttempt(u, a).unlocked.map((x) => x.id)).not.toContain('first-words');
    testOutLevel(u, 'A1');
    const r3 = rewardAttempt(u, { ...a, kind: 'placement', title: 'Level test: A1 passed' });
    expect(r3.xp).toBeGreaterThanOrEqual(6 * UNIT_BONUS);
    expect(r3.unlocked.map((x) => x.id)).toEqual(expect.arrayContaining(['level-A1', 'fast-track']));
    expect(levelFromXp(0).level).toBe(1);
    expect(levelFromXp(200)).toEqual({ level: 3, from: 200, to: 450 });
  });
});

describe('voices', () => {
  it('maps HD voices to a standard fallback and ranks browser voices', async () => {
    const { standardVoiceFor, isHdVoice, browserVoiceRank } = await import('../src/speech/voices.ts');
    expect(isHdVoice('en-US-Ava:DragonHDLatestNeural')).toBe(true);
    expect(standardVoiceFor('en-US-Emma2:DragonHDLatestNeural')).toBe('en-US-EmmaMultilingualNeural');
    expect(standardVoiceFor('en-US-Davis:DragonHDLatestNeural')).toBe('en-US-DavisNeural');
    expect(standardVoiceFor('en-US-JennyNeural')).toBe('en-US-JennyNeural');
    const natural = browserVoiceRank({ name: 'Microsoft Ava Online (Natural) - English (United States)', lang: 'en-US' });
    const google = browserVoiceRank({ name: 'Google US English', lang: 'en-US' });
    const david = browserVoiceRank({ name: 'Microsoft David - English (United States)', lang: 'en-US' });
    expect(natural).toBeGreaterThan(google);
    expect(google).toBeGreaterThan(david);
  });
});

describe('accent check-up', () => {
  it('scores sounds from phonemes, clusters from words, stress from prosody', async () => {
    const { checkupScores } = await import('../src/engine/checkup.ts');
    const { CHECKUP_PASSAGE } = await import('../src/content/checkup.ts');
    expect(CHECKUP_PASSAGE).toMatch(/Thursday/);
    const a: Assessment = {
      engine: 'azure', text: 'three screen', accuracy: 80, fluency: 80, completeness: 100, prosody: 72, pron: 80,
      startDelayMs: 0, speechMs: 1000, wordsPerMinute: 120, longPauses: 0,
      words: [
        { word: 'three', accuracy: 70, error: 'None', phonemes: [{ phoneme: 'θ', accuracy: 40 }, { phoneme: 'ɹ', accuracy: 90 }, { phoneme: 'i', accuracy: 95 }] },
        { word: 'screen', accuracy: 88, error: 'None', phonemes: [] },
      ],
    };
    const s = checkupScores(a);
    expect(s['th-voiceless']).toBe(40);
    expect(s['r']).toBe(90);
    expect(s['clusters-start']).toBe(88);
    expect(s['word-stress']).toBe(72);
    expect(s['p-b']).toBeUndefined();
  });
});

describe('tutor memory', () => {
  it('merges facts newest first without duplicates', async () => {
    const { mergeNotes, rememberSession } = await import('../src/engine/memory.ts');
    expect(mergeNotes(['Lives in Dubai', 'Has two kids'], ['lives in Dubai.', 'Works as a PM'], 3)).toEqual(['lives in Dubai.', 'Works as a PM', 'Has two kids']);
    const u = emptyUser();
    rememberSession(u, ['Works as a PM'], 'Remote work');
    expect(u.memory).toEqual({ facts: ['Works as a PM'], topics: ['Remote work'] });
  });
});

describe('rhythm marks', () => {
  it('marks stress, weak forms and linking', async () => {
    const { annotate } = await import('../src/engine/rhythm.ts');
    const t = annotate('Pick it up and put it on the table.');
    expect(t.map((x) => x.linkNext)).toEqual([true, true, true, false, true, true, false, false, false]);
    expect(t.find((x) => x.text === 'the')?.stress).toBe('weak');
    expect(t.find((x) => x.text === 'table.')?.stress).toBe('strong');
    expect(annotate("We didn't expect it")[1].stress).toBe('strong');
    expect(annotate('Make it, please')[0].linkNext).toBe(true);
    expect(annotate('Make it, please')[1].linkNext).toBe(false);
  });
});
