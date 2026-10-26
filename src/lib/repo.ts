import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit as qLimit,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { firebase } from './firebase.ts';
import type { Collection, UserDoc } from './types.ts';

export interface ListOptions {
  limit?: number;
  /** Only items with `at` at or after this time. */
  since?: number;
  /** Only items with `due` at or before this time (mistakes). */
  dueBefore?: number;
}

/** Where progress lives: Firestore + Storage when signed in, this browser in test mode. */
export interface Repo {
  readonly kind: 'cloud' | 'local';
  loadUser(): Promise<UserDoc | null>;
  saveUser(user: UserDoc): Promise<void>;
  add<T extends { at: number }>(coll: Collection, item: T): Promise<string>;
  update(coll: Collection, id: string, patch: Record<string, unknown>): Promise<void>;
  list<T>(coll: Collection, opts?: ListOptions): Promise<(T & { id: string })[]>;
  remove(coll: Collection, id: string): Promise<void>;
  putAudio(id: string, blob: Blob): Promise<string>;
  audioUrl(path: string): Promise<string>;
  removeAudio(path: string): Promise<void>;
}

const clean = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

export class CloudRepo implements Repo {
  readonly kind = 'cloud';
  constructor(private uid: string) {}

  private userRef() {
    return doc(firebase().db, 'users', this.uid);
  }
  private coll(c: Collection) {
    return collection(firebase().db, 'users', this.uid, c);
  }

  async loadUser() {
    const snap = await getDoc(this.userRef());
    return snap.exists() ? (snap.data() as UserDoc) : null;
  }
  async saveUser(user: UserDoc) {
    await setDoc(this.userRef(), clean(user));
  }
  async add<T extends { at: number }>(c: Collection, item: T) {
    const r = await addDoc(this.coll(c), clean(item));
    return r.id;
  }
  async update(c: Collection, id: string, patch: Record<string, unknown>) {
    await updateDoc(doc(this.coll(c), id), clean(patch));
  }
  async list<T>(c: Collection, opts: ListOptions = {}) {
    const parts = [];
    if (opts.dueBefore != null) parts.push(where('due', '<=', opts.dueBefore), orderBy('due', 'asc'));
    else {
      if (opts.since != null) parts.push(where('at', '>=', opts.since));
      parts.push(orderBy('at', 'desc'));
    }
    if (opts.limit) parts.push(qLimit(opts.limit));
    const snap = await getDocs(query(this.coll(c), ...parts));
    return snap.docs.map((d) => ({ ...(d.data() as T), id: d.id }));
  }
  async remove(c: Collection, id: string) {
    await deleteDoc(doc(this.coll(c), id));
  }
  async putAudio(id: string, blob: Blob) {
    const path = `users/${this.uid}/recordings/${id}.webm`;
    await uploadBytes(ref(firebase().storage, path), blob, { contentType: blob.type || 'audio/webm' });
    return path;
  }
  async audioUrl(path: string) {
    return getDownloadURL(ref(firebase().storage, path));
  }
  async removeAudio(path: string) {
    await deleteObject(ref(firebase().storage, path)).catch(() => {});
  }
}

// ---------- local test mode ----------

const PREFIX = 'speakly:';

function idbBlobs(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('speakly-audio', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('blobs');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idb<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await idbBlobs();
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction('blobs', mode).objectStore('blobs'));
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  });
}

export class LocalRepo implements Repo {
  readonly kind = 'local';

  private read<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  }
  private write(key: string, value: unknown) {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  }
  private items<T>(c: Collection) {
    return this.read<(T & { id: string })[]>(c, []);
  }

  async loadUser() {
    return this.read<UserDoc | null>('user', null);
  }
  async saveUser(user: UserDoc) {
    this.write('user', user);
  }
  async add<T extends { at: number }>(c: Collection, item: T) {
    const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
    const all = this.items<T>(c);
    all.push({ ...clean(item), id });
    this.write(c, all.slice(-2000));
    return id;
  }
  async update(c: Collection, id: string, patch: Record<string, unknown>) {
    this.write(
      c,
      this.items<Record<string, unknown>>(c).map((x) => (x.id === id ? { ...x, ...clean(patch) } : x)),
    );
  }
  async list<T>(c: Collection, opts: ListOptions = {}) {
    let all = this.items<T & { at: number; due?: number }>(c);
    if (opts.dueBefore != null) all = all.filter((x) => (x.due ?? 0) <= opts.dueBefore!).sort((a, b) => (a.due ?? 0) - (b.due ?? 0));
    else {
      if (opts.since != null) all = all.filter((x) => x.at >= opts.since!);
      all = all.sort((a, b) => b.at - a.at);
    }
    return (opts.limit ? all.slice(0, opts.limit) : all) as (T & { id: string })[];
  }
  async remove(c: Collection, id: string) {
    this.write(
      c,
      this.items<{ id: string }>(c).filter((x) => x.id !== id),
    );
  }
  async putAudio(id: string, blob: Blob) {
    await idb('readwrite', (s) => s.put(blob, id));
    return `local:${id}`;
  }
  async audioUrl(path: string) {
    const blob = await idb<Blob | undefined>('readonly', (s) => s.get(path.replace(/^local:/, '')));
    if (!blob) throw new Error('Recording not found on this device');
    return URL.createObjectURL(blob);
  }
  async removeAudio(path: string) {
    await idb('readwrite', (s) => s.delete(path.replace(/^local:/, '')));
  }
}
