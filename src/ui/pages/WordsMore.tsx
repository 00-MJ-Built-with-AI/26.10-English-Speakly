import { useEffect, useMemo, useRef, useState } from 'react';
import { availablePacks, loadCards } from '../../content/wordPacks.ts';
import { applyFix, hardestWords, noteMiss, vocabularyEstimate, weeklyNew } from '../../engine/wordStats.ts';
import { checkWritten, gradeWord, KNOWN, makeQuestion, MILESTONES, nextNew, seenUpTo, TOTAL_WORDS, wordCounts, type WordCard, type WriteResult } from '../../engine/words.ts';
import { LEARNED_BOX } from '../../engine/srs.ts';
import { href } from '../../lib/router.ts';
import { useApp } from '../../lib/store.tsx';
import { Icon } from '../components/Icon.tsx';
import { useElapsed, useSpeak } from '../components/speaking.tsx';
import { SpellButton, useWords, WriteReview } from './Words.tsx';

const SCAN_SIZE = 20;

/**
 * Quick scan: the next 20 unseen words as a list; tap the ones you don't know, the rest are marked
 * known. One or two of the "known" ones are checked with a quick question before saving.
 */
export function QuickScan() {
  const [w, set] = useWords();
  const [cards, setCards] = useState<WordCard[] | null>(null);
  const [unknown, setUnknown] = useState<Set<number>>(new Set());
  const [peek, setPeek] = useState<number | null>(null);
  const [phase, setPhase] = useState<'pick' | 'check' | 'saved'>('pick');
  const [checks, setChecks] = useState<WordCard[]>([]);
  const [ci, setCi] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [failed, setFailed] = useState<Set<number>>(new Set());
  const [total, setTotal] = useState(0);
  const items = useRef(w.items);
  items.current = w.items;

  async function load() {
    const packs = await availablePacks();
    const ranks = nextNew(items.current, SCAN_SIZE, packs);
    setUnknown(new Set());
    setFailed(new Set());
    setPeek(null);
    setPicked(null);
    setCi(0);
    setPhase('pick');
    setCards(ranks.length ? (await loadCards(ranks)).map((c) => applyFix(c, w.fixes)) : []);
    window.scrollTo(0, 0);
  }
  useEffect(() => {
    load();
  }, []); // first batch

  function done() {
    if (!cards) return;
    const known = cards.filter((c) => !unknown.has(c.rank));
    // Check up to two "known" words so marking known stays honest.
    const sample = [...known].sort(() => Math.random() - 0.5).slice(0, Math.min(2, known.length));
    if (sample.length) {
      setChecks(sample);
      setPhase('check');
    } else save(new Set());
  }

  function save(fail: Set<number>) {
    if (!cards) return;
    const known = cards.filter((c) => !unknown.has(c.rank) && !fail.has(c.rank));
    set((x) => {
      for (const c of known) x.items[c.rank] = [KNOWN, 0];
      for (const r of fail) noteMiss(x, r);
    });
    setTotal((t) => t + known.length);
    setFailed(fail);
    setPhase('saved');
  }

  const q = useMemo(() => (phase === 'check' && cards && checks[ci] ? makeQuestion(checks[ci], cards, 0) : null), [phase, ci, checks, cards]);
  const meaningQ = q && q.kind !== 'meaning' && checks[ci] ? makeQuestion(checks[ci], cards ?? [], (3 - (checks[ci].rank % 3)) % 3) : q;

  if (!cards) return <div className="muted">Loading…</div>;
  if (!cards.length) {
    return (
      <div className="stack">
        <h1>Quick scan</h1>
        <div className="card">No unseen words left. {total ? `${total} marked as known in this scan.` : ''}</div>
      </div>
    );
  }
  if (phase === 'check' && meaningQ) {
    const card = checks[ci];
    const shown = picked != null;
    return (
      <div className="stack">
        <h1>Quick check</h1>
        <p className="muted" style={{ margin: 0 }}>
          You marked “{card.word}” as known. {meaningQ.kind === 'cloze' ? 'Which word completes the text?' : meaningQ.kind === 'arabic' ? 'Choose its Arabic meaning.' : 'What does it mean?'}
        </p>
        <div className="card stack">
          {meaningQ.kind === 'cloze' ? <p style={{ margin: 0, lineHeight: 1.8 }}>{meaningQ.prompt}</p> : <div style={{ fontSize: '1.7rem', fontWeight: 800 }}>{card.word}</div>}
          {meaningQ.options.map((o, k) => (
            <button
              key={k}
              className={`list-item ${shown ? (k === meaningQ.answer ? 'chip good' : k === picked ? 'chip bad' : '') : ''}`}
              disabled={shown}
              dir={meaningQ.kind === 'arabic' ? 'rtl' : undefined}
              onClick={() => setPicked(k)}
              style={{ marginTop: 0, borderRadius: 10, justifyContent: 'flex-start', whiteSpace: 'normal', textAlign: meaningQ.kind === 'arabic' ? 'right' : 'left' }}
            >
              {o}
            </button>
          ))}
          {shown && (
            <button
              className="btn primary"
              style={{ alignSelf: 'flex-start' }}
              onClick={() => {
                const fail = new Set(failed);
                if (picked !== meaningQ.answer) fail.add(card.rank);
                setFailed(fail);
                setPicked(null);
                if (ci + 1 < checks.length) setCi(ci + 1);
                else save(fail);
              }}
            >
              Next <Icon name="next" size={14} />
            </button>
          )}
        </div>
      </div>
    );
  }
  if (phase === 'saved') {
    const knownN = cards.filter((c) => !unknown.has(c.rank) && !failed.has(c.rank)).length;
    return (
      <div className="stack">
        <h1>Quick scan</h1>
        <div className="card stack">
          <p style={{ margin: 0 }}>
            {knownN} marked as known; {unknown.size + failed.size} left to learn{failed.size ? ` (including ${failed.size} from the check)` : ''}. {total} known in this scan so far.
          </p>
          <div className="row">
            <button className="btn primary" onClick={load}>
              Next {SCAN_SIZE} words <Icon name="next" size={14} />
            </button>
            <a className="btn" href={href('/words/learn')}>
              Learn the ones I didn't know
            </a>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="stack">
      <h1>Quick scan</h1>
      <p className="muted" style={{ margin: 0 }}>
        Tap every word you <b>don't</b> know (tap ? to peek at the meaning). Everything else is marked known when you press Done, after a quick check.
      </p>
      <div className="small muted">
        Words {cards[0].rank.toLocaleString()}-{cards[cards.length - 1].rank.toLocaleString()} of {TOTAL_WORDS.toLocaleString()}
      </div>
      <div className="card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
        {cards.map((c) => {
          const off = unknown.has(c.rank);
          return (
            <div key={c.rank} className="soft" style={{ padding: 8, borderColor: off ? 'var(--bad)' : undefined, background: off ? 'var(--bad-soft)' : undefined }}>
              <div className="spread">
                <button
                  onClick={() => setUnknown((s) => (s.has(c.rank) ? new Set([...s].filter((x) => x !== c.rank)) : new Set(s).add(c.rank)))}
                  style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', fontWeight: 700, fontSize: '1.05rem', color: off ? 'var(--bad)' : 'inherit', cursor: 'pointer', textAlign: 'left' }}
                  aria-pressed={off}
                >
                  {c.word}
                </button>
                <button className="btn small ghost" aria-label={`Peek at ${c.word}`} onClick={() => setPeek(peek === c.rank ? null : c.rank)}>
                  ?
                </button>
              </div>
              {peek === c.rank && (
                <div className="small muted">
                  {c.english}
                  <div dir="rtl" lang="ar">
                    {c.arabic}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <button className="btn primary big" onClick={done} style={{ alignSelf: 'flex-start' }}>
        Done: {cards.length - unknown.size} known, {unknown.size} to learn
      </button>
    </div>
  );
}

/** Hear it, then write it: recent words are spoken and you type what you heard. */
export function ListenWrite() {
  const app = useApp();
  const [w, set] = useWords();
  const elapsed = useElapsed();
  const { speak, speaking } = useSpeak();
  const [ranks] = useState(() =>
    Object.entries(w.items)
      .filter(([, [b]]) => b >= 0)
      .sort((a, b) => b[1][1] - a[1][1] || Number(b[0]) - Number(a[0]))
      .slice(0, 20)
      .map(([r]) => Number(r)),
  );
  const [cards, setCards] = useState<WordCard[] | null>(null);
  const [i, setI] = useState(0);
  const [typed, setTyped] = useState('');
  const [result, setResult] = useState<WriteResult | null>(null);
  const [right, setRight] = useState(0);
  const input = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    loadCards(ranks).then((cs) => setCards(cs.map((c) => applyFix(c, w.fixes)).sort(() => Math.random() - 0.5)));
  }, [ranks]);
  const card = cards?.[i];
  const sentence = card ? card.paragraph.replace(/\*\*/g, '').match(/[^.!?]+[.!?]+/g)?.find((s) => s.toLowerCase().includes(card.word.slice(0, 4))) ?? card.word : '';
  useEffect(() => {
    if (card) speak(card.word, 0.85);
    input.current?.focus();
  }, [card?.rank]); // say each new word once
  if (!ranks.length) {
    return (
      <div className="stack">
        <h1>Hear it, then write it</h1>
        <div className="card">
          Learn a few words first; this practice uses the ones you are studying. <a href={href('/words/learn')}>Learn new words</a>
        </div>
      </div>
    );
  }
  if (!cards || !card) {
    if (cards && i >= cards.length) {
      return (
        <div className="stack">
          <h1>Done</h1>
          <div className="card stack">
            <p style={{ margin: 0 }}>
              {right} of {cards.length} written correctly. Words you missed come back for review tomorrow.
            </p>
            <a className="btn primary" href={href('/words')} style={{ alignSelf: 'flex-start' }}>
              Back to words
            </a>
          </div>
        </div>
      );
    }
    return <div className="muted">Loading…</div>;
  }
  function check() {
    if (!card || !typed.trim()) return;
    const r = checkWritten(typed, card.word, card.word);
    setResult(r);
    if (r === 'right' || r === 'base') setRight((n) => n + 1);
    else
      set((x) => {
        noteMiss(x, card.rank);
        x.items[card.rank] = gradeWord(x.items[card.rank], false);
      });
  }
  function next() {
    setTyped('');
    setResult(null);
    if (cards && i + 1 >= cards.length) app.logAttempt({ at: Date.now(), kind: 'vocab', title: `Hear and write: ${cards.length} words`, seconds: elapsed(), scores: {}, detail: { words: cards.length } });
    setI(i + 1);
  }
  const ok = result === 'right' || result === 'base';
  return (
    <div className="stack">
      <h1>Hear it, then write it</h1>
      <div className="small muted">
        {i + 1} of {cards.length} · {right} right
      </div>
      <div className="card stack">
        <div className="row">
          <button className="btn primary" onClick={() => speak(card.word, 0.85)} disabled={speaking}>
            <Icon name="volume" size={16} /> Play the word
          </button>
          <button className="btn" onClick={() => speak(card.word, 0.6)} disabled={speaking}>
            <Icon name="slow" size={16} /> Slower
          </button>
          <button className="btn ghost" onClick={() => speak(sentence, 0.9)} disabled={speaking}>
            In a sentence
          </button>
        </div>
        {!result || !ok ? (
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault();
              result ? next() : check();
            }}
          >
            <input
              ref={input}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="Type what you hear"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              disabled={Boolean(result)}
              style={{ flex: 1, minWidth: 160, fontSize: '1.1rem' }}
              aria-label="What you heard"
            />
            {!result && (
              <button className="btn primary" type="submit" disabled={!typed.trim()}>
                Check
              </button>
            )}
          </form>
        ) : null}
        {result && (
          <div className="stack fade-in">
            <div className={`banner ${ok ? 'info' : 'error'}`}>{ok ? 'Correct!' : result === 'almost' ? `Almost: it is “${card.word}”.` : `It was “${card.word}”.`}</div>
            <div className="row">
              <b style={{ fontSize: '1.4rem' }}>{card.word}</b>
              <SpellButton word={card.word} />
            </div>
            <div className="small">{card.english}</div>
            <div dir="rtl" lang="ar" style={{ textAlign: 'right' }}>
              {card.arabic}
            </div>
            <button className="btn primary" onClick={next} autoFocus style={{ alignSelf: 'flex-start' }}>
              {i + 1 < cards.length ? 'Next word' : 'Finish'} <Icon name="next" size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Vocabulary size, words per week, milestones and the hardest words. */
export function WordStats() {
  const [w] = useWords();
  const est = vocabularyEstimate(w);
  const counts = wordCounts(w.items);
  const weeks = weeklyNew(w);
  const max = Math.max(1, ...weeks.map((x) => x.n));
  const hard = hardestWords(w);
  const [hardCards, setHardCards] = useState<WordCard[]>([]);
  useEffect(() => {
    if (hard.length) loadCards(hard.map((h) => h.rank)).then((cs) => setHardCards(cs.map((c) => applyFix(c, w.fixes))));
  }, [hard.map((h) => h.rank).join(',')]); // reload when the list changes
  const reached = MILESTONES.filter((m) => seenUpTo(w.items, m) === m).length;
  return (
    <div className="stack">
      <h1>Your words</h1>
      <div className="card stack">
        <div className="section-title">Estimated vocabulary (of the 5,000 most used words)</div>
        <div>
          <span style={{ fontSize: '2.6rem', fontWeight: 800, color: 'var(--brand)' }}>{est.estimate.toLocaleString()}</span> <span className="muted">/ {TOTAL_WORDS.toLocaleString()}</span>
        </div>
        <div className="small muted">
          {est.sure.toLocaleString()} sure (known or learned for good); the rest is estimated from how many recent words you already knew. A quick scan makes it more accurate.
        </div>
        <div className="row small">
          <span className="chip good">{counts.known} known</span>
          <span className="chip brand">{counts.learning} in review</span>
          <span className="chip">{counts.learned} learned for good</span>
          <span className="chip">
            {reached} / {MILESTONES.length} milestones
          </span>
        </div>
      </div>
      <div className="card">
        <h3>New words per week</h3>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 120 }}>
          {weeks.map((x) => (
            <div key={x.week} style={{ flex: 1, textAlign: 'center' }} title={`${x.n} words`}>
              <div className="small muted">{x.n || ''}</div>
              <div style={{ height: `${(x.n / max) * 80}px`, background: 'var(--brand)', borderRadius: 6, minHeight: x.n ? 4 : 0 }} />
              <div className="small faint">{x.week}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="card stack">
        <div className="spread">
          <h3 style={{ margin: 0 }}>Hardest words</h3>
          {hard.length > 0 && (
            <a className="btn small primary" href={href('/words/hard')}>
              Practise these
            </a>
          )}
        </div>
        {hard.length ? (
          hardCards.map((c) => (
            <div key={c.rank} className="spread small" style={{ borderBottom: '1px solid var(--line)', padding: '4px 0' }}>
              <span>
                <b>{c.word}</b> <span className="muted">{c.english}</span>
              </span>
              <span className="row">
                <span dir="rtl" lang="ar">
                  {c.arabic}
                </span>
                <span className="chip bad">{hard.find((h) => h.rank === c.rank)?.misses}×</span>
              </span>
            </div>
          ))
        ) : (
          <div className="small muted">No missed words yet. Words you get wrong in reviews and quizzes show up here.</div>
        )}
      </div>
    </div>
  );
}

/** Write the hardest words again; right answers move them on in the review schedule. */
export function HardWords() {
  const app = useApp();
  const [w, set] = useWords();
  const [ranks] = useState(() => hardestWords(w).map((h) => h.rank));
  const [cards, setCards] = useState<WordCard[] | null>(null);
  const [done, setDone] = useState<{ right: number; total: number } | null>(null);
  useEffect(() => {
    loadCards(ranks).then(setCards);
  }, [ranks]);
  if (!ranks.length) return <div className="card">No hard words right now.</div>;
  if (done) {
    return (
      <div className="stack">
        <h1>Hardest words</h1>
        <div className="card stack">
          <p style={{ margin: 0 }}>
            {done.right} of {done.total} right.
          </p>
          <a className="btn primary" href={href('/words/stats')} style={{ alignSelf: 'flex-start' }}>
            Back to your words
          </a>
        </div>
      </div>
    );
  }
  if (!cards) return <div className="muted">Loading…</div>;
  return (
    <WriteReview
      cards={cards}
      title="Hardest words"
      onDone={(results) => {
        set((x) => {
          for (const [rank, ok] of results) {
            if ((x.items[rank]?.[0] ?? 0) < LEARNED_BOX) x.items[rank] = gradeWord(x.items[rank], ok);
            if (ok) x.misses = { ...x.misses, [rank]: Math.max(0, (x.misses?.[rank] ?? 1) - 1) };
            else noteMiss(x, rank);
          }
        });
        app.logAttempt({ at: Date.now(), kind: 'vocab', title: `Hardest words: ${results.size}`, seconds: 0, scores: {}, detail: { words: results.size } });
        setDone({ right: [...results.values()].filter(Boolean).length, total: results.size });
      }}
    />
  );
}
