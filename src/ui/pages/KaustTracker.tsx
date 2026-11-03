import { useState } from 'react';
import type { RecBrief } from '../../../shared/kaust.ts';
import { DEFAULT_DOCS, kaustReminders } from '../../engine/kaust.ts';
import { aiTask } from '../../lib/api.ts';
import { useApp } from '../../lib/store.tsx';
import { emptyKaust, type KaustData, type Recommender } from '../../lib/types.ts';
import { Icon } from '../components/Icon.tsx';

function useKaust(): [KaustData, (fn: (k: KaustData) => void) => void] {
  const { user, update } = useApp();
  const k = user.kaust ?? emptyKaust();
  return [k, (fn) => update((u) => fn((u.kaust ??= emptyKaust())))];
}

const STATUS_LABEL: Record<Recommender['status'], string> = { 'not-asked': 'Not asked', asked: 'Asked', agreed: 'Agreed', submitted: 'Submitted' };

/** Deadlines you enter, the documents checklist, and recommenders with a brief for each. */
export function TrackerPage() {
  const [k, set] = useKaust();
  const [dl, setDl] = useState({ label: '', date: '' });
  const [doc, setDoc] = useState('');
  const [rec, setRec] = useState({ name: '', relation: '', together: '', deadline: '' });
  const reminders = kaustReminders(k);
  const docs = [...DEFAULT_DOCS, ...k.customDocs];
  const doneDocs = docs.filter((d) => k.docs[d.id]).length;
  return (
    <div className="stack">
      <h1>Application tracker</h1>
      {reminders.length > 0 && (
        <div className="banner">
          {reminders.map((r) => (
            <div key={r.title}>
              <b>{r.title}</b>: {r.desc}
            </div>
          ))}
        </div>
      )}
      <div className="card stack">
        <h3 style={{ margin: 0 }}>Deadlines</h3>
        <div className="small faint">Enter the dates from your program's admissions page; the app doesn't look them up. They appear on Today in the last two weeks.</div>
        {[...k.deadlines]
          .sort((a, b) => a.date.localeCompare(b.date))
          .map((d) => (
            <div key={d.id} className="spread small" style={{ borderBottom: '1px solid var(--line)', padding: '4px 0' }}>
              <label className="row" style={{ flexWrap: 'nowrap' }}>
                <input type="checkbox" checked={d.done} onChange={(e) => set((x) => (x.deadlines.find((y) => y.id === d.id)!.done = e.target.checked))} />
                <span style={d.done ? { textDecoration: 'line-through', color: 'var(--muted)' } : undefined}>
                  <b>{d.date}</b> · {d.label}
                </span>
              </label>
              <button className="btn small ghost" aria-label="Remove" onClick={() => set((x) => (x.deadlines = x.deadlines.filter((y) => y.id !== d.id)))}>
                <Icon name="trash" size={14} />
              </button>
            </div>
          ))}
        <div className="row">
          <input value={dl.label} onChange={(e) => setDl({ ...dl, label: e.target.value })} placeholder="e.g. Application deadline (Fall intake)" style={{ flex: 2, minWidth: 180 }} />
          <input type="date" value={dl.date} onChange={(e) => setDl({ ...dl, date: e.target.value })} style={{ flex: 1, minWidth: 140 }} />
          <button
            className="btn"
            disabled={!dl.label.trim() || !dl.date}
            onClick={() => {
              set((x) => x.deadlines.push({ id: Date.now().toString(36), label: dl.label.trim(), date: dl.date, done: false }));
              setDl({ label: '', date: '' });
            }}
          >
            Add
          </button>
        </div>
      </div>
      <div className="card stack">
        <div className="spread">
          <h3 style={{ margin: 0 }}>Documents</h3>
          <span className="chip">
            {doneDocs}/{docs.length}
          </span>
        </div>
        <div className="small faint">A general list; check your program's page for anything it adds.</div>
        {docs.map((d) => (
          <label key={d.id} className="row small" style={{ flexWrap: 'nowrap' }}>
            <input type="checkbox" checked={Boolean(k.docs[d.id])} onChange={(e) => set((x) => (x.docs[d.id] = e.target.checked))} />
            <span style={k.docs[d.id] ? { textDecoration: 'line-through', color: 'var(--muted)' } : undefined}>{d.label}</span>
          </label>
        ))}
        <div className="row">
          <input value={doc} onChange={(e) => setDoc(e.target.value)} placeholder="Add a document…" style={{ flex: 1, minWidth: 180 }} />
          <button
            className="btn"
            disabled={!doc.trim()}
            onClick={() => {
              set((x) => x.customDocs.push({ id: `c-${Date.now().toString(36)}`, label: doc.trim() }));
              setDoc('');
            }}
          >
            Add
          </button>
        </div>
      </div>
      <div className="card stack">
        <h3 style={{ margin: 0 }}>Recommenders</h3>
        {k.recommenders.map((r) => (
          <RecommenderRow key={r.id} r={r} />
        ))}
        <div className="grid grid-2">
          <input value={rec.name} onChange={(e) => setRec({ ...rec, name: e.target.value })} placeholder="Name, e.g. Dr. Ahmed" />
          <input value={rec.relation} onChange={(e) => setRec({ ...rec, relation: e.target.value })} placeholder="Relation, e.g. thesis supervisor" />
        </div>
        <textarea rows={2} value={rec.together} onChange={(e) => setRec({ ...rec, together: e.target.value })} placeholder="What you did with them: projects, courses, results they saw…" />
        <div className="row">
          <span className="small muted">Letter deadline</span>
          <input type="date" value={rec.deadline} onChange={(e) => setRec({ ...rec, deadline: e.target.value })} style={{ width: 'auto' }} />
          <button
            className="btn"
            disabled={!rec.name.trim()}
            onClick={() => {
              set((x) => x.recommenders.push({ id: Date.now().toString(36), name: rec.name.trim(), relation: rec.relation.trim(), together: rec.together.trim(), deadline: rec.deadline, status: 'not-asked' }));
              setRec({ name: '', relation: '', together: '', deadline: '' });
            }}
          >
            Add recommender
          </button>
        </div>
      </div>
    </div>
  );
}

/** One recommender: status, and an AI-written request email plus a brief of what they could highlight. */
function RecommenderRow({ r }: { r: Recommender }) {
  const [k, set] = useKaust();
  const [brief, setBrief] = useState<RecBrief | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const patch = (fn: (x: Recommender) => void) => set((x) => fn(x.recommenders.find((y) => y.id === r.id)!));
  async function make() {
    setBusy(true);
    setError(null);
    setCopied(false);
    try {
      setBrief(await aiTask('recBrief', { recommender: r, profile: { program: k.program, interests: k.interests, cv: k.cv } }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  const text = brief ? `${brief.email}\n\n---\nWhat you could highlight:\n${brief.highlights.map((h) => `- ${h}`).join('\n')}\n\nFacts and dates:\n${brief.facts.map((f) => `- ${f}`).join('\n')}` : '';
  return (
    <div className="soft stack">
      <div className="spread">
        <span>
          <b>{r.name}</b> {r.relation && <span className="muted">· {r.relation}</span>}
          {r.deadline && <div className="small muted">Letter due {r.deadline}</div>}
        </span>
        <span className="row">
          <select value={r.status} onChange={(e) => patch((x) => (x.status = e.target.value as Recommender['status']))} style={{ width: 'auto' }}>
            {(Object.keys(STATUS_LABEL) as Recommender['status'][]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <button className="btn small ghost" aria-label="Remove" onClick={() => set((x) => (x.recommenders = x.recommenders.filter((y) => y.id !== r.id)))}>
            <Icon name="trash" size={14} />
          </button>
        </span>
      </div>
      {r.together && <div className="small muted">{r.together}</div>}
      <button className="btn small" onClick={make} disabled={busy} style={{ alignSelf: 'flex-start' }}>
        {busy ? 'Writing…' : brief ? 'Write it again' : 'Write a brief for them'}
      </button>
      {error && <div className="banner error">{error}</div>}
      {brief && (
        <div className="stack small fade-in">
          <div style={{ whiteSpace: 'pre-wrap' }}>{brief.email}</div>
          <b>What they could highlight</b>
          <ul style={{ margin: 0 }}>
            {brief.highlights.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
          <b>Facts and dates</b>
          <ul style={{ margin: 0 }}>
            {brief.facts.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
          <button className="btn small" onClick={() => navigator.clipboard?.writeText(text).then(() => setCopied(true))} style={{ alignSelf: 'flex-start' }}>
            {copied ? 'Copied' : 'Copy email and brief'}
          </button>
          <div className="faint">Fill in every [bracket] and send it from your own email.</div>
        </div>
      )}
    </div>
  );
}
