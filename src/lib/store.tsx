import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { applySkills } from '../engine/scoring.ts';
import { addPractice } from '../engine/progress.ts';
import { newMistake, sameMistake } from '../engine/srs.ts';
import { getEngine, type SpeechEngine } from '../speech/index.ts';
import { serverStatus, type ServerStatus } from './api.ts';
import type { Repo } from './repo.ts';
import { DEFAULT_SETTINGS, emptyUser, type Attempt, type Mistake, type Recording, type UserDoc } from './types.ts';

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
  saveRecording(blob: Blob | undefined, meta: Omit<Recording, 'path' | 'at'>): Promise<void>;
  signOut?: () => void;
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
        u.settings = { ...DEFAULT_SETTINGS, ...u.settings };
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

  const logAttempt = useCallback(
    async (a: Attempt, opts: { skillWeight?: number } = {}) => {
      update((u) => {
        applySkills(u, a.scores, opts.skillWeight);
        addPractice(u, a.seconds, a.at);
      });
      await repo.add('attempts', a).catch((e) => console.error(e));
    },
    [repo, update],
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
      if (!blob || !latest.current?.settings.keepRecordings) return;
      try {
        const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
        const path = await repo.putAudio(id, blob);
        await repo.add('recordings', { ...meta, path, at: Date.now() });
      } catch (e) {
        console.error('recording not saved', e);
      }
    },
    [repo],
  );

  const value = useMemo(
    () => (user && status && engine ? { user, account, repo, status, engine, update, logAttempt, addMistakes, saveRecording, signOut } : null),
    [user, account, repo, status, engine, update, logAttempt, addMistakes, saveRecording, signOut],
  );

  if (error) return <div className="center-screen">Could not load your progress: {error}</div>;
  if (!value) return <div className="center-screen muted">Loading…</div>;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
