import { useEffect, useMemo, useState } from 'react';
import { workingLevel } from '../../engine/path.ts';
import { LEARNED_BOX, review } from '../../engine/srs.ts';
import { wordAccuracy } from '../../engine/text.ts';
import { aiTask } from '../../lib/api.ts';
import { useApp } from '../../lib/store.tsx';
import type { VocabItem } from '../../lib/types.ts';
import type { Assessment } from '../../speech/index.ts';
import { Icon } from '../components/Icon.tsx';
import { MicControl, useElapsed, useListen, useSpeak } from '../components/speaking.tsx';

type V = VocabItem & { id: string };

/** Hide the phrase inside its example so the learner has to recall it. */
function blank(example: string, phrase: string): string {
  const re = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  return re.test(example) ? example.replace(re, '_____') : example;
}

/** Personal phrase bank: phrases from the tutor, journal and "say it better", reviewed by speaking. */
export function Vocab() {
  const app = useApp();
  const [items, setItems] = useState<V[] | null>(null);
  const [mode, setMode] = useState<'list' | 'review'>('list');
  const [q, setQ] = useState('');
  const [phrase, setPhrase] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    app.repo.list<VocabItem>('vocab', { limit: 2000 }).then(setItems);
  }, [app.repo, mode]);

  if (!items) return <p className="muted">Loading…</p>;
  const due = items.filter((v) => v.box < LEARNED_BOX && v.due <= Date.now());
  const learned = items.filter((v) => v.box >= LEARNED_BOX).length;
  const shown = items.filter((v) => !q || `${v.phrase} ${v.meaning}`.toLowerCase().includes(q.toLowerCase()));

  if (mode === 'review') return <VocabReview items={due.slice(0, 15)} onDone={() => setMode('list')} />;

  async function add() {
    const p = phrase.trim();
    if (!p) return;
    setAdding(true);
    setError(null);
    try {
      const d = await aiTask('define', { phrase: p, level: workingLevel(app.user) });
      await app.addVocab([{ phrase: p, meaning: d.meaning, example: d.example }], 'Added by me');
      setPhrase('');
      setItems(await app.repo.list<VocabItem>('vocab', { limit: 2000 }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="stack">
      <h1>My phrases</h1>
      <p className="muted">Phrases from your conversations, journal and "Say it better". Review them by using them out loud.</p>
      <div className="card spread">
        <span>
          <b>{items.length}</b> phrase{items.length === 1 ? '' : 's'} · {learned} learned · <b>{due.length}</b> due
        </span>
        <button className="btn primary" onClick={() => setMode('review')} disabled={!due.length}>
          <Icon name="repeat" size={18} /> Review {Math.min(due.length, 15)}
        </button>
      </div>
      <div className="card stack">
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <input type="text" placeholder="Add a phrase, e.g. touch base" value={phrase} onChange={(e) => setPhrase(e.target.value)} style={{ flex: 1, minWidth: 180 }} />
          <button className="btn" disabled={adding || !phrase.trim()}>
            {adding ? 'Adding…' : 'Add'}
          </button>
        </form>
        {error && <div className="banner error">{error}</div>}
        {items.length > 6 && <input type="text" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />}
      </div>
      {shown.length === 0 ? (
        <p className="muted">No phrases yet. They are added from tutor reports, journal feedback and "Say it better", or add your own above.</p>
      ) : (
        shown.map((v) => (
          <div key={v.id} className="list-item" style={{ cursor: 'default', alignItems: 'flex-start' }}>
            <span className="grow">
              <div className="row">
                <b>{v.phrase}</b>
                {v.box >= LEARNED_BOX ? <span className="chip good">learned</span> : v.due <= Date.now() ? <span className="chip ok">due</span> : null}
              </div>
              <div className="small muted">{v.meaning}</div>
              <div className="small">“{v.example}”</div>
            </span>
            <SpeakButton text={v.example} />
            <button
              className="btn ghost small danger"
              aria-label="Delete"
              onClick={async () => {
                await app.repo.remove('vocab', v.id);
                setItems((x) => x?.filter((y) => y.id !== v.id) ?? null);
              }}
            >
              <Icon name="trash" size={16} />
            </button>
          </div>
        ))
      )}
    </div>
  );
}

function SpeakButton({ text }: { text: string }) {
  const { speak } = useSpeak();
  return (
    <button className="btn ghost small" onClick={() => speak(text)} aria-label="Listen">
      <Icon name="volume" size={16} />
    </button>
  );
}

function VocabReview({ items, onDone }: { items: V[]; onDone: () => void }) {
  const app = useApp();
  const mic = useListen();
  const { speak } = useSpeak();
  const elapsed = useElapsed();
  const [i, setI] = useState(0);
  const [shown, setShown] = useState(false);
  const [res, setRes] = useState<{ a: Assessment; ok: boolean } | null>(null);
  const [right, setRight] = useState(0);
  const v = items[i];
  const cue = useMemo(() => (v ? blank(v.example, v.phrase) : ''), [v]);

  if (!v) {
    return (
      <div className="stack">
        <h1>Phrases reviewed</h1>
        <div className="card">
          {right} of {items.length} used correctly.
        </div>
        <button
          className="btn primary"
          style={{ alignSelf: 'flex-start' }}
          onClick={async () => {
            await app.logAttempt({ at: Date.now(), kind: 'vocab', title: 'Phrase review', seconds: elapsed(), scores: {}, detail: { right, total: items.length } });
            onDone();
          }}
        >
          Done
        </button>
      </div>
    );
  }

  async function attempt() {
    const a = await mic.listen({ maxSeconds: 25, endSilenceMs: 1600, noSpeechMs: 10_000 });
    if (!a) return;
    const ok = wordAccuracy(v.phrase, a.text) >= 0.8;
    setRes({ a, ok });
    const counted = ok && !shown;
    const next = review(v, counted);
    await app.repo.update('vocab', v.id, { box: next.box, due: next.due, reps: next.reps, lapses: next.lapses });
    if (counted) setRight((r) => r + 1);
    if (counted && next.box >= LEARNED_BOX) app.update((u) => (u.counts.vocabLearned = (u.counts.vocabLearned ?? 0) + 1));
  }

  return (
    <div className="stack">
      <div className="spread">
        <h1>Use the phrase</h1>
        <span className="small muted">
          {i + 1} / {items.length}
        </span>
      </div>
      <div className="card stack">
        <div className="section-title">Meaning</div>
        <div className="prompt-text" style={{ fontSize: '1.2rem' }}>
          {v.meaning}
        </div>
        <div className="soft">“{cue}”</div>
        <div className="small muted">Say the full example sentence, or your own sentence with the phrase.</div>
        {shown ? (
          <div className="row">
            <b>{v.phrase}</b>
            <button className="btn small" onClick={() => speak(v.example)}>
              <Icon name="volume" size={14} />
            </button>
          </div>
        ) : (
          !res && (
            <button className="btn small ghost" style={{ alignSelf: 'flex-start' }} onClick={() => setShown(true)}>
              Show the phrase
            </button>
          )
        )}
        {!res && <MicControl {...mic} onStart={attempt} onStop={mic.stop} onTyped={mic.submitTyped} />}
        {res && (
          <div className="stack fade-in">
            <div className="soft">“{res.a.text || '(nothing heard)'}”</div>
            <div className={`banner ${res.ok ? 'info' : 'error'}`}>
              {res.ok ? (shown ? 'Good. It will come back soon.' : 'You used it!') : `Not quite. The phrase is “${v.phrase}”. It comes back tomorrow.`}
            </div>
            <button
              className="btn primary"
              style={{ alignSelf: 'flex-start' }}
              onClick={() => {
                setRes(null);
                setShown(false);
                setI(i + 1);
              }}
            >
              Next <Icon name="next" size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
