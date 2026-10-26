import { SOUNDS } from '../content/sounds.ts';
import type { Assessment } from '../speech/types.ts';
import { words as toWords } from './text.ts';

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/**
 * Score for each sound drill from one read-aloud: phoneme accuracy for sounds, word accuracy
 * for clusters and spelling traps, and rhythm (prosody) for stress and intonation.
 */
export function checkupScores(a: Assessment): Record<string, number> {
  const said = a.words.filter((w) => w.error !== 'Omission');
  const out: Record<string, number> = {};
  for (const s of SOUNDS) {
    let v: number | null = null;
    if (s.kind === 'stress' || s.kind === 'rhythm' || s.kind === 'intonation') v = a.prosody;
    else if (s.kind === 'cluster' || !s.ipa.length) {
      const targets = new Set((s.words ?? []).map((w) => toWords(w)[0]));
      v = avg(said.filter((w) => targets.has(toWords(w.word)[0] ?? '')).map((w) => w.accuracy));
      if (v == null && s.id === 'clusters-end') v = avg(said.filter((w) => /(ed|ts|sks|sts)$/i.test(w.word)).map((w) => w.accuracy));
      if (v == null && s.id === 'clusters-start') v = avg(said.filter((w) => /^(s[ptkcl]|pl|pr|br|tr|qu)/i.test(w.word)).map((w) => w.accuracy));
    } else {
      v = avg(said.flatMap((w) => w.phonemes.filter((p) => s.ipa.includes(p.phoneme)).map((p) => p.accuracy)));
    }
    if (v != null) out[s.id] = Math.round(v);
  }
  return out;
}
