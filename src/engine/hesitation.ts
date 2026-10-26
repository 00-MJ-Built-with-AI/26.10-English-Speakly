import type { Assessment } from '../speech/types.ts';
import { words as toWords } from './text.ts';

/** How hesitant one spoken answer was. */
export interface HesitationStats {
  /** um, uh, er... (only when the recogniser keeps them). */
  fillers: number;
  /** Filler phrases used as crutches: "you know", "I mean", "like"... */
  crutches: number;
  /** Repeated or restarted words: "I I think", "the the". */
  repeats: number;
  /** Silences of 0.6-1.2 s inside the answer. */
  pauses: number;
  /** Silences over 1.2 s inside the answer. */
  longPauses: number;
  startDelayMs: number;
  wordsPerMinute: number;
  /** Fillers + repeats + long pauses per minute of speech. */
  perMinute: number;
  /** 0-100, higher = smoother. */
  score: number;
  speechMs: number;
}

const FILLERS = new Set(['um', 'umm', 'uh', 'uhh', 'er', 'erm', 'ah', 'eh', 'hmm', 'mm', 'emm', 'em']);
const CRUTCHES = ['you know', 'i mean', 'kind of', 'sort of', 'like'];

export function analyzeHesitation(a: Assessment): HesitationStats {
  const ws = a.words.filter((w) => w.error !== 'Omission');
  const plain = ws.map((w) => toWords(w.word)[0] ?? '').filter(Boolean);
  const textWords = plain.length ? plain : toWords(a.text);
  let fillers = 0;
  let repeats = 0;
  for (let i = 0; i < textWords.length; i++) {
    if (FILLERS.has(textWords[i])) fillers++;
    else if (i > 0 && textWords[i] === textWords[i - 1] && textWords[i].length > 0) repeats++;
  }
  const joined = ` ${textWords.join(' ')} `;
  let crutches = 0;
  for (const c of CRUTCHES) crutches += joined.split(` ${c} `).length - 1;
  let pauses = 0;
  let longPauses = 0;
  const timed = ws.filter((w) => w.offsetMs != null && w.durationMs != null);
  for (let i = 1; i < timed.length; i++) {
    const gap = timed[i].offsetMs! - (timed[i - 1].offsetMs! + timed[i - 1].durationMs!);
    if (gap > 1200) longPauses++;
    else if (gap > 600) pauses++;
  }
  // Azure marks a pause where it doesn't belong as UnexpectedBreak.
  longPauses = Math.max(longPauses, ws.filter((w) => w.error === 'UnexpectedBreak').length);
  const minutes = Math.max(a.speechMs, 1) / 60000;
  const events = fillers + repeats + longPauses + crutches * 0.5;
  const perMinute = a.speechMs > 3000 ? events / minutes : events;
  const score = Math.round(Math.max(0, Math.min(100, 100 - perMinute * 9 - pauses * 1.5)));
  return {
    fillers,
    crutches,
    repeats,
    pauses,
    longPauses,
    startDelayMs: a.startDelayMs,
    wordsPerMinute: Math.round(a.wordsPerMinute),
    perMinute: Math.round(perMinute * 10) / 10,
    score,
    speechMs: a.speechMs,
  };
}

/** Natural ways to buy time instead of "uhh", by level. */
export const TIME_BUYERS: { level: 'A2' | 'B1' | 'B2' | 'C1'; phrase: string }[] = [
  { level: 'A2', phrase: 'Let me think.' },
  { level: 'A2', phrase: 'Just a second.' },
  { level: 'A2', phrase: 'Good question.' },
  { level: 'B1', phrase: "Well, I'd say that..." },
  { level: 'B1', phrase: "Let me think about that for a moment." },
  { level: 'B1', phrase: "That's a good question." },
  { level: 'B1', phrase: 'How can I put this?' },
  { level: 'B2', phrase: "The way I see it, ..." },
  { level: 'B2', phrase: "To be honest, I haven't thought about it much, but..." },
  { level: 'B2', phrase: "That's an interesting point. I think..." },
  { level: 'B2', phrase: 'What I mean is...' },
  { level: 'C1', phrase: "Off the top of my head, I'd say..." },
  { level: 'C1', phrase: "There are really two sides to this." },
  { level: 'C1', phrase: "I'd have to think about the details, but broadly speaking..." },
  { level: 'C1', phrase: "Let me put it another way." },
];

/** Totals over several answers (a conversation, a drill), weighted by speaking time. */
export function combineHesitation(list: HesitationStats[]): HesitationStats | undefined {
  if (!list.length) return undefined;
  const sum = (k: keyof HesitationStats) => list.reduce((a, s) => a + s[k], 0);
  const speechMs = sum('speechMs');
  const minutes = Math.max(speechMs, 1) / 60000;
  const events = sum('fillers') + sum('repeats') + sum('longPauses') + sum('crutches') * 0.5;
  const perMinute = speechMs > 3000 ? events / minutes : events;
  const wpm = speechMs ? list.reduce((a, s) => a + s.wordsPerMinute * s.speechMs, 0) / speechMs : 0;
  return {
    fillers: sum('fillers'),
    crutches: sum('crutches'),
    repeats: sum('repeats'),
    pauses: sum('pauses'),
    longPauses: sum('longPauses'),
    startDelayMs: Math.round(sum('startDelayMs') / list.length),
    wordsPerMinute: Math.round(wpm),
    perMinute: Math.round(perMinute * 10) / 10,
    score: Math.round(list.reduce((a, s) => a + s.score * Math.max(s.speechMs, 1), 0) / list.reduce((a, s) => a + Math.max(s.speechMs, 1), 0)),
    speechMs,
  };
}
