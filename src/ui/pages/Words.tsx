import { useEffect, useMemo, useRef, useState } from 'react';
import { availablePacks, loadCards, loadPack } from '../../content/wordPacks.ts';
import { dateKey } from '../../engine/progress.ts';
import { wordAccuracy } from '../../engine/text.ts';
import {
  dueRanks,
  emptyWords,
  gradeWord,
  KNOWN,
  keySentence,
  makeQuestion,
  MILESTONES,
  nextNew,
  packRange,
  PACKS,
  PACK_SIZE,
  plainText,
  seenInPack,
  seenUpTo,
  TOTAL_WORDS,
  wordCounts,
  type QuizQuestion,
  type WordCard,
  type WordsData,
} from '../../engine/words.ts';
import { go, href } from '../../lib/router.ts';
import { useApp } from '../../lib/store.tsx';
import { Icon } from '../components/Icon.tsx';
import { MicControl, ScoreChips, useElapsed, useListen, useSpeak, WordScores } from '../components/speaking.tsx';
import type { Assessment } from '../../speech/index.ts';

function useWords(): [WordsData, (fn: (w: WordsData) => void) => void] {
  const { user, update } = useApp();
  return [user.words ?? emptyWords(), (fn) => update((u) => fn((u.words ??= emptyWords())))];
}

const learnedToday = (w: WordsData) => (w.today.date === dateKey() ? w.today.n : 0);

function usePacks(): Set<number> | null {
  const [p, setP] = useState<Set<number> | null>(null);
  useEffect(() => {
    availablePacks().then(setP);
  }, []);
  return p;
}

/** Progress, milestones, today's goal and all 50 packs. */
export function WordsHome() {
  const [w, set] = useWords();
  const packs = usePacks();
  const counts = wordCounts(w.items);
  const due = dueRanks(w.items).length;
  const today = learnedToday(w);
  const ready = packs ? packs.size * PACK_SIZE : 0;
  const unseenLeft = packs ? nextNew(w.items, 1, packs).length > 0 : false;
  const next = MILESTONES.find((m) => seenUpTo(w.items, m) < m) ?? TOTAL_WORDS;
  return (
    <div className="stack">
      <h1>5,000 most used words</h1>
      <p className="muted" style={{ margin: 0 }}>
        In order of how often English uses them. Each word comes in a short paragraph with its meaning in English and Arabic.
      </p>
      {packs && packs.size < PACKS && (
        <div className="banner">
          {ready.toLocaleString()} of {TOTAL_WORDS.toLocaleString()} words are ready. The other packs appear here once they have been written.
        </div>
      )}
      <div className="card stack">
        <div className="spread">
          <div>
            <div className="section-title">Today</div>
            <b style={{ fontSize: '1.5rem' }}>
              {today} / {w.daily}
            </b>{' '}
            <span className="muted">new words</span>
          </div>
          <label className="row small">
            <span className="muted">Daily goal</span>
            <select value={w.daily} onChange={(e) => set((x) => (x.daily = Number(e.target.value)))} style={{ width: 'auto' }}>
              {[10, 20, 30, 40, 50].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="bar">
          <span style={{ width: `${Math.min(100, (today / w.daily) * 100)}%`, background: today >= w.daily ? 'var(--good)' : undefined }} />
        </div>
        <div className="row">
          <button className="btn primary" onClick={() => go('/words/learn')} disabled={!unseenLeft}>
            <Icon name="book" size={16} /> {today >= w.daily ? 'Learn more words' : 'Learn new words'}
          </button>
          <button className={`btn ${due ? 'primary' : ''}`} onClick={() => go('/words/review')} disabled={!due}>
            <Icon name="repeat" size={16} /> Review ({due})
          </button>
        </div>
      </div>
      <div className="card stack">
        <div className="spread">
          <h3 style={{ margin: 0 }}>Milestones</h3>
          <span className="small muted">
            {counts.known} known · {counts.learning} in review · {counts.learned} learned
          </span>
        </div>
        {MILESTONES.map((m) => {
          const s = seenUpTo(w.items, m);
          return (
            <div key={m}>
              <div className="spread small">
                <span style={m === next ? { fontWeight: 700 } : undefined}>First {m.toLocaleString()} words</span>
                <span className={s === m ? '' : 'muted'} style={s === m ? { color: 'var(--good)' } : undefined}>
                  {s === m ? '✓' : `${s} / ${m}`}
                </span>
              </div>
              <div className="bar">
                <span style={{ width: `${(s / m) * 100}%`, background: s === m ? 'var(--good)' : undefined }} />
              </div>
            </div>
          );
        })}
      </div>
      <div className="card">
        <h3>Packs of 100</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(92px, 1fr))', gap: 8 }}>
          {Array.from({ length: PACKS }, (_, k) => k + 1).map((p) => {
            const [from, to] = packRange(p);
            const has = packs?.has(p);
            const s = seenInPack(w.items, p);
            return has ? (
              <a key={p} className="soft small" href={href(`/words/pack/${p}`)} style={{ textDecoration: 'none', color: 'inherit', padding: 8 }}>
                <b>
                  {from}-{to}
                </b>
                <div className={s === PACK_SIZE ? '' : 'muted'} style={s === PACK_SIZE ? { color: 'var(--good)' } : undefined}>
                  {s === PACK_SIZE ? '✓ done' : `${s}/100`}
                </div>
              </a>
            ) : (
              <div key={p} className="soft small faint" style={{ padding: 8, opacity: 0.55 }}>
                <b>
                  {from}-{to}
                </b>
                <div>not ready</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** One pack: every word with its status; tap to open the card. */
export function WordPack({ pack }: { pack: number }) {
  const [w, set] = useWords();
  const [cards, setCards] = useState<WordCard[] | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    loadPack(pack)
      .then(setCards)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [pack]);
  const [from, to] = packRange(pack);
  const left = cards ? cards.filter((c) => !w.items[c.rank]).length : 0;
  const status = (r: number) => {
    const s = w.items[r];
    if (!s) return null;
    return s[0] === KNOWN ? 'known' : s[0] >= 6 ? 'learned' : 'review';
  };
  return (
    <div className="stack">
      <a className="small" href={href('/words')}>
        ← All words
      </a>
      <h1>
        Words {from}-{to}
      </h1>
      {error && <div className="banner error">{error}</div>}
      {cards && (
        <>
          <button className="btn primary" onClick={() => go(`/words/learn?pack=${pack}`)} disabled={!left} style={{ alignSelf: 'flex-start' }}>
            <Icon name="book" size={16} /> {left ? `Study this pack (${left} left)` : 'Pack finished'}
          </button>
          <div className="card">
            {cards.map((c) => (
              <div key={c.rank} style={{ borderBottom: '1px solid var(--line)' }}>
                <button className="list-item" style={{ marginTop: 0, width: '100%', border: 'none', background: 'none', textAlign: 'left' }} onClick={() => setOpen(open === c.rank ? null : c.rank)}>
                  <span className="small faint" style={{ width: 36 }}>
                    {c.rank}
                  </span>
                  <b className="grow">{c.word}</b>
                  <span dir="rtl" lang="ar" className="small muted">
                    {c.arabic}
                  </span>
                  {status(c.rank) && <span className={`chip ${status(c.rank) === 'review' ? 'brand' : 'good'}`}>{status(c.rank)}</span>}
                </button>
                {open === c.rank && (
                  <div style={{ padding: '4px 4px 12px' }}>
                    <CardBody card={c} />
                    {!w.items[c.rank] && (
                      <button className="btn small" onClick={() => set((x) => (x.items[c.rank] = [KNOWN, 0]))} style={{ marginTop: 8 }}>
                        I know this
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Paragraph({ text }: { text: string }) {
  const parts = text.split('**');
  return (
    <p style={{ margin: 0, lineHeight: 1.8, fontSize: '1.08rem' }}>
      {parts.map((p, k) =>
        k % 2 ? (
          <b key={k} style={{ color: 'var(--brand)' }}>
            {p}
          </b>
        ) : (
          <span key={k}>{p}</span>
        ),
      )}
    </p>
  );
}

function SayIt({ reference, label }: { reference: string; label: string }) {
  const mic = useListen();
  const [a, setA] = useState<Assessment | null>(null);
  const listening = mic.state === 'listening';
  async function say() {
    setA(null);
    const seconds = Math.min(12, 3 + reference.split(/\s+/).length * 0.7);
    setA(await mic.listen({ reference, maxSeconds: seconds, endSilenceMs: 1200, noSpeechMs: seconds * 1000 }));
  }
  return (
    <div className="stack" style={{ gap: 6 }}>
      <button className="btn small" onClick={say} disabled={listening} style={{ alignSelf: 'flex-start' }}>
        <Icon name="mic" size={14} /> {listening ? 'Listening…' : label}
      </button>
      {listening && (
        <>
          <div className="partial">{mic.partial}</div>
          {!mic.canListen && <MicControl {...mic} onStart={() => {}} onStop={mic.stop} onTyped={mic.submitTyped} canListen={false} />}
        </>
      )}
      {mic.error && <div className="banner error">{mic.error}</div>}
      {a && (
        <div className="soft stack" style={{ gap: 6 }}>
          <WordScores a={a} />
          {a.engine === 'typed' ? <span className="small muted">{Math.round(wordAccuracy(reference, a.text) * 100)}% of the words</span> : <ScoreChips a={a} showFluency={false} />}
        </div>
      )}
    </div>
  );
}

/** The word in context, English meaning, Arabic meaning, other meanings, listening and speaking. */
function CardBody({ card }: { card: WordCard }) {
  const { speak, speaking, stop } = useSpeak();
  const sentence = useMemo(() => keySentence(card.paragraph), [card]);
  useEffect(() => stop, [stop]);
  return (
    <div className="stack">
      <div className="row">
        <span style={{ fontSize: '1.9rem', fontWeight: 800 }}>{card.word}</span>
        <span className="chip">{card.pos}</span>
        {card.academic && <span className="chip brand">Academic</span>}
        <button className="btn small" aria-label={`Hear ${card.word}`} onClick={() => speak(card.word, 0.85)}>
          <Icon name="volume" size={14} />
        </button>
      </div>
      <div className="soft stack">
        <Paragraph text={card.paragraph} />
        <div className="row">
          <button className="btn small" onClick={() => (speaking ? stop() : speak(plainText(card.paragraph), 1))}>
            <Icon name="volume" size={14} /> {speaking ? 'Stop' : 'Listen'}
          </button>
          <button className="btn small ghost" onClick={() => speak(plainText(card.paragraph), 0.75)} disabled={speaking}>
            <Icon name="slow" size={14} /> Slower
          </button>
        </div>
      </div>
      <div>
        <div className="section-title">English</div>
        {card.english}
      </div>
      <div dir="rtl" lang="ar" style={{ textAlign: 'right' }}>
        <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{card.arabic}</div>
        <div style={{ lineHeight: 1.8 }}>{card.arabicDesc}</div>
      </div>
      {card.other.length > 0 && (
        <div className="small stack" style={{ gap: 6 }}>
          <div className="section-title">Other meanings</div>
          {card.other.map((o) => (
            <div key={o.meaning} className="spread" style={{ alignItems: 'flex-start', gap: 12 }}>
              <span>
                {o.meaning}
                <div className="muted">{o.example}</div>
              </span>
              <span dir="rtl" lang="ar" style={{ whiteSpace: 'nowrap' }}>
                {o.arabic}
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <SayIt key={`w-${card.rank}`} reference={card.word} label="Say the word" />
        <SayIt key={`s-${card.rank}`} reference={sentence} label="Say the sentence" />
      </div>
    </div>
  );
}

/** New words one at a time, then a quiz on the ones studied. */
export function WordsLearn({ pack }: { pack?: number }) {
  const app = useApp();
  const [w, set] = useWords();
  const packs = usePacks();
  const elapsed = useElapsed();
  const [card, setCard] = useState<WordCard | null>(null);
  const [studied, setStudied] = useState<WordCard[]>([]);
  const [phase, setPhase] = useState<'cards' | 'quiz' | 'done'>('cards');
  const [error, setError] = useState<string | null>(null);
  const [skipped, setSkipped] = useState(0);
  const goal = useRef(Math.max(pack ? Math.min(w.daily, PACK_SIZE) : w.daily - learnedToday(w), pack ? 1 : Math.min(10, w.daily)));
  const items = useRef(w.items);
  items.current = w.items;

  async function next(seen: Record<string, unknown> = items.current) {
    if (!packs) return;
    const [rank] = nextNew(seen as WordsData['items'], 1, packs, pack);
    if (rank == null) {
      setCard(null);
      setPhase((p) => (p === 'cards' ? 'quiz' : p));
      return;
    }
    try {
      const [c] = await loadCards([rank]);
      setCard(c);
      setError(null);
      window.scrollTo(0, 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
  useEffect(() => {
    next();
  }, [packs]); // first card, once the list of packs is known

  function known() {
    if (!card) return;
    const seen = { ...items.current, [card.rank]: [KNOWN, 0] };
    set((x) => (x.items[card.rank] = [KNOWN, 0]));
    setSkipped((n) => n + 1);
    next(seen);
  }

  function gotIt() {
    if (!card) return;
    const today = dateKey();
    const seen = { ...items.current, [card.rank]: [0, 0] };
    set((x) => {
      x.items[card.rank] = [0, 0];
      x.today = { date: today, n: (x.today.date === today ? x.today.n : 0) + 1 };
    });
    const list = [...studied, card];
    setStudied(list);
    if (list.length >= goal.current) setPhase('quiz');
    else next(seen);
  }

  function finish(results: Map<number, boolean>) {
    set((x) => {
      for (const [rank, right] of results) x.items[rank] = gradeWord(x.items[rank], right);
    });
    app.logAttempt({ at: Date.now(), kind: 'vocab', title: `Words: ${results.size} new`, seconds: elapsed(), scores: {}, detail: { words: results.size } });
    setPhase('done');
  }

  if (phase === 'quiz' && studied.length) return <Quiz title="Check what you learned" cards={studied} onDone={finish} requeue />;
  if (phase === 'quiz' || phase === 'done') {
    return (
      <div className="stack">
        <h1>{studied.length ? 'Well done' : 'No new words left here'}</h1>
        <div className="card stack">
          {studied.length > 0 && (
            <p style={{ margin: 0 }}>
              {studied.length} word{studied.length === 1 ? '' : 's'} studied{skipped ? `, ${skipped} marked as known` : ''}. They come back for review tomorrow.
            </p>
          )}
          <a className="btn primary" href={href('/words')} style={{ alignSelf: 'flex-start' }}>
            Back to words
          </a>
        </div>
      </div>
    );
  }
  return (
    <div className="stack">
      <div className="spread small muted">
        <span>
          {card ? `Word ${card.rank.toLocaleString()} of ${TOTAL_WORDS.toLocaleString()}` : 'Loading…'}
        </span>
        <span>
          {studied.length} / {goal.current} studied
        </span>
      </div>
      <div className="bar">
        <span style={{ width: `${(studied.length / goal.current) * 100}%` }} />
      </div>
      {error && <div className="banner error">{error}</div>}
      {card && (
        <div className="card fade-in" key={card.rank}>
          <CardBody card={card} />
          <div className="row" style={{ marginTop: 16 }}>
            <button className="btn primary" onClick={gotIt}>
              Next <Icon name="next" size={14} />
            </button>
            <button className="btn" onClick={known}>
              <Icon name="check" size={14} /> I know this
            </button>
            {studied.length > 0 && (
              <button className="btn ghost" onClick={() => setPhase('quiz')}>
                Finish now
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const QUIZ_LABEL = { meaning: 'What does this word mean?', arabic: 'Choose the Arabic meaning', cloze: 'Which word completes the text?' } as const;

/** Multiple choice over the given words. With `requeue`, a missed word is asked once more at the end. */
function Quiz({ title, cards, onDone, requeue = false }: { title: string; cards: WordCard[]; onDone: (first: Map<number, boolean>) => void; requeue?: boolean }) {
  const [pool, setPool] = useState<WordCard[]>(cards);
  useEffect(() => {
    const packs = [...new Set(cards.map((c) => Math.ceil(c.rank / PACK_SIZE)))];
    Promise.all(packs.map(loadPack)).then((p) => setPool(p.flat()));
  }, [cards]);
  const [queue, setQueue] = useState(() => cards.map((c) => ({ card: c, turn: 0 })));
  const [picked, setPicked] = useState<number | null>(null);
  const first = useRef(new Map<number, boolean>());
  const cur = queue[0];
  const q: QuizQuestion | null = useMemo(() => (cur ? makeQuestion(cur.card, pool, cur.turn) : null), [cur, pool]);
  if (!cur || !q) return null;
  const done = cards.length - new Set(queue.map((x) => x.card.rank)).size;
  function choose(k: number) {
    if (picked != null || !q) return;
    setPicked(k);
    if (!first.current.has(cur.card.rank)) first.current.set(cur.card.rank, k === q.answer);
  }
  function next() {
    const right = picked === q!.answer;
    const rest = queue.slice(1);
    if (!right && requeue && cur.turn === 0) rest.push({ card: cur.card, turn: 1 });
    if (!rest.length) return onDone(first.current);
    setPicked(null);
    setQueue(rest);
  }
  const shown = picked != null;
  return (
    <div className="stack">
      <h1>{title}</h1>
      <div className="small muted">
        {done} of {cards.length} done
      </div>
      <div className="card stack" key={`${cur.card.rank}-${cur.turn}`}>
        <div className="section-title">{QUIZ_LABEL[q.kind]}</div>
        {q.kind === 'cloze' ? <p style={{ margin: 0, lineHeight: 1.8, fontSize: '1.08rem' }}>{q.prompt}</p> : <div style={{ fontSize: '1.9rem', fontWeight: 800 }}>{q.prompt}</div>}
        {q.options.map((o, k) => {
          const cls = shown ? (k === q.answer ? 'good' : k === picked ? 'bad' : '') : '';
          return (
            <button
              key={k}
              className={`list-item ${cls ? `chip ${cls}` : ''}`}
              disabled={shown}
              dir={q.kind === 'arabic' ? 'rtl' : undefined}
              lang={q.kind === 'arabic' ? 'ar' : undefined}
              onClick={() => choose(k)}
              style={{ marginTop: 0, borderRadius: 10, justifyContent: 'flex-start', whiteSpace: 'normal', textAlign: q.kind === 'arabic' ? 'right' : 'left' }}
            >
              {o}
            </button>
          );
        })}
        {shown && (
          <div className="soft small stack fade-in" style={{ gap: 4 }}>
            <b>{cur.card.word}</b>
            <div>{cur.card.english}</div>
            <div dir="rtl" lang="ar" style={{ textAlign: 'right' }}>
              {cur.card.arabic} — {cur.card.arabicDesc}
            </div>
          </div>
        )}
        {shown && (
          <button className="btn primary" onClick={next} style={{ alignSelf: 'flex-start' }}>
            Next <Icon name="next" size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

/** Words due today (up to 30 at a time). */
export function WordsReview() {
  const app = useApp();
  const [w, set] = useWords();
  const elapsed = useElapsed();
  const [ranks] = useState(() => dueRanks(w.items).slice(0, 30));
  const [cards, setCards] = useState<WordCard[] | null>(null);
  const [score, setScore] = useState<{ right: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    loadCards(ranks)
      .then(setCards)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [ranks]);
  function finish(results: Map<number, boolean>) {
    set((x) => {
      for (const [rank, right] of results) x.items[rank] = gradeWord(x.items[rank], right);
    });
    app.logAttempt({ at: Date.now(), kind: 'vocab', title: `Word review: ${results.size}`, seconds: elapsed(), scores: {}, detail: { words: results.size } });
    setScore({ right: [...results.values()].filter(Boolean).length, total: results.size });
  }
  if (error) return <div className="banner error">{error}</div>;
  if (score || !ranks.length) {
    return (
      <div className="stack">
        <h1>{score ? 'Review done' : 'Nothing to review today'}</h1>
        <div className="card stack">
          {score && (
            <p style={{ margin: 0 }}>
              {score.right} of {score.total} right. Words you missed come back tomorrow; the others wait longer each time.
            </p>
          )}
          <a className="btn primary" href={href('/words')} style={{ alignSelf: 'flex-start' }}>
            Back to words
          </a>
        </div>
      </div>
    );
  }
  if (!cards) return <div className="muted">Loading…</div>;
  return <Quiz title="Word review" cards={cards} onDone={finish} />;
}
