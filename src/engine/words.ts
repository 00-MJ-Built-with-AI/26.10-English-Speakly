/** The 5,000 most used English words: packs, milestones, spaced review and quizzes. */
import { INTERVALS, LEARNED_BOX, startOfDay } from './srs.ts';

export const TOTAL_WORDS = 5000;
export const PACK_SIZE = 100;
export const PACKS = TOTAL_WORDS / PACK_SIZE;
/** A milestone every 100 words, up to 5,000. */
export const MILESTONES = Array.from({ length: PACKS }, (_, k) => (k + 1) * PACK_SIZE);
export const KNOWN = -1;

export interface WordCard {
  /** 1 = the most used word. */
  rank: number;
  word: string;
  pos: string;
  academic: boolean;
  /** 2-3 sentences with the word marked as **word**. */
  paragraph: string;
  english: string;
  arabic: string;
  arabicDesc: string;
  other: { meaning: string; example: string; arabic: string }[];
  /** 'open': example sentences from Tatoeba and meanings from Wiktionary (credited on the card). */
  source?: 'open';
  /** Related words of the same family (decide: decision, decisive). */
  family?: string[];
  /** Common partners from real sentences (make a decision, depend on). */
  partners?: string[];
}

/** box: KNOWN, or 0-6 (6 = learned for good); due is a day number. */
export type WordState = [box: number, due: number];

export interface WordsData {
  daily: number;
  items: Record<string, WordState>;
  today: { date: string; n: number };
  /** The learner's corrections to cards, by rank. */
  fixes?: Record<string, Partial<Pick<WordCard, 'english' | 'arabic' | 'arabicDesc'>>>;
  /** How often each word was missed. */
  misses?: Record<string, number>;
  /** New words studied per day (YYYY-MM-DD). */
  history?: Record<string, number>;
  /** Bring recent words into tutor conversations (default on). */
  tutorWords?: boolean;
}

export const emptyWords = (): WordsData => ({ daily: 20, items: {}, today: { date: '', n: 0 } });

const DAY = 86_400_000;
export const dayNumber = (now = Date.now()) => Math.round(startOfDay(now) / DAY);

export const packOf = (rank: number) => Math.ceil(rank / PACK_SIZE);
export const packRange = (pack: number): [number, number] => [(pack - 1) * PACK_SIZE + 1, pack * PACK_SIZE];

/** The next unseen ranks in frequency order, only from packs that have been written. */
export function nextNew(items: WordsData['items'], count: number, available: Set<number>, onlyPack?: number): number[] {
  const out: number[] = [];
  const packs = onlyPack ? [onlyPack] : Array.from({ length: PACKS }, (_, k) => k + 1);
  for (const p of packs) {
    if (!available.has(p)) continue;
    const [from, to] = packRange(p);
    for (let r = from; r <= to && out.length < count; r++) if (!items[r]) out.push(r);
    if (out.length >= count) break;
  }
  return out;
}

/** Words due for review today, oldest first. */
export function dueRanks(items: WordsData['items'], now = Date.now()): number[] {
  const today = dayNumber(now);
  return Object.entries(items)
    .filter(([, [box, due]]) => box >= 0 && box < LEARNED_BOX && due <= today)
    .sort((a, b) => a[1][1] - b[1][1] || Number(a[0]) - Number(b[0]))
    .map(([r]) => Number(r));
}

/** After an answer: right moves up a box (1, 3, 7, 14, 30 days); wrong comes back tomorrow. */
export function gradeWord(cur: WordState | undefined, right: boolean, now = Date.now()): WordState {
  const today = dayNumber(now);
  if (!right) return [1, today + 1];
  const box = Math.min(LEARNED_BOX, Math.max(0, cur?.[0] ?? 0) + 1);
  return [box, today + (box >= LEARNED_BOX ? 3650 : INTERVALS[box])];
}

export function wordCounts(items: WordsData['items']) {
  const states = Object.values(items);
  return {
    seen: states.length,
    known: states.filter(([b]) => b === KNOWN).length,
    learning: states.filter(([b]) => b >= 0 && b < LEARNED_BOX).length,
    learned: states.filter(([b]) => b === LEARNED_BOX).length,
  };
}

/** How many of the first `upTo` words have been seen. */
export const seenUpTo = (items: WordsData['items'], upTo: number) => Object.keys(items).filter((r) => Number(r) <= upTo).length;

export const seenInPack = (items: WordsData['items'], pack: number) => {
  const [from, to] = packRange(pack);
  return Object.keys(items).filter((r) => Number(r) >= from && Number(r) <= to).length;
};

export const plainText = (paragraph: string) => paragraph.replace(/\*\*/g, '');

/** The first sentence that contains the marked word, for reading aloud. */
export function keySentence(paragraph: string): string {
  const sentences = paragraph.match(/[^.!?]+[.!?]+/g) ?? [paragraph];
  return plainText((sentences.find((s) => s.includes('**')) ?? sentences[0]).trim());
}

export type QuizKind = 'meaning' | 'arabic' | 'cloze';

export interface QuizQuestion {
  rank: number;
  kind: QuizKind;
  prompt: string;
  options: string[];
  answer: number;
}

function hash(s: string): number {
  let h = 7;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

/** A stable shuffle, so a question looks the same if it is rebuilt. */
function shuffled<T>(xs: T[], seed: number): T[] {
  const a = [...xs];
  let s = seed || 1;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const blank = (paragraph: string) => paragraph.replace(/\*\*[^*]+\*\*/g, '_____');

/** One question for a word; the kind rotates by rank and `turn`. Wrong options come from other words in the pool. */
export function makeQuestion(card: WordCard, pool: WordCard[], turn = 0): QuizQuestion {
  const kinds: QuizKind[] = ['meaning', 'arabic', 'cloze'];
  let kind = kinds[(card.rank + turn) % 3];
  if (kind === 'arabic' && !card.arabic) kind = 'meaning';
  const value = (c: WordCard) => (kind === 'meaning' ? c.english : kind === 'arabic' ? c.arabic : c.word);
  const right = value(card);
  const seen = new Set([right]);
  const wrong: string[] = [];
  for (const c of shuffled(pool, hash(card.word) + turn)) {
    const v = value(c);
    if (c.rank === card.rank || !v || seen.has(v)) continue;
    seen.add(v);
    wrong.push(v);
    if (wrong.length === 3) break;
  }
  const options = shuffled([right, ...wrong], hash(card.word) + 17 + turn);
  const prompt = kind === 'cloze' ? blank(card.paragraph) : card.word;
  return { rank: card.rank, kind, prompt, options, answer: options.indexOf(right) };
}

/** The first sentence with the marked word, split around it: the gap the learner types into. */
export function gapSentence(card: WordCard): { before: string; answer: string; after: string } {
  const sentences = card.paragraph.match(/[^.!?]+[.!?]+/g) ?? [card.paragraph];
  const s = (sentences.find((x) => x.includes('**')) ?? card.paragraph).trim();
  const m = s.match(/^(.*?)\*\*([^*]+)\*\*(.*)$/);
  if (!m) return { before: '', answer: card.word, after: '' };
  return { before: plainText(m[1]), answer: m[2], after: plainText(m[3]) };
}

export type WriteResult = 'right' | 'base' | 'almost' | 'wrong';

function editDistance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

/**
 * Checks a typed word: right (the form the sentence needs), base (the dictionary form, also accepted),
 * almost (one letter off: a spelling slip) or wrong.
 */
export function checkWritten(typed: string, answer: string, word: string): WriteResult {
  const t = typed.trim().toLowerCase().replace(/[.,!?;:"]+$/, '');
  const a = answer.toLowerCase();
  if (t === a) return 'right';
  if (t === word.toLowerCase()) return 'base';
  if (t.length > 2 && (editDistance(t, a) === 1 || editDistance(t, word.toLowerCase()) === 1)) return 'almost';
  return 'wrong';
}

/** Letters for the "Spell it" button, read one by one. */
export const spelled = (word: string) => word.toUpperCase().split('').join(', ');
