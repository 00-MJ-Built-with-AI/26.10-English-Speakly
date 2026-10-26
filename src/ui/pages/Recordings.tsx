import { useEffect, useRef, useState } from 'react';
import { useApp } from '../../lib/store.tsx';
import type { Recording } from '../../lib/types.ts';
import { Icon } from '../components/Icon.tsx';

type R = Recording & { id: string };

const KINDS: [string, string][] = [
  ['', 'All'],
  ['tutor', 'Conversations'],
  ['roleplay', 'Role-plays'],
  ['readaloud', 'Read aloud'],
  ['toefl', 'TOEFL'],
  ['testout', 'Unit checks'],
];

export function Recordings() {
  const { repo, user, update } = useApp();
  const [items, setItems] = useState<R[] | null>(null);
  const [kind, setKind] = useState('');
  const [playing, setPlaying] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    repo.list<Recording>('recordings', { limit: 300 }).then(setItems);
    return () => audio.current?.pause();
  }, [repo]);

  async function play(r: R) {
    audio.current ??= new Audio();
    if (playing === r.id) {
      audio.current.pause();
      setPlaying(null);
      return;
    }
    try {
      audio.current.src = await repo.audioUrl(r.path);
      audio.current.onended = () => setPlaying(null);
      await audio.current.play();
      setPlaying(r.id);
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
  }

  async function remove(r: R) {
    if (!confirm('Delete this recording?')) return;
    await repo.removeAudio(r.path);
    await repo.remove('recordings', r.id);
    setItems((x) => x?.filter((y) => y.id !== r.id) ?? null);
  }

  const shown = (items ?? []).filter((r) => !kind || r.kind === kind);
  const first = shown[shown.length - 1];
  const latest = shown[0];
  return (
    <div className="stack">
      <h1>My recordings</h1>
      <div className="toggle card" style={{ padding: '10px 16px' }}>
        <span>
          <b>Keep recordings</b>
          <div className="small muted">Saved to your account so you can hear how you improve.</div>
        </span>
        <input type="checkbox" checked={user.settings.keepRecordings} onChange={(e) => update((u) => (u.settings.keepRecordings = e.target.checked))} />
      </div>
      <div className="row">
        {KINDS.map(([k, label]) => (
          <button key={k} className={`btn small ${kind === k ? 'primary' : ''}`} onClick={() => setKind(k)}>
            {label}
          </button>
        ))}
      </div>
      {first && latest && first.id !== latest.id && (
        <div className="card">
          <h3>Then and now</h3>
          <div className="grid grid-2">
            {[first, latest].map((r, k) => (
              <div key={r.id} className="soft">
                <div className="small muted">{k === 0 ? 'Your first' : 'Your latest'} · {new Date(r.at).toLocaleDateString()}</div>
                <div className="spread">
                  <b className="small">{r.title}</b>
                  <button className="btn small" onClick={() => play(r)}>
                    <Icon name={playing === r.id ? 'stop' : 'play'} size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {items == null ? (
        <p className="muted">Loading…</p>
      ) : shown.length === 0 ? (
        <p className="muted">No recordings yet. Conversations, role-plays, read-aloud, TOEFL answers and unit checks are recorded automatically.</p>
      ) : (
        shown.map((r) => (
          <div key={r.id} className="list-item" style={{ cursor: 'default' }}>
            <button className="btn small" onClick={() => play(r)} aria-label="Play">
              <Icon name={playing === r.id ? 'stop' : 'play'} size={14} />
            </button>
            <span className="grow">
              <b className="small">{r.title}</b>
              <div className="small muted">
                {new Date(r.at).toLocaleString()} · {r.seconds}s{r.score != null ? ` · score ${r.score}` : ''}
              </div>
            </span>
            <button className="btn ghost small danger" onClick={() => remove(r)} aria-label="Delete">
              <Icon name="trash" size={16} />
            </button>
          </div>
        ))
      )}
    </div>
  );
}
