import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { applySkills } from '../engine/scoring.ts';
import { addPractice } from '../engine/progress.ts';
import { newMistake, sameMistake } from '../engine/srs.ts';
import { rewardAttempt } from '../engine/gamification.ts';
import { getEngine, type SpeechEngine } from '../speech/index.ts';
import { serverStatus, type ServerStatus } from './api.ts';
import type { Repo } from './repo.ts';
import { emptyUser, migrateUser, type Attempt, type Mistake, type Recording, type UserDoc, type VocabItem } from './types.ts';

export interface Account {
  uid: string;
  name: string;
  email?: string;
  photo?: string;
}

interface AppState {
  user: UserDoc;
  account: Account | null;
  repo: Repo;
  status: ServerStatus;
  engine: SpeechEngine;
  /** Change the user document; saved automatically. */
  update(fn: (u: UserDoc) => void): void;
  /** Store a practice result: history, skills and practice time. */
  logAttempt(a: Attempt, opts?: { skillWeight?: number }): Promise<void>;
  /** Add corrections to the mistake bank (skips ones already there). Returns how many were new. */
  addMistakes(items: Pick<Mistake, 'kind' | 'said' | 'better' | 'why'>[], source: string): Promise<number>;
  /** Saves a recording if the learner keeps recordings; returns its storage path. */
  saveRecording(blob: Blob | undefined, meta: Omit<Recording, 'path' | 'at'>): Promise<string | undefined>;
  /** Add phrases to the vocabulary bank (skips ones already there). Returns how many were new. */
  addVocab(items: Pick<VocabItem, 'phrase' | 'meaning' | 'example'>[], source: string): Promise<number>;
  signOut?: () => void;
}

interface Toast {
  id: number;
  text: string;
  kind: 'info' | 'badge';
}

const Ctx = createContext<AppState | null>(null);

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp outside provider');
  return v;
}

/** Loads the user's progress from the repo and keeps it saved. */
export function AppProvider({ repo, account, signOut, children }: { repo: Repo; account: Account | null; signOut?: () => void; children: ReactNode }) {
  const [user, setUser] = useState<UserDoc | null>(null);
  const [status, setStatus] = useState<ServerStatus | null>(null);
  const [engine, setEngine] = useState<SpeechEngine | null>(null);
  const [error, setError] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef<UserDoc | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [loaded, st, eng] = await Promise.all([repo.loadUser(), serverStatus(), getEngine()]);
        let u = loaded;
        if (!u) {
          u = emptyUser(account?.name?.split(' ')[0] ?? '');
          await repo.saveUser(u);
        }
        u = migrateUser(u);
        if (!alive) return;
        latest.current = u;
        setUser(u);
        setStatus(st);
        setEngine(eng);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      alive = false;
    };
  }, [repo, account]);

  const flush = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = undefined;
    if (latest.current) repo.saveUser(latest.current).catch((e) => console.error('save failed', e));
  }, [repo]);

  useEffect(() => {
    const onHide = () => document.visibilityState === 'hidden' && flush();
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, [flush]);

  const update = useCallback(
    (fn: (u: UserDoc) => void) => {
      if (!latest.current) return;
      const next = structuredClone(latest.current);
      fn(next);
      latest.current = next;
      setUser(next);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(flush, 800);
    },
    [flush],
  );

  const [toasts, setToasts] = useState<Toast[]>([]);
  const notify = useCallback((text: string, kind: Toast['kind'] = 'info') => {
    const id = Math.random();
    setToasts((t) => [...t, { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'badge' ? 5000 : 2500);
  }, []);

  const logAttempt = useCallback(
    async (a: Attempt, opts: { skillWeight?: number } = {}) => {
      let reward: ReturnType<typeof rewardAttempt> | undefined;
      update((u) => {
        applySkills(u, a.scores, opts.skillWeight);
        addPractice(u, a.seconds, a.at);
        reward = rewardAttempt(u, a);
      });
      if (reward && latest.current?.settings.showGamification) {
        notify(`+${reward.xp} XP`);
        for (const ach of reward.unlocked) notify(`Achievement unlocked: ${ach.title}`, 'badge');
      }
      await repo.add('attempts', a).catch((e) => console.error(e));
    },
    [repo, update, notify],
  );

  const addMistakes = useCallback(
    async (items: Pick<Mistake, 'kind' | 'said' | 'better' | 'why'>[], source: string) => {
      if (!items.length) return 0;
      const existing = await repo.list<Mistake>('mistakes', { limit: 500 });
      let added = 0;
      for (const it of items) {
        if (!it.better.trim() || existing.some((e) => sameMistake(e, it))) continue;
        const m = newMistake({ ...it, source });
        existing.push({ ...m, id: '' });
        await repo.add('mistakes', m);
        added++;
      }
      return added;
    },
    [repo],
  );

  const saveRecording = useCallback(
    async (blob: Blob | undefined, meta: Omit<Recording, 'path' | 'at'>) => {
      if (!blob || !latest.current?.settings.keepRecordings) return undefined;
      try {
        const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
        const path = await repo.putAudio(id, blob);
        await repo.add('recordings', { ...meta, path, at: Date.now() });
        return path;
      } catch (e) {
        console.error('recording not saved', e);
        return undefined;
      }
    },
    [repo],
  );

  const addVocab = useCallback(
    async (items: Pick<VocabItem, 'phrase' | 'meaning' | 'example'>[], source: string) => {
      if (!items.length) return 0;
      const existing = await repo.list<VocabItem>('vocab', { limit: 2000 });
      const norm = (x: string) => x.toLowerCase().replace(/[^a-z' ]/g, '').trim();
      const seen = new Set(existing.map((v) => norm(v.phrase)));
      let added = 0;
      for (const it of items) {
        const key = norm(it.phrase);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        const now = Date.now();
        await repo.add('vocab', { ...it, source, at: now, box: 0, due: now, reps: 0, lapses: 0 } satisfies VocabItem);
        added++;
      }
      if (added) update((u) => (u.counts.vocab = (u.counts.vocab ?? 0) + added));
      return added;
    },
    [repo, update],
  );

  const value = useMemo(
    () => (user && status && engine ? { user, account, repo, status, engine, update, logAttempt, addMistakes, saveRecording, addVocab, signOut } : null),
    [user, account, repo, status, engine, update, logAttempt, addMistakes, saveRecording, addVocab, signOut],
  );

  if (error) return <div className="center-screen">Could not load your progress: {error}</div>;
  if (!value) return <div className="center-screen muted">Loading…</div>;
  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>
            {t.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
