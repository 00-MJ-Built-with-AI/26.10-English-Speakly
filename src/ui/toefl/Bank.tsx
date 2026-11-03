import { useEffect, useRef, useState } from 'react';
import { allItems, clearBank, downloadPack, PACK, type BankItem } from '../../ai/toeflBank.ts';
import { useApp } from '../../lib/store.tsx';
import { Icon } from '../components/Icon.tsx';
import { KIND_LABEL } from './record.ts';

type Difficulty = 'easier' | 'standard' | 'harder';

/** The local question bank: what's saved on this device, and offline packs. */
export function QuestionBank() {
  const { user } = useApp();
  const [items, setItems] = useState<BankItem[]>([]);
  const [difficulty, setDifficulty] = useState<Difficulty>('standard');
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [online, setOnline] = useState(navigator.onLine);
  const abort = useRef<AbortController | null>(null);

  const refresh = () => allItems().then(setItems);
  useEffect(() => {
    refresh();
    const on = () => setOnline(navigator.onLine);
    window.addEventListener('online', on);
    window.addEventListener('offline', on);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', on);
      abort.current?.abort();
    };
  }, []);

  async function download() {
    abort.current = new AbortController();
    setProgress({ done: 0, total: 0 });
    await downloadPack(difficulty, (done, total) => setProgress({ done, total }), abort.current.signal);
    setProgress(null);
    refresh();
  }

  const fresh = items.filter((i) => !i.usedAt).length;
  const missing = PACK.reduce((a, p) => a + Math.max(0, p.n - items.filter((i) => i.kind === p.kind && !i.usedAt && !i.topic && i.difficulty === difficulty).length), 0);
  return (
    <div className="stack">
      <h1>Question bank and offline packs</h1>
      <p className="muted">
        Every set the AI writes is kept on this device. Practice then starts instantly with a fresh set while a new one is written in the background. With no internet (or if the AI can't be
        reached), sets you've already done are reused.
      </p>
      {!online && <div className="banner">You're offline: practice uses the saved sets.</div>}
      <div className="card stack">
        <div className="spread">
          <h3 style={{ margin: 0 }}>Offline pack</h3>
          <span className="chip">
            {fresh} fresh · {items.length} saved
          </span>
        </div>
        <div className="row small">
          <span className="muted">Level:</span>
          {(['easier', 'standard', 'harder'] as const).map((d) => (
            <button key={d} className={`btn small ${difficulty === d ? 'primary' : 'ghost'}`} onClick={() => setDifficulty(d)} disabled={Boolean(progress)}>
              {d === 'easier' ? 'Lower module' : d === 'harder' ? 'Upper module' : 'Standard'}
            </button>
          ))}
        </div>
        <div className="small muted">
          A pack is about {PACK.reduce((a, p) => a + p.n, 0)} fresh sets across Reading, Listening, Writing and Speaking — a few days of practice. {missing ? `${missing} sets to download at this level.` : 'You have a full pack at this level.'}
          {user.settings.dailyCapUsd ? ' Each set is one AI request and counts toward your daily spending limit.' : ''}
        </div>
        {progress ? (
          <div className="stack">
            <div className="bar">
              <span style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} />
            </div>
            <div className="row small">
              <span>
                {progress.done} / {progress.total || '…'} sets
              </span>
              <button className="btn small ghost" onClick={() => abort.current?.abort()}>
                Stop
              </button>
            </div>
          </div>
        ) : (
          <div className="row">
            <button className="btn primary" onClick={download} disabled={!online || !missing}>
              <Icon name="refresh" size={16} /> Download pack
            </button>
            <button
              className="btn ghost danger"
              onClick={async () => {
                if (!confirm('Delete all saved question sets on this device?')) return;
                await clearBank();
                refresh();
              }}
              disabled={!items.length}
            >
              Clear the bank
            </button>
          </div>
        )}
      </div>
      {items.length > 0 && (
        <div className="card">
          <h3>Saved sets</h3>
          {[...new Set(items.map((i) => i.kind))].map((k) => {
            const xs = items.filter((i) => i.kind === k);
            return (
              <div key={k} className="spread small" style={{ padding: '4px 0', borderBottom: '1px solid var(--line)' }}>
                <span>{KIND_LABEL[k]}</span>
                <span className="muted">
                  {xs.filter((i) => !i.usedAt).length} fresh · {xs.length} total
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
