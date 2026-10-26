import { useEffect, useState } from 'react';
import { splitForShadowing } from '../../engine/text.ts';
import { useApp } from '../../lib/store.tsx';
import type { SavedText } from '../../lib/types.ts';
import { Icon } from '../components/Icon.tsx';
import { ReadAloud } from './ReadAloud.tsx';
import { Shadowing } from './Shadowing.tsx';

type T = SavedText & { id: string };

/** Practise your own emails, slides or talk scripts: sentence by sentence, or read it all. */
export function MyTexts() {
  const { repo } = useApp();
  const [texts, setTexts] = useState<T[] | null>(null);
  const [editing, setEditing] = useState<{ id?: string; title: string; text: string } | null>(null);
  const [practice, setPractice] = useState<{ t: T; mode: 'shadow' | 'read' } | null>(null);

  useEffect(() => {
    repo.list<SavedText>('texts', { limit: 200 }).then(setTexts);
  }, [repo]);

  async function save() {
    if (!editing || !editing.text.trim()) return;
    const title = editing.title.trim() || editing.text.trim().split(/\s+/).slice(0, 6).join(' ') + '…';
    if (editing.id) {
      await repo.update('texts', editing.id, { title, text: editing.text });
      setTexts((xs) => xs?.map((x) => (x.id === editing.id ? { ...x, title, text: editing.text } : x)) ?? null);
    } else {
      const item: SavedText = { at: Date.now(), title, text: editing.text };
      const id = await repo.add('texts', item);
      setTexts((xs) => [{ ...item, id }, ...(xs ?? [])]);
    }
    setEditing(null);
  }

  if (practice) {
    const back = () => setPractice(null);
    return practice.mode === 'shadow' ? (
      <Shadowing key={practice.t.id} custom={{ title: practice.t.title, sentences: splitForShadowing(practice.t.text) }} onBack={back} />
    ) : (
      <ReadAloud key={practice.t.id} custom={{ title: practice.t.title, text: practice.t.text }} onBack={back} />
    );
  }

  return (
    <div className="stack">
      <div className="spread">
        <div>
          <h1>My texts</h1>
          <p className="muted">Paste an email, your slides' speaker notes or a talk you have to give, and practise saying it.</p>
        </div>
        {!editing && (
          <button className="btn primary" onClick={() => setEditing({ title: '', text: '' })}>
            Add text
          </button>
        )}
      </div>
      {editing && (
        <div className="card stack">
          <input type="text" placeholder="Title (e.g. Monday stand-up, Client pitch)" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
          <textarea rows={8} placeholder="Paste or type your text here…" value={editing.text} onChange={(e) => setEditing({ ...editing, text: e.target.value })} />
          <div className="small muted">{splitForShadowing(editing.text).length} chunks to practise</div>
          <div className="row">
            <button className="btn primary" onClick={save} disabled={!editing.text.trim()}>
              Save
            </button>
            <button className="btn" onClick={() => setEditing(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {texts == null ? (
        <p className="muted">Loading…</p>
      ) : texts.length === 0 && !editing ? (
        <p className="muted">No texts yet.</p>
      ) : (
        texts.map((t) => (
          <div key={t.id} className="card stack">
            <div className="spread">
              <b>{t.title}</b>
              <span className="small muted">{splitForShadowing(t.text).length} chunks</span>
            </div>
            <p className="small muted" style={{ margin: 0 }}>
              {t.text.slice(0, 180)}
              {t.text.length > 180 ? '…' : ''}
            </p>
            <div className="row">
              <button className="btn small primary" onClick={() => setPractice({ t, mode: 'shadow' })}>
                <Icon name="ear" size={16} /> Sentence by sentence
              </button>
              <button className="btn small" onClick={() => setPractice({ t, mode: 'read' })}>
                <Icon name="book" size={16} /> Read it all
              </button>
              <button className="btn small ghost" onClick={() => setEditing({ id: t.id, title: t.title, text: t.text })}>
                Edit
              </button>
              <button
                className="btn small ghost danger"
                aria-label="Delete"
                onClick={async () => {
                  if (!confirm('Delete this text?')) return;
                  await repo.remove('texts', t.id);
                  setTexts((xs) => xs?.filter((x) => x.id !== t.id) ?? null);
                }}
              >
                <Icon name="trash" size={16} />
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
