/**
 * A local question bank for TOEFL practice (IndexedDB, per device). Generated items are kept so
 * practice can start instantly, keep working offline, and reuse questions instead of paying for
 * new ones when there's no connection or the AI can't be reached.
 */
import type { GenKind, GenOut, ToeflGenInput } from '../../shared/toefl.ts';
import { aiTask } from '../lib/api.ts';

export interface BankItem {
  id: string;
  kind: GenKind;
  difficulty: ToeflGenInput['difficulty'];
  /** Items made for a specific instruction (grammar pattern, theme) are only reused for the same one. */
  topic: string;
  data: unknown;
  at: number;
  /** When it was last given out; 0 = never used (fresh). */
  usedAt: number;
}

const DB = 'speakly-toefl-bank';
const STORE = 'items';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' });
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(req ? req.result : undefined);
    t.onerror = () => reject(t.error);
  });
}

export async function allItems(): Promise<BankItem[]> {
  try {
    return ((await tx<BankItem[]>('readonly', (s) => s.getAll() as IDBRequest<BankItem[]>)) ?? []) as BankItem[];
  } catch {
    return [];
  }
}

async function put(item: BankItem): Promise<void> {
  try {
    await tx('readwrite', (s) => {
      s.put(item);
    });
  } catch {
    // Storage full or blocked (private mode): the bank is only a speed-up.
  }
}

export async function clearBank(): Promise<void> {
  await tx('readwrite', (s) => {
    s.clear();
  });
}

const id = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

async function generate(input: ToeflGenInput, fresh: boolean): Promise<unknown> {
  const data = await aiTask('toeflGen', input);
  await put({ id: id(), kind: input.kind, difficulty: input.difficulty, topic: input.topic ?? '', data, at: Date.now(), usedAt: fresh ? 0 : Date.now() });
  return data;
}

const refilling = new Set<string>();

/**
 * A practice item: a fresh banked one if there is one (then a replacement is made in the background),
 * else a newly generated one; with no connection or an AI error, the least recently used banked item.
 */
export async function toeflItem<K extends GenKind>(input: ToeflGenInput & { kind: K }): Promise<GenOut<K>> {
  const topic = input.topic ?? '';
  const items = (await allItems()).filter((i) => i.kind === input.kind && i.topic === topic);
  const fresh = items.filter((i) => !i.usedAt && i.difficulty === input.difficulty).sort((a, b) => a.at - b.at)[0];
  const online = typeof navigator === 'undefined' || navigator.onLine;
  if (fresh) {
    await put({ ...fresh, usedAt: Date.now() });
    const key = `${input.kind}:${input.difficulty}:${topic}`;
    if (online && !refilling.has(key)) {
      refilling.add(key);
      generate(input, true)
        .catch(() => {})
        .finally(() => refilling.delete(key));
    }
    return fresh.data as GenOut<K>;
  }
  try {
    if (!online) throw new Error('You are offline.');
    return (await generate(input, false)) as GenOut<K>;
  } catch (e) {
    const old = items.sort((a, b) => (a.difficulty === input.difficulty ? 0 : 1) - (b.difficulty === input.difficulty ? 0 : 1) || a.usedAt - b.usedAt)[0];
    if (!old) throw e;
    await put({ ...old, usedAt: Date.now() });
    return old.data as GenOut<K>;
  }
}

/** Kinds included in an offline pack, with how many fresh sets of each. */
export const PACK: { kind: GenKind; n: number }[] = [
  { kind: 'complete', n: 3 },
  { kind: 'daily', n: 3 },
  { kind: 'academic', n: 3 },
  { kind: 'paraphrase', n: 2 },
  { kind: 'vocab', n: 2 },
  { kind: 'response', n: 3 },
  { kind: 'conversation', n: 3 },
  { kind: 'announcement', n: 2 },
  { kind: 'talk', n: 3 },
  { kind: 'dictation', n: 2 },
  { kind: 'implied', n: 2 },
  { kind: 'build', n: 3 },
  { kind: 'email', n: 2 },
  { kind: 'discussion', n: 2 },
  { kind: 'longRepeat', n: 2 },
];

/** Tops the bank up to the pack sizes (fresh items only), two requests at a time. */
export async function downloadPack(difficulty: ToeflGenInput['difficulty'], onProgress: (done: number, total: number) => void, signal?: AbortSignal): Promise<number> {
  const have = (await allItems()).filter((i) => !i.usedAt && !i.topic && i.difficulty === difficulty);
  const jobs: GenKind[] = [];
  for (const p of PACK) for (let k = have.filter((i) => i.kind === p.kind).length; k < p.n; k++) jobs.push(p.kind);
  let done = 0;
  onProgress(0, jobs.length);
  const worker = async () => {
    while (jobs.length && !signal?.aborted) {
      const kind = jobs.shift()!;
      try {
        await generate({ kind, difficulty }, true);
      } catch {
        // skip this one; the rest of the pack still downloads
      }
      onProgress(++done, done + jobs.length);
    }
  };
  await Promise.all([worker(), worker()]);
  return done;
}
