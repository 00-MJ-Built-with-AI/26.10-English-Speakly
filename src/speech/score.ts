import { align, words as toWords } from '../engine/text.ts';
import type { Assessment, WordScore } from './types.ts';

/** One recognised segment as the engines report it. */
export interface Segment {
  text: string;
  words: WordScore[];
  accuracy?: number;
  fluency?: number;
  prosody?: number;
  durationMs: number;
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const clamp = (x: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, x));

/** Weighted overall pronunciation score in the spirit of Azure's PronScore. */
export function pronScore(a: { accuracy: number; fluency: number; completeness: number; prosody: number | null }, scripted: boolean): number {
  if (scripted) {
    return a.prosody == null
      ? 0.6 * a.accuracy + 0.2 * a.fluency + 0.2 * a.completeness
      : 0.4 * a.accuracy + 0.2 * a.fluency + 0.2 * a.completeness + 0.2 * a.prosody;
  }
  return a.prosody == null ? 0.7 * a.accuracy + 0.3 * a.fluency : 0.5 * a.accuracy + 0.25 * a.fluency + 0.25 * a.prosody;
}

/** Long gaps between words, a sign of hesitation. */
function timing(ws: WordScore[]) {
  const timed = ws.filter((w) => w.offsetMs != null && w.durationMs != null && w.error !== 'Omission');
  if (!timed.length) return { start: 0, speechMs: 0, longPauses: 0 };
  let longPauses = 0;
  for (let i = 1; i < timed.length; i++) {
    const gap = timed[i].offsetMs! - (timed[i - 1].offsetMs! + timed[i - 1].durationMs!);
    if (gap > 1000) longPauses++;
  }
  const last = timed[timed.length - 1];
  return { start: timed[0].offsetMs!, speechMs: last.offsetMs! + last.durationMs! - timed[0].offsetMs!, longPauses };
}

/**
 * Joins segments into one assessment. With a reference text, words are lined up against the
 * reference so skipped words show as omissions and completeness is measured by us.
 */
export function combine(engine: Assessment['engine'], segments: Segment[], reference?: string, startDelayMs?: number): Assessment {
  const said = segments.flatMap((s) => s.words).filter((w) => w.error !== 'Omission');
  const text = segments.map((s) => s.text).join(' ').trim();
  let display: WordScore[] = said;
  let completeness = 100;
  if (reference) {
    const refWords = toWords(reference);
    const ops = align(refWords, said.map((w) => toWords(w.word)[0] ?? w.word.toLowerCase()));
    display = [];
    let k = 0;
    let matched = 0;
    for (const op of ops) {
      if (op.type === 'match') {
        display.push(said[k++]);
        matched++;
      } else if (op.type === 'sub') {
        const w = said[k++];
        display.push({ ...w, word: op.ref, accuracy: Math.min(w.accuracy, 40), error: 'Mispronunciation' });
      } else if (op.type === 'del') {
        display.push({ word: op.ref, accuracy: 0, error: 'Omission', phonemes: [] });
      } else {
        k++;
      }
    }
    completeness = refWords.length ? (matched / refWords.length) * 100 : 0;
  }
  const scored = display.filter((w) => w.error !== 'Omission' && w.error !== 'Insertion');
  const accuracy = scored.length ? avg(scored.map((w) => w.accuracy)) : 0;
  const weighted = (key: 'fluency' | 'prosody') => {
    const have = segments.filter((s) => s[key] != null);
    if (!have.length) return null;
    const ms = have.reduce((a, s) => a + s.durationMs, 0) || 1;
    return have.reduce((a, s) => a + s[key]! * s.durationMs, 0) / ms;
  };
  const t = timing(said);
  const minutes = t.speechMs / 60000;
  const wordsPerMinute = minutes > 0.02 ? said.length / minutes : 0;
  let fluency = weighted('fluency');
  if (fluency == null) {
    // No engine fluency: estimate from pace and pauses.
    fluency = said.length ? clamp(40 + Math.min(wordsPerMinute, 150) / 3 - t.longPauses * 8) : 0;
  }
  const prosody = weighted('prosody');
  const base = { accuracy, fluency, completeness, prosody };
  return {
    engine,
    text,
    reference,
    words: display,
    ...base,
    pron: said.length ? clamp(pronScore(base, Boolean(reference))) : 0,
    startDelayMs: startDelayMs ?? t.start,
    speechMs: t.speechMs,
    wordsPerMinute,
    longPauses: t.longPauses,
  };
}

/** Typed instead of spoken: word matching only, and no pronunciation or fluency evidence. */
export function typedAssessment(text: string, reference?: string): Assessment {
  const ws: WordScore[] = toWords(text).map((w) => ({ word: w, accuracy: 100, error: 'None', phonemes: [] }));
  const a = combine('typed', [{ text, words: ws, durationMs: 0 }], reference, 0);
  return { ...a, fluency: 0, pron: 0, wordsPerMinute: 0 };
}
