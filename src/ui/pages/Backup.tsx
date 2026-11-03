import { useState } from 'react';
import { allItems, putItems, type BankItem } from '../../ai/toeflBank.ts';
import { useApp } from '../../lib/store.tsx';
import { migrateUser, type Collection, type UserDoc } from '../../lib/types.ts';
import { Icon } from '../components/Icon.tsx';

/** Everything except recordings (their audio lives in storage and isn't in the file). */
const COLLS: Collection[] = ['attempts', 'mistakes', 'sessions', 'vocab', 'journal', 'texts', 'checkups'];

interface BackupFile {
  app: 'speakly';
  version: 1;
  exportedAt: number;
  user: UserDoc;
  collections: Partial<Record<Collection, ({ at: number } & Record<string, unknown>)[]>>;
  bank: BankItem[];
}

/** Download all progress as one file, and restore it on this or another device. */
export function Backup() {
  const { user, repo, update } = useApp();
  const [busy, setBusy] = useState<string | null>(null);
  const [file, setFile] = useState<BackupFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function exportAll() {
    setBusy('Collecting your data…');
    setError(null);
    try {
      const collections: BackupFile['collections'] = {};
      for (const c of COLLS) collections[c] = (await repo.list<{ at: number } & Record<string, unknown>>(c)).map(({ id: _id, ...rest }) => rest as { at: number } & Record<string, unknown>);
      const data: BackupFile = { app: 'speakly', version: 1, exportedAt: Date.now(), user, collections, bank: await allItems() };
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
      a.download = `speakly-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      setDone(`Saved: ${Object.values(collections).reduce((n, xs) => n + (xs?.length ?? 0), 0)} history items and ${data.bank.length} question sets.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function read(f: File) {
    setError(null);
    setDone(null);
    try {
      const data = JSON.parse(await f.text()) as BackupFile;
      if (data.app !== 'speakly' || !data.user || data.version !== 1) throw new Error('This is not a Speakly backup file.');
      setFile(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function restore() {
    if (!file) return;
    setBusy('Restoring…');
    setError(null);
    try {
      let added = 0;
      for (const c of COLLS) {
        const have = new Set((await repo.list<{ at: number }>(c)).map((x) => x.at));
        for (const item of file.collections[c] ?? []) {
          if (have.has(item.at)) continue;
          await repo.add(c, item);
          added++;
        }
      }
      await putItems(file.bank ?? []);
      const restored = migrateUser(file.user);
      update((u) => {
        for (const k of Object.keys(u)) delete (u as unknown as Record<string, unknown>)[k];
        Object.assign(u, restored);
      });
      setDone(`Restored your progress, ${added} history items and ${file.bank?.length ?? 0} question sets. Reloading…`);
      setTimeout(() => location.reload(), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(null);
    }
  }

  return (
    <div className="stack">
      <h1>Backup and restore</h1>
      <div className="card stack">
        <h3 style={{ margin: 0 }}>Download a backup</h3>
        <p className="small muted" style={{ margin: 0 }}>
          One file with your progress, settings, TOEFL scores and plan, KAUST profile and statement versions, practice history, mistakes and phrases, and the question sets saved on this
          device. Recordings' audio isn't included. Keep it somewhere private: it contains your CV and statement.
        </p>
        <button className="btn primary" onClick={exportAll} disabled={Boolean(busy)} style={{ alignSelf: 'flex-start' }}>
          <Icon name="book" size={16} /> Download backup
        </button>
      </div>
      <div className="card stack">
        <h3 style={{ margin: 0 }}>Restore</h3>
        <p className="small muted" style={{ margin: 0 }}>
          Replaces your current progress and settings with the backup's, and adds its history items and question sets (items already here are skipped).
        </p>
        <input type="file" accept="application/json,.json" onChange={(e) => e.target.files?.[0] && read(e.target.files[0])} disabled={Boolean(busy)} />
        {file && (
          <div className="soft small stack">
            <div>
              Backup from <b>{new Date(file.exportedAt).toLocaleString()}</b>
              {file.user.name ? ` (${file.user.name})` : ''}: {Object.values(file.collections).reduce((n, xs) => n + (xs?.length ?? 0), 0)} history items, {file.bank?.length ?? 0} question sets,{' '}
              {file.user.toefl?.scores?.length ?? 0} TOEFL results.
            </div>
            <button
              className="btn primary"
              disabled={Boolean(busy)}
              onClick={() => confirm('Replace your current progress with this backup?') && restore()}
              style={{ alignSelf: 'flex-start' }}
            >
              Restore this backup
            </button>
          </div>
        )}
      </div>
      {busy && <div className="muted">{busy}</div>}
      {error && <div className="banner error">{error}</div>}
      {done && <div className="banner info">{done}</div>}
    </div>
  );
}
