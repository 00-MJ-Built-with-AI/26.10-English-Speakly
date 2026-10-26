/** Lower-case words without punctuation; keeps apostrophes inside words (don't, it's). */
export function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9'\s-]/g, ' ')
    .replace(/-/g, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/^'+|'+$/g, ''))
    .filter(Boolean);
}

export type AlignOp = { type: 'match' | 'sub'; ref: string; hyp: string } | { type: 'del'; ref: string } | { type: 'ins'; hyp: string };

/** Word-level alignment (edit distance) of what was said against the reference text. */
export function align(reference: string[], hypothesis: string[]): AlignOp[] {
  const n = reference.length;
  const m = hypothesis.length;
  const d: number[][] = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: m + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const same = reference[i - 1] === hypothesis[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + same);
    }
  }
  const ops: AlignOp[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] + (reference[i - 1] === hypothesis[j - 1] ? 0 : 1)) {
      ops.push({ type: reference[i - 1] === hypothesis[j - 1] ? 'match' : 'sub', ref: reference[i - 1], hyp: hypothesis[j - 1] });
      i--;
      j--;
    } else if (i > 0 && d[i][j] === d[i - 1][j] + 1) {
      ops.push({ type: 'del', ref: reference[i - 1] });
      i--;
    } else {
      ops.push({ type: 'ins', hyp: hypothesis[j - 1] });
      j--;
    }
  }
  return ops.reverse();
}

/** Share of reference words said correctly, 0-1. */
export function wordAccuracy(reference: string, said: string): number {
  const ref = words(reference);
  if (!ref.length) return 0;
  return align(ref, words(said)).filter((o) => o.type === 'match').length / ref.length;
}

export function countWords(text: string): number {
  return words(text).length;
}

/** Splits streamed text into finished sentences plus the unfinished rest. */
export function takeSentences(buffer: string): { sentences: string[]; rest: string } {
  // A sentence ends at . ! or ? followed by whitespace; "3.5" or a final "." may still continue.
  const sentences: string[] = [];
  const re = /[.!?]+["')\]]*\s+/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(buffer))) {
    const end = m.index + m[0].length;
    const s = buffer.slice(last, end).trim();
    if (s) sentences.push(s);
    last = end;
  }
  return { sentences, rest: buffer.slice(last) };
}
