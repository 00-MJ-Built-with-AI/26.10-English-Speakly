/**
 * Sentence rhythm marks for practice text: which words carry the beat (content words), which are
 * usually weak (function words), and where a word links into the next one ("pick‿it‿up").
 * Rules of thumb, not a dictionary: good enough to show the pattern while shadowing.
 */
export interface RhythmToken {
  /** The word as written, with its punctuation. */
  text: string;
  stress: 'strong' | 'weak' | 'normal';
  /** Runs straight into the next word. */
  linkNext: boolean;
}

const WEAK = new Set(
  'a an the to for of and but or at from as than that can could would should will shall do does did was were are is am be been being have has had him her them us his its our their your my me we you he she it they i some any there'.split(' '),
);
/** Small words that still carry stress: negatives and question words. */
const STRONG_SMALL = new Set('not no never none nothing nobody what where when why who whom whose which how'.split(' '));

const bare = (w: string) => w.toLowerCase().replace(/[^a-z']/g, '');
const vowelStart = (w: string) => /^[aeiou]/i.test(bare(w)) && !/^(one|once|uni|use|usu|eu)/i.test(bare(w));

function consonantEnd(w: string): boolean {
  const b = bare(w).replace(/'s$/, 's');
  if (!b) return false;
  if (/[^aeiouyw]$/.test(b)) return true;
  // Silent final e after a consonant sounds like a consonant ending: make, time, note.
  return /[^aeiou]e$/.test(b) && b.length > 2;
}

export function annotate(text: string): RhythmToken[] {
  const parts = text.split(/\s+/).filter(Boolean);
  return parts.map((t, i) => {
    const b = bare(t);
    const negContraction = /n't$/.test(b);
    const stress: RhythmToken['stress'] = negContraction || STRONG_SMALL.has(b) ? 'strong' : WEAK.has(b) ? 'weak' : b.length ? 'strong' : 'normal';
    const next = parts[i + 1];
    const linkNext = Boolean(next) && !/[.,;:!?"”)]$/.test(t) && consonantEnd(t) && vowelStart(next);
    return { text: t, stress, linkNext };
  });
}
