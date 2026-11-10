/** Loads the written word packs from /words (cached by the service worker once opened). */
import { packOf, PACK_SIZE, type WordCard } from '../engine/words.ts';

const packs = new Map<number, Promise<WordCard[]>>();
let manifest: Promise<Set<number>> | undefined;

/** Which packs have been written so far. */
export function availablePacks(): Promise<Set<number>> {
  manifest ??= fetch('/words/manifest.json')
    .then((r) => (r.ok ? (r.json() as Promise<number[]>) : []))
    .then((p) => new Set(p))
    .catch(() => new Set<number>());
  return manifest;
}

export function loadPack(n: number): Promise<WordCard[]> {
  let p = packs.get(n);
  if (!p) {
    p = fetch(`/words/pack-${String(n).padStart(2, '0')}.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`Word pack ${n} could not be loaded.`);
        return r.json() as Promise<Omit<WordCard, 'rank'>[]>;
      })
      .then((cards) => cards.map((c, i) => ({ ...c, rank: (n - 1) * PACK_SIZE + i + 1 })));
    p.catch(() => packs.delete(n));
    packs.set(n, p);
  }
  return p;
}

/** The cards for these ranks, keeping their order. */
export async function loadCards(ranks: number[]): Promise<WordCard[]> {
  const needed = [...new Set(ranks.map(packOf))];
  const loaded = await Promise.all(needed.map(loadPack));
  const byRank = new Map(loaded.flat().map((c) => [c.rank, c]));
  return ranks.map((r) => byRank.get(r)).filter((c): c is WordCard => Boolean(c));
}
