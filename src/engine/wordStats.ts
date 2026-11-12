/** Word course extras: fixes, misses, history, vocabulary estimate, tutor words. */
import { dateKey } from './progress.ts';
import { LEARNED_BOX } from './srs.ts';
import { KNOWN, TOTAL_WORDS, type WordCard, type WordsData } from './words.ts';

/** The learner's own corrections to a card. */
export type CardFix = Partial<Pick<WordCard, 'english' | 'arabic' | 'arabicDesc'>>;

export const applyFix = (card: WordCard, fixes: WordsData['fixes']): WordCard => ({ ...card, ...(fixes?.[card.rank] ?? {}) });

export function noteMiss(w: WordsData, rank: number): void {
  w.misses = { ...w.misses, [rank]: (w.misses?.[rank] ?? 0) + 1 };
}

/** Day-by-day count of new words studied, for the weekly chart. */
export function noteLearned(w: WordsData, n = 1, now = Date.now()): void {
  const day = dateKey(now);
  w.history = { ...w.history, [day]: (w.history?.[day] ?? 0) + n };
}

/** Words missed most that are not learned for good yet, hardest first. */
export function hardestWords(w: WordsData, limit = 20): { rank: number; misses: number }[] {
  return Object.entries(w.misses ?? {})
    .map(([r, n]) => ({ rank: Number(r), misses: n }))
    .filter((x) => x.misses > 0 && (w.items[x.rank]?.[0] ?? 0) < LEARNED_BOX)
    .sort((a, b) => b.misses - a.misses || a.rank - b.rank)
    .slice(0, limit);
}

/**
 * Estimated number of the 5,000 words the learner knows: words marked known or learned for good,
 * half of those still in review, and for words not reached yet the share marked known among the
 * last 300 words seen (only once at least 50 have been seen).
 */
export function vocabularyEstimate(w: WordsData): { estimate: number; sure: number } {
  const entries = Object.entries(w.items).map(([r, s]) => [Number(r), s[0]] as const);
  const sure = entries.filter(([, b]) => b === KNOWN || b >= LEARNED_BOX).length;
  const half = entries.filter(([, b]) => b >= 0 && b < LEARNED_BOX).length * 0.5;
  const recent = [...entries].sort((a, b) => b[0] - a[0]).slice(0, 300);
  const rate = recent.length >= 50 ? recent.filter(([, b]) => b === KNOWN).length / recent.length : 0;
  const unseen = TOTAL_WORDS - entries.length;
  return { estimate: Math.round(sure + half + rate * unseen), sure };
}

/** New words per week for the last `weeks` weeks, oldest first. */
export function weeklyNew(w: WordsData, weeks = 8, now = Date.now()): { week: string; n: number }[] {
  const out: { week: string; n: number }[] = [];
  for (let k = weeks - 1; k >= 0; k--) {
    let n = 0;
    for (let d = 0; d < 7; d++) n += w.history?.[dateKey(now - (k * 7 + d) * 86_400_000)] ?? 0;
    out.push({ week: dateKey(now - k * 7 * 86_400_000).slice(5), n });
  }
  return out;
}

/** Ranks the tutor should bring into conversation: words still early in review, most recently studied first. */
export function tutorWordRanks(w: WordsData | undefined, limit = 10): number[] {
  if (!w) return [];
  return Object.entries(w.items)
    .filter(([, [b]]) => b >= 0 && b <= 3)
    .sort((a, b) => b[1][1] - a[1][1] || Number(b[0]) - Number(a[0]))
    .slice(0, limit)
    .map(([r]) => Number(r));
}

/** Common written forms of a base word (plural, past, -ing, third person), for spotting it in speech. */
export function simpleForms(word: string): string[] {
  const w = word.toLowerCase();
  const out = new Set([w, `${w}s`, `${w}es`, `${w}ed`, `${w}d`, `${w}ing`]);
  if (w.endsWith('e')) out.add(`${w.slice(0, -1)}ing`);
  if (/[^aeiou]y$/.test(w)) {
    out.add(`${w.slice(0, -1)}ies`);
    out.add(`${w.slice(0, -1)}ied`);
  }
  if (/[^aeiou][aeiou][bdgmnprt]$/.test(w)) {
    out.add(`${w}${w.at(-1)}ed`);
    out.add(`${w}${w.at(-1)}ing`);
  }
  return [...out];
}

/** Which of the given words appear in what the learner said, in any common form. */
export function wordsUsed(text: string, words: { rank: number; word: string }[]): number[] {
  const said = new Set(text.toLowerCase().match(/[a-z']+/g) ?? []);
  return words.filter((w) => simpleForms(w.word).some((f) => said.has(f))).map((w) => w.rank);
}
