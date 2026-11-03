import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Explain, GenKind, GenOut, NotesFeedback, Question, WritingScore } from '../../../shared/toefl.ts';
import { aiTask } from '../../lib/api.ts';
import { useApp } from '../../lib/store.tsx';
import { align, countWords, words as splitWords } from '../../engine/text.ts';
import { Icon } from '../components/Icon.tsx';

/** What a finished task reports: points, and right/wrong per question type for the mistake log. */
export interface TaskOutcome {
  points: number;
  max: number;
  marks: { type: string; correct: boolean }[];
  writing?: WritingScore;
  /** A rewrite of an already scored answer: not counted again in the stats. */
  revision?: boolean;
  /** Missed questions, for the wrong-answer review. */
  missed?: { question: ReviewQuestion; context?: string }[];
}

export interface ReviewQuestion {
  question: string;
  options: string[];
  answer: number;
  type: string;
  explanation: string;
}

const arabicCache = new Map<string, string>();

/** Arabic versions of explanations when the learner turned them on (fetched once per text). */
export function useArabic(texts: string[]): Record<string, string> {
  const { user } = useApp();
  const on = user.toefl.arabic;
  const key = texts.join('\u0001');
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!on) return;
    const need = texts.filter((t) => t && !arabicCache.has(t));
    if (!need.length) return;
    let live = true;
    aiTask('arabic', { texts: need })
      .then((r) => {
        need.forEach((t, k) => arabicCache.set(t, r.arabic[k] ?? ''));
        if (live) setTick((n) => n + 1);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [on, key]); // texts are compared by content
  if (!on) return {};
  return Object.fromEntries(texts.filter((t) => arabicCache.has(t)).map((t) => [t, arabicCache.get(t)!]));
}

export function ArabicLine({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <div className="small" dir="rtl" lang="ar" style={{ textAlign: 'right', color: 'var(--muted)' }}>
      {text}
    </div>
  );
}

/** "Why?": the AI explains a missed question, with follow-up questions. */
export function WhyBox({ q, picked, context }: { q: ReviewQuestion; picked: number | null; context?: string }) {
  const { user } = useApp();
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<{ q: string; a: Explain }[]>([]);
  const [ask, setAsk] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run(followUp?: string) {
    setBusy(true);
    setError(null);
    try {
      const a = await aiTask('explain', {
        context,
        question: q.question,
        options: q.options,
        correct: q.answer,
        picked,
        followUp,
        history: turns.map((t) => ({ q: t.q, a: t.a.answer })),
        arabic: user.toefl.arabic,
      });
      setTurns((x) => [...x, { q: followUp ?? 'Why?', a }]);
      setAsk('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  if (!open) {
    return (
      <button
        className="btn small ghost"
        style={{ alignSelf: 'flex-start' }}
        onClick={() => {
          setOpen(true);
          run();
        }}
      >
        Why? Explain this
      </button>
    );
  }
  return (
    <div className="soft stack small">
      {turns.map((t, k) => (
        <div key={k} className="stack" style={{ gap: 2 }}>
          {k > 0 && <b>{t.q}</b>}
          <div>{t.a.answer}</div>
          <ArabicLine text={t.a.arabic ?? undefined} />
        </div>
      ))}
      {busy && <div className="muted">Thinking…</div>}
      {error && <div className="banner error">{error}</div>}
      <div className="row">
        <input type="text" value={ask} onChange={(e) => setAsk(e.target.value)} placeholder="Ask a follow-up…" onKeyDown={(e) => e.key === 'Enter' && ask.trim() && run(ask.trim())} style={{ flex: 1, minWidth: 160 }} />
        <button className="btn small" disabled={!ask.trim() || busy} onClick={() => run(ask.trim())}>
          Ask
        </button>
      </div>
    </div>
  );
}

export type Mode = 'practice' | 'mock';

const LETTERS = ['A', 'B', 'C', 'D'];

function shuffle<T>(xs: T[], seed: number): T[] {
  const a = [...xs];
  let s = seed || 1;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Multiple-choice questions; in practice mode shows answers and explanations after submitting. */
export function McqList({
  questions,
  mode,
  onSubmit,
  submitLabel = 'Check answers',
  context,
}: {
  questions: (Question | ReviewQuestion)[];
  mode: Mode;
  onSubmit: (o: TaskOutcome) => void;
  submitLabel?: string;
  /** The passage or transcript, for "Why?" and the wrong-answer review. */
  context?: string;
}) {
  const [picked, setPicked] = useState<(number | null)[]>(() => questions.map(() => null));
  const [done, setDone] = useState(false);
  const wrong = done && mode === 'practice' ? questions.filter((q, i) => picked[i] !== q.answer).map((q) => q.explanation) : [];
  const arabic = useArabic(wrong);
  function submit() {
    const marks = questions.map((q, i) => ({ type: q.type, correct: picked[i] === q.answer }));
    setDone(true);
    const missed = questions.filter((q, i) => picked[i] !== q.answer).map((q) => ({ question: q, context }));
    onSubmit({ points: marks.filter((m) => m.correct).length, max: questions.length, marks, missed });
  }
  return (
    <div className="stack">
      {questions.map((q, i) => (
        <div key={i} className="soft stack">
          <b>
            {i + 1}. {q.question}
          </b>
          {q.options.map((o, k) => {
            const show = done && mode === 'practice';
            const cls = show ? (k === q.answer ? 'good' : picked[i] === k ? 'bad' : '') : picked[i] === k ? 'brand' : '';
            return (
              <button
                key={k}
                className={`list-item ${cls ? `chip ${cls}` : ''}`}
                style={{ marginTop: 0, borderRadius: 10, justifyContent: 'flex-start', whiteSpace: 'normal', textAlign: 'left' }}
                disabled={done}
                onClick={() => setPicked((p) => p.map((x, j) => (j === i ? k : x)))}
              >
                <b style={{ width: 22 }}>{LETTERS[k]}</b>
                <span>{o}</span>
              </button>
            );
          })}
          {done && mode === 'practice' && (
            <div className="small muted">
              <span className="chip">{q.type}</span> {q.explanation}
            </div>
          )}
          {done && mode === 'practice' && picked[i] !== q.answer && (
            <>
              <ArabicLine text={arabic[q.explanation]} />
              <WhyBox q={q} picked={picked[i]} context={context} />
            </>
          )}
        </div>
      ))}
      {!done && (
        <button className="btn primary" onClick={submit} disabled={picked.some((p) => p == null)} style={{ alignSelf: 'flex-start' }}>
          {submitLabel}
        </button>
      )}
    </div>
  );
}

/** C-test: the second half of each chosen word is removed; type the missing letters. */
export function CompleteWords({ data, mode, onSubmit }: { data: GenOut<'complete'>; mode: Mode; onSubmit: (o: TaskOutcome) => void }) {
  const parts = useMemo(() => {
    const out: ({ text: string } | { idx: number; word: string; shown: string; missing: string })[] = [];
    let rest = data.text;
    let n = 0;
    for (const w of data.words) {
      const at = rest.search(new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`));
      if (at < 0) continue;
      const keep = Math.ceil(w.length / 2);
      out.push({ text: rest.slice(0, at) });
      out.push({ idx: n++, word: w, shown: w.slice(0, keep), missing: w.slice(keep) });
      rest = rest.slice(at + w.length);
    }
    out.push({ text: rest });
    return out;
  }, [data]);
  const gaps = parts.filter((p): p is { idx: number; word: string; shown: string; missing: string } => 'idx' in p);
  const [vals, setVals] = useState<string[]>(() => gaps.map(() => ''));
  const [done, setDone] = useState(false);
  const right = (i: number) => vals[i].trim().toLowerCase() === gaps[i].missing.toLowerCase();
  function submit() {
    setDone(true);
    const marks = gaps.map((_, i) => ({ type: 'complete-words', correct: right(i) }));
    onSubmit({ points: marks.filter((m) => m.correct).length, max: gaps.length, marks });
  }
  return (
    <div className="stack">
      <h3 style={{ margin: 0 }}>{data.title}</h3>
      <p style={{ lineHeight: 2.2, fontSize: '1.08rem' }}>
        {parts.map((p, k) =>
          'idx' in p ? (
            <span key={k} style={{ whiteSpace: 'nowrap' }}>
              {p.shown}
              <input
                type="text"
                aria-label={`Missing letters ${p.idx + 1}`}
                spellCheck={false}
                autoComplete="off"
                autoCapitalize="off"
                value={vals[p.idx]}
                disabled={done}
                onChange={(e) => setVals((v) => v.map((x, j) => (j === p.idx ? e.target.value : x)))}
                style={{
                  width: `${Math.max(2, p.missing.length) * 0.75 + 0.8}em`,
                  padding: '1px 4px',
                  display: 'inline-block',
                  borderColor: done && mode === 'practice' ? (right(p.idx) ? 'var(--good)' : 'var(--bad)') : undefined,
                }}
              />
              {done && mode === 'practice' && !right(p.idx) && <span className="small" style={{ color: 'var(--good)' }}> ({p.word})</span>}
            </span>
          ) : (
            <span key={k}>{p.text}</span>
          ),
        )}
      </p>
      {!done && (
        <button className="btn primary" onClick={submit} style={{ alignSelf: 'flex-start' }}>
          Check
        </button>
      )}
    </div>
  );
}

const VOICES = {
  woman: ['en-US-Ava:DragonHDLatestNeural', 'en-US-Emma:DragonHDLatestNeural', 'en-US-JennyNeural', 'en-US-AriaNeural'],
  man: ['en-US-Andrew:DragonHDLatestNeural', 'en-US-Brian:DragonHDLatestNeural', 'en-US-GuyNeural', 'en-US-DavisNeural'],
};

/**
 * Plays listening audio with a limit on replays (once in a mock, twice in practice). In practice the
 * learner's speed and voice settings apply; a mock always plays at normal speed.
 */
export function usePlayer(mode: Mode, practiceLimit = 2) {
  const { engine, user } = useApp();
  const [plays, setPlays] = useState(0);
  const [playing, setPlaying] = useState(false);
  const limit = mode === 'mock' ? 1 : practiceLimit;
  const varied = mode === 'practice' && user.toefl.listenVoices === 'varied';
  const [pick] = useState(() => (varied ? { woman: 1 + Math.floor(Math.random() * 3), man: 1 + Math.floor(Math.random() * 3), narrator: Math.random() < 0.5 } : { woman: 0, man: 0, narrator: false }));
  const narrator = varied ? (pick.narrator ? VOICES.man[pick.man] : VOICES.woman[pick.woman]) : user.settings.voice;
  async function play(lines: { text: string; speaker?: 'woman' | 'man' }[]) {
    if (playing || plays >= limit) return;
    setPlaying(true);
    setPlays((n) => n + 1);
    const rate = mode === 'practice' ? user.toefl.listenRate : 1;
    for (const l of lines) await engine.speak(l.text, { voice: l.speaker ? VOICES[l.speaker][pick[l.speaker]] : narrator, browserVoice: user.settings.browserVoice, rate });
    setPlaying(false);
  }
  useEffect(() => () => engine.stopSpeaking(), [engine]);
  return { play, plays, playing, limit, canPlay: plays < limit && !playing };
}

export function PlayButton({ p, onPlay, label = 'Listen' }: { p: ReturnType<typeof usePlayer>; onPlay: () => void; label?: string }) {
  return (
    <div className="row">
      <button className="btn" onClick={onPlay} disabled={!p.canPlay}>
        <Icon name="volume" size={18} /> {p.playing ? 'Playing…' : p.plays ? 'Play again' : label}
      </button>
      <span className="small muted">
        Played {p.plays} / {p.limit}
      </span>
    </div>
  );
}

/** Listen and Choose a Response: hear one line, pick the best written reply. */
export function ResponseItems({ data, mode, onSubmit }: { data: GenOut<'response'>; mode: Mode; onSubmit: (o: TaskOutcome) => void }) {
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<(number | null)[]>(() => data.items.map(() => null));
  const [shown, setShown] = useState(false);
  const item = data.items[i];
  useEffect(() => setShown(false), [i]);
  function next() {
    if (i + 1 < data.items.length) setI(i + 1);
    else {
      const marks = data.items.map((it, k) => ({ type: 'response', correct: picked[k] === it.answer }));
      onSubmit({ points: marks.filter((m) => m.correct).length, max: marks.length, marks });
      setI(data.items.length);
    }
  }
  if (!item) return <div className="muted">Done.</div>;
  return (
    <div className="stack">
      <div className="small muted">
        Item {i + 1} of {data.items.length}
      </div>
      <PromptPlayer key={i} mode={mode} text={item.prompt} />
      {item.options.map((o, k) => {
        const reveal = shown && mode === 'practice';
        const cls = reveal ? (k === item.answer ? 'good' : picked[i] === k ? 'bad' : '') : picked[i] === k ? 'brand' : '';
        return (
          <button
            key={k}
            className={`list-item ${cls ? `chip ${cls}` : ''}`}
            style={{ marginTop: 0, borderRadius: 10, justifyContent: 'flex-start', whiteSpace: 'normal', textAlign: 'left' }}
            disabled={shown}
            onClick={() => setPicked((p) => p.map((x, j) => (j === i ? k : x)))}
          >
            <b style={{ width: 22 }}>{LETTERS[k]}</b>
            {o}
          </button>
        );
      })}
      {shown && mode === 'practice' && (
        <div className="small muted">
          They said: “{item.prompt}” {item.explanation}
        </div>
      )}
      {mode === 'practice' && !shown ? (
        <button className="btn primary" disabled={picked[i] == null} onClick={() => setShown(true)} style={{ alignSelf: 'flex-start' }}>
          Check
        </button>
      ) : (
        <button className="btn primary" disabled={picked[i] == null} onClick={next} style={{ alignSelf: 'flex-start' }}>
          {i + 1 < data.items.length ? 'Next' : 'Finish'}
        </button>
      )}
    </div>
  );
}

/** One prompt with its own play count (keyed per item). */
function PromptPlayer({ mode, text }: { mode: Mode; text: string }) {
  const p = usePlayer(mode);
  return <PlayButton p={p} onPlay={() => p.play([{ text }])} />;
}

/** Conversation, announcement or academic talk: listen (limited replays), then answer. */
export function ListeningSet({
  kind,
  data,
  mode,
  onSubmit,
}: {
  kind: 'conversation' | 'announcement' | 'talk';
  data: GenOut<'conversation'> | GenOut<'announcement'> | GenOut<'talk'>;
  mode: Mode;
  onSubmit: (o: TaskOutcome) => void;
}) {
  const player = usePlayer(mode);
  const [done, setDone] = useState(false);
  const lines = kind === 'conversation' ? (data as GenOut<'conversation'>).lines : [{ text: (data as GenOut<'talk'>).text }];
  return (
    <div className="stack">
      <h3 style={{ margin: 0 }}>{data.title}</h3>
      {kind === 'announcement' && <div className="small muted">Speaker: {(data as GenOut<'announcement'>).speaker}</div>}
      <PlayButton p={player} onPlay={() => player.play(lines)} />
      {player.plays > 0 && !player.playing ? (
        <McqList
          questions={data.questions}
          mode={mode}
          context={lines.map((l) => ('speaker' in l && l.speaker ? `${l.speaker === 'woman' ? 'Woman' : 'Man'}: ` : '') + l.text).join('\n')}
          onSubmit={(o) => {
            setDone(true);
            onSubmit(o);
          }}
        />
      ) : (
        <div className="small muted">Questions appear after you listen. Take notes if you like; the real test allows it.</div>
      )}
      {done && mode === 'practice' && (
        <details>
          <summary className="small">Transcript</summary>
          <div className="small stack" style={{ marginTop: 8 }}>
            {lines.map((l, k) => (
              <div key={k}>
                {'speaker' in l && l.speaker ? <b>{l.speaker === 'woman' ? 'Woman' : 'Man'}: </b> : null}
                {l.text}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

/** Build a Sentence: put the chunks in order to make a correct reply. */
export function BuildSentence({ data, mode, onSubmit }: { data: GenOut<'build'>; mode: Mode; onSubmit: (o: TaskOutcome) => void }) {
  const [i, setI] = useState(0);
  const [results, setResults] = useState<boolean[]>([]);
  const item = data.items[i];
  const pool = useMemo(() => (item ? shuffle(item.chunks.map((c, k) => ({ c, k })), i * 7 + item.chunks.length) : []), [item, i]);
  const [order, setOrder] = useState<number[]>([]);
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    setOrder([]);
    setChecked(false);
  }, [i]);
  if (!item) return <div className="muted">Done.</div>;
  const correct = order.length === item.chunks.length && order.every((k, j) => k === j);
  function next() {
    const r = [...results, correct];
    setResults(r);
    if (i + 1 < data.items.length) setI(i + 1);
    else {
      onSubmit({ points: r.filter(Boolean).length, max: r.length, marks: r.map((c) => ({ type: 'build-sentence', correct: c })) });
      setI(data.items.length);
    }
  }
  return (
    <div className="stack">
      <div className="small muted">
        Item {i + 1} of {data.items.length}
      </div>
      <div className="soft">
        <b>They say:</b> {item.context}
      </div>
      <div className="soft" style={{ minHeight: 48 }}>
        {order.length ? order.map((k) => item.chunks[k]).join(' ') : <span className="faint">Tap the pieces in order…</span>}
      </div>
      <div className="row">
        {pool.map(({ c, k }) => (
          <button key={k} className="btn small" disabled={order.includes(k) || checked} onClick={() => setOrder((o) => [...o, k])}>
            {c}
          </button>
        ))}
        {order.length > 0 && !checked && (
          <button className="btn small ghost" onClick={() => setOrder((o) => o.slice(0, -1))}>
            Undo
          </button>
        )}
      </div>
      {checked && mode === 'practice' && (
        <div className={`banner ${correct ? 'info' : 'error'}`}>{correct ? 'Correct.' : `Correct order: ${item.answer}`}</div>
      )}
      {mode === 'practice' && !checked ? (
        <button className="btn primary" disabled={order.length !== item.chunks.length} onClick={() => setChecked(true)} style={{ alignSelf: 'flex-start' }}>
          Check
        </button>
      ) : (
        <button className="btn primary" disabled={order.length !== item.chunks.length} onClick={next} style={{ alignSelf: 'flex-start' }}>
          {i + 1 < data.items.length ? 'Next' : 'Finish'}
        </button>
      )}
    </div>
  );
}

export const WRITING_MINUTES = { email: 7, discussion: 10 } as const;

/** Write an Email / Academic Discussion: timed, typed (no spellcheck), scored 0-5 by the AI. */
export function WritingTask({
  kind,
  data,
  mode,
  onSubmit,
}: {
  kind: 'email' | 'discussion';
  data: GenOut<'email'> | GenOut<'discussion'>;
  mode: Mode;
  onSubmit: (o: TaskOutcome) => void;
}) {
  const minutes = WRITING_MINUTES[kind];
  const [text, setText] = useState('');
  const [left, setLeft] = useState(minutes * 60);
  const [state, setState] = useState<'writing' | 'scoring' | 'done'>('writing');
  const [score, setScore] = useState<WritingScore | null>(null);
  const [before, setBefore] = useState<WritingScore | null>(null);
  const [error, setError] = useState<string | null>(null);
  const start = useRef(Date.now());
  const firstKey = useRef<number | null>(null);
  const textRef = useRef(text);
  textRef.current = text;

  useEffect(() => {
    if (state !== 'writing') return;
    const t = setInterval(() => {
      const l = Math.max(0, minutes * 60 - Math.round((Date.now() - start.current) / 1000));
      setLeft(l);
      if (l === 0) submit();
    }, 500);
    return () => clearInterval(t);
  }); // re-armed each render so submit sees the latest text

  async function submit() {
    if (state !== 'writing') return;
    setState('scoring');
    const used = (Date.now() - start.current) / 60000;
    try {
      const s = await aiTask('toeflWrite', { task: kind, prompt: data, text: textRef.current, minutes: Math.round(used * 10) / 10 });
      setScore(s);
      setState('done');
      onSubmit({ points: s.score, max: 5, marks: [{ type: kind === 'email' ? 'email' : 'discussion', correct: s.score >= 4 }], writing: s, revision: before != null });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setState('writing');
    }
  }

  const words = countWords(text);
  const typingMin = firstKey.current ? (Date.now() - firstKey.current) / 60000 : 0;
  const wpm = typingMin > 0.2 ? Math.round(words / typingMin) : 0;
  return (
    <div className="stack">
      {kind === 'email' ? (
        <div className="soft stack">
          <div>
            <b>Situation:</b> {(data as GenOut<'email'>).situation}
          </div>
          <div>
            <b>Write an email to {(data as GenOut<'email'>).to}. In your email:</b>
          </div>
          <ul style={{ margin: 0 }}>
            {(data as GenOut<'email'>).points.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="soft stack">
          <div className="small muted">{(data as GenOut<'discussion'>).course}</div>
          <div>
            <b>Professor:</b> {(data as GenOut<'discussion'>).professor}
          </div>
          {(data as GenOut<'discussion'>).posts.map((p) => (
            <div key={p.name}>
              <b>{p.name}:</b> {p.text}
            </div>
          ))}
          <div className="small muted">Write your own contribution (about 100 words or more).</div>
        </div>
      )}
      <div className="spread small">
        <span className={`chip ${left > 60 ? 'brand' : 'bad'}`}>
          {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')} left
        </span>
        <span className="muted">
          {words} words{wpm ? ` · ${wpm} wpm` : ''} · spellcheck off, like the real test
        </span>
      </div>
      <textarea
        rows={kind === 'email' ? 8 : 10}
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        value={text}
        disabled={state !== 'writing'}
        onChange={(e) => {
          if (firstKey.current == null) firstKey.current = Date.now();
          setText(e.target.value);
        }}
        onPaste={(e) => e.preventDefault()}
        placeholder="Type here. Dictation tools and pasting aren't allowed on the real test."
      />
      {error && <div className="banner error">{error}</div>}
      {state === 'writing' && (
        <button className="btn primary" onClick={submit} disabled={words < 5} style={{ alignSelf: 'flex-start' }}>
          Submit
        </button>
      )}
      {state === 'scoring' && <div className="muted">Scoring with the TOEFL rubric…</div>}
      {score && mode === 'practice' && (
        <>
          {before && (
            <div className={`banner ${score.score > before.score ? 'info' : ''}`}>
              Rewrite: {before.score.toFixed(1)} → <b>{score.score.toFixed(1)}</b>
              {score.score > before.score ? ' — better.' : score.score < before.score ? ' — lower; compare the feedback.' : ' — same band.'}
            </div>
          )}
          <WritingFeedback s={score} />
          <button
            className="btn"
            style={{ alignSelf: 'flex-start' }}
            onClick={() => {
              setBefore(score);
              setScore(null);
              start.current = Date.now();
              setLeft(minutes * 60);
              setState('writing');
            }}
          >
            <Icon name="refresh" size={16} /> Rewrite with the feedback and rescore
          </button>
        </>
      )}
    </div>
  );
}

export function WritingFeedback({ s }: { s: WritingScore }) {
  return (
    <div className="stack fade-in">
      <div className="spread">
        <h3 style={{ margin: 0 }}>Score</h3>
        <span className={`chip ${s.score >= 4 ? 'good' : s.score >= 3 ? 'ok' : 'bad'}`} style={{ fontSize: '1rem' }}>
          {s.score.toFixed(1)} / 5
        </span>
      </div>
      <p style={{ margin: 0 }}>{s.summary}</p>
      {s.improvements.length > 0 && (
        <div>
          <b className="small">To raise the score</b>
          <ul className="small" style={{ margin: 0 }}>
            {s.improvements.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </div>
      )}
      {s.corrections.map((c, k) => (
        <div key={k} className="small">
          <s className="muted">{c.original}</s> → <b>{c.corrected}</b> <span className="muted">{c.explanation}</span>
        </div>
      ))}
      <details>
        <summary className="small">Model answer</summary>
        <p className="small" style={{ whiteSpace: 'pre-wrap' }}>
          {s.model}
        </p>
      </details>
    </div>
  );
}

/** Which component runs a generated item. */
export function TaskView({ kind, data, mode, onSubmit }: { kind: GenKind; data: unknown; mode: Mode; onSubmit: (o: TaskOutcome) => void }) {
  switch (kind) {
    case 'complete':
      return <CompleteWords data={data as GenOut<'complete'>} mode={mode} onSubmit={onSubmit} />;
    case 'daily':
    case 'academic': {
      const d = data as GenOut<'daily'> | GenOut<'academic'>;
      return (
        <div className="stack">
          <div className="soft stack">
            {'format' in d && <span className="chip" style={{ alignSelf: 'flex-start' }}>{d.format}</span>}
            <h3 style={{ margin: 0 }}>{d.title}</h3>
            <p style={{ margin: 0, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{d.text}</p>
          </div>
          <McqList questions={d.questions} mode={mode} onSubmit={onSubmit} context={d.text} />
        </div>
      );
    }
    case 'response':
      return <ResponseItems data={data as GenOut<'response'>} mode={mode} onSubmit={onSubmit} />;
    case 'conversation':
    case 'announcement':
    case 'talk':
      return <ListeningSet kind={kind} data={data as GenOut<'talk'>} mode={mode} onSubmit={onSubmit} />;
    case 'build':
      return <BuildSentence data={data as GenOut<'build'>} mode={mode} onSubmit={onSubmit} />;
    case 'email':
    case 'discussion':
      return <WritingTask kind={kind} data={data as GenOut<'email'>} mode={mode} onSubmit={onSubmit} />;
    case 'paraphrase':
      return (
        <ChoiceItems
          type="paraphrase"
          mode={mode}
          onSubmit={onSubmit}
          items={(data as GenOut<'paraphrase'>).items.map((it) => ({
            stem: (
              <>
                <div className="small muted">Which sentence keeps the full meaning?</div>
                <div className="soft" style={{ lineHeight: 1.6 }}>
                  {it.sentence}
                </div>
              </>
            ),
            stemText: `Which sentence keeps the full meaning of: "${it.sentence}"`,
            options: it.options,
            answer: it.answer,
            explanation: it.explanation,
          }))}
        />
      );
    case 'vocab':
      return (
        <ChoiceItems
          type="vocabulary"
          mode={mode}
          onSubmit={onSubmit}
          items={(data as GenOut<'vocab'>).items.map((it) => ({
            stem: (
              <>
                <div className="soft" style={{ lineHeight: 1.6 }}>
                  {highlight(it.sentence, it.word)}
                </div>
                <div className="small muted">
                  What does <b>{it.word}</b> mean here?
                </div>
              </>
            ),
            stemText: `What does "${it.word}" mean in: "${it.sentence}"`,
            options: it.options,
            answer: it.answer,
            explanation: `${it.word}: ${it.meaning}`,
          }))}
        />
      );
    case 'implied':
      return (
        <ChoiceItems
          type="implied"
          mode={mode}
          onSubmit={onSubmit}
          items={(data as GenOut<'implied'>).items.map((it) => ({
            stem: <div className="small muted">{it.question}</div>,
            stemText: it.question,
            context: it.lines.map((l) => `${l.speaker === 'woman' ? 'Woman' : 'Man'}: ${l.text}`).join('\n'),
            audio: it.lines,
            options: it.options,
            answer: it.answer,
            explanation: `${it.lines.map((l) => `${l.speaker === 'woman' ? 'W' : 'M'}: ${l.text}`).join(' / ')} — ${it.explanation}`,
          }))}
        />
      );
    case 'spelling':
      return <SpellingItems data={data as GenOut<'spelling'>} mode={mode} onSubmit={onSubmit} />;
    case 'dictation':
      return <DictationItems data={data as GenOut<'dictation'>} mode={mode} onSubmit={onSubmit} />;
    case 'notes':
      return <NotesTask data={data as GenOut<'notes'>} mode={mode} onSubmit={onSubmit} />;
    case 'tone':
      return <ToneItems data={data as GenOut<'tone'>} mode={mode} onSubmit={onSubmit} />;
    default:
      return null;
  }
}

/** Shows `word` in bold inside a sentence. */
function highlight(sentence: string, word: string): ReactNode {
  const at = sentence.toLowerCase().indexOf(word.toLowerCase());
  if (at < 0) return sentence;
  return (
    <>
      {sentence.slice(0, at)}
      <b style={{ color: 'var(--brand)' }}>{sentence.slice(at, at + word.length)}</b>
      {sentence.slice(at + word.length)}
    </>
  );
}

interface ChoiceItem {
  stem: ReactNode;
  /** The stem as plain text (for "Why?" and the review). */
  stemText: string;
  context?: string;
  /** Played before the options appear (listening items). */
  audio?: { text: string; speaker?: 'woman' | 'man' }[];
  options: string[];
  answer: number;
  explanation: string;
}

/** One multiple-choice item at a time (paraphrase, vocabulary, implied meaning). */
export function ChoiceItems({ items, type, mode, onSubmit }: { items: ChoiceItem[]; type: string; mode: Mode; onSubmit: (o: TaskOutcome) => void }) {
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<(number | null)[]>(() => items.map(() => null));
  const [shown, setShown] = useState(false);
  const item = items[i];
  useEffect(() => setShown(false), [i]);
  const missedNow = shown && mode === 'practice' && item && picked[i] !== item.answer;
  const arabic = useArabic(missedNow ? [item.explanation] : []);
  const asQuestion = (it: ChoiceItem): ReviewQuestion => ({ question: it.stemText, options: it.options, answer: it.answer, type, explanation: it.explanation });
  function next() {
    if (i + 1 < items.length) setI(i + 1);
    else {
      const marks = items.map((it, k) => ({ type, correct: picked[k] === it.answer }));
      const missed = items.filter((it, k) => picked[k] !== it.answer).map((it) => ({ question: asQuestion(it), context: it.context }));
      onSubmit({ points: marks.filter((m) => m.correct).length, max: marks.length, marks, missed });
      setI(items.length);
    }
  }
  if (!item) return <div className="muted">Done.</div>;
  return (
    <div className="stack">
      <div className="small muted">
        Item {i + 1} of {items.length}
      </div>
      {item.audio && <LinesPlayer key={i} mode={mode} lines={item.audio} />}
      {item.stem}
      {item.options.map((o, k) => {
        const reveal = shown && mode === 'practice';
        const cls = reveal ? (k === item.answer ? 'good' : picked[i] === k ? 'bad' : '') : picked[i] === k ? 'brand' : '';
        return (
          <button
            key={k}
            className={`list-item ${cls ? `chip ${cls}` : ''}`}
            style={{ marginTop: 0, borderRadius: 10, justifyContent: 'flex-start', whiteSpace: 'normal', textAlign: 'left' }}
            disabled={shown}
            onClick={() => setPicked((p) => p.map((x, j) => (j === i ? k : x)))}
          >
            <b style={{ width: 22 }}>{LETTERS[k]}</b>
            {o}
          </button>
        );
      })}
      {shown && mode === 'practice' && <div className="small muted">{item.explanation}</div>}
      {missedNow && (
        <>
          <ArabicLine text={arabic[item.explanation]} />
          <WhyBox q={asQuestion(item)} picked={picked[i]} context={item.context} />
        </>
      )}
      {mode === 'practice' && !shown ? (
        <button className="btn primary" disabled={picked[i] == null} onClick={() => setShown(true)} style={{ alignSelf: 'flex-start' }}>
          Check
        </button>
      ) : (
        <button className="btn primary" disabled={picked[i] == null} onClick={next} style={{ alignSelf: 'flex-start' }}>
          {i + 1 < items.length ? 'Next' : 'Finish'}
        </button>
      )}
    </div>
  );
}

function LinesPlayer({ mode, lines }: { mode: Mode; lines: { text: string; speaker?: 'woman' | 'man' }[] }) {
  const p = usePlayer(mode);
  return <PlayButton p={p} onPlay={() => p.play(lines)} />;
}

/** Word endings for Complete the Words: type the full word from its root. */
export function SpellingItems({ data, mode, onSubmit }: { data: GenOut<'spelling'>; mode: Mode; onSubmit: (o: TaskOutcome) => void }) {
  const [vals, setVals] = useState<string[]>(() => data.items.map(() => ''));
  const [done, setDone] = useState(false);
  const right = (k: number) => vals[k].trim().toLowerCase() === data.items[k].answer.toLowerCase();
  function submit() {
    setDone(true);
    const marks = data.items.map((_, k) => ({ type: 'spelling', correct: right(k) }));
    onSubmit({ points: marks.filter((m) => m.correct).length, max: marks.length, marks });
  }
  return (
    <div className="stack">
      {data.items.map((it, k) => (
        <div key={k} className="soft stack">
          <div>{it.sentence}</div>
          <div className="row">
            <span className="small muted">({it.base})</span>
            <input
              type="text"
              spellCheck={false}
              autoComplete="off"
              autoCapitalize="off"
              value={vals[k]}
              disabled={done}
              onChange={(e) => setVals((v) => v.map((x, j) => (j === k ? e.target.value : x)))}
              style={{ maxWidth: 220, borderColor: done ? (right(k) ? 'var(--good)' : 'var(--bad)') : undefined }}
            />
            {done && !right(k) && <b style={{ color: 'var(--good)' }}>{it.answer}</b>}
          </div>
          {done && mode === 'practice' && <div className="small muted">{it.rule}</div>}
        </div>
      ))}
      {!done && (
        <button className="btn primary" onClick={submit} style={{ alignSelf: 'flex-start' }}>
          Check
        </button>
      )}
    </div>
  );
}

/** Word-by-word comparison of what was typed against the sentence. */
function WordDiff({ reference, typed }: { reference: string; typed: string }) {
  const ops = align(splitWords(reference), splitWords(typed));
  return (
    <div style={{ lineHeight: 1.9 }}>
      {ops.map((o, k) =>
        o.type === 'match' ? (
          <span key={k} style={{ color: 'var(--good)' }}>
            {o.ref}{' '}
          </span>
        ) : o.type === 'sub' ? (
          <span key={k}>
            <s className="muted">{o.hyp}</s> <b style={{ color: 'var(--bad)' }}>{o.ref}</b>{' '}
          </span>
        ) : o.type === 'del' ? (
          <b key={k} style={{ color: 'var(--bad)', textDecoration: 'underline' }}>
            {o.ref}{' '}
          </b>
        ) : (
          <s key={k} className="muted">
            {o.hyp}{' '}
          </s>
        ),
      )}
    </div>
  );
}

/** Dictation: hear a sentence (up to 3 times), type it exactly; every word is checked. */
export function DictationItems({ data, mode, onSubmit }: { data: GenOut<'dictation'>; mode: Mode; onSubmit: (o: TaskOutcome) => void }) {
  const [i, setI] = useState(0);
  const [typed, setTyped] = useState('');
  const [checked, setChecked] = useState(false);
  const scores = useRef<number[]>([]);
  const item = data.items[i];
  if (!item) return <div className="muted">Done.</div>;
  const ref = splitWords(item.sentence);
  const acc = checked ? align(ref, splitWords(typed)).filter((o) => o.type === 'match').length / ref.length : 0;
  function next() {
    scores.current[i] = acc;
    setTyped('');
    setChecked(false);
    if (i + 1 < data.items.length) setI(i + 1);
    else {
      const marks = scores.current.map((a) => ({ type: 'dictation', correct: a >= 0.9 }));
      onSubmit({ points: marks.filter((m) => m.correct).length, max: marks.length, marks });
      setI(data.items.length);
    }
  }
  return (
    <div className="stack">
      <div className="small muted">
        Sentence {i + 1} of {data.items.length} · type every word; punctuation and capitals don't count
      </div>
      <LinesPlayerLimit key={i} mode={mode} text={item.sentence} />
      <input type="text" spellCheck={false} autoComplete="off" autoCapitalize="off" value={typed} disabled={checked} onChange={(e) => setTyped(e.target.value)} placeholder="Type what you heard…" />
      {checked && (
        <div className="soft stack">
          <WordDiff reference={item.sentence} typed={typed} />
          <span className={`chip ${acc >= 0.9 ? 'good' : acc >= 0.7 ? 'ok' : 'bad'}`} style={{ alignSelf: 'flex-start' }}>
            {Math.round(acc * 100)}% of words
          </span>
        </div>
      )}
      {!checked ? (
        <button className="btn primary" disabled={!typed.trim()} onClick={() => setChecked(true)} style={{ alignSelf: 'flex-start' }}>
          Check
        </button>
      ) : (
        <button className="btn primary" onClick={next} style={{ alignSelf: 'flex-start' }}>
          {i + 1 < data.items.length ? 'Next' : 'Finish'}
        </button>
      )}
    </div>
  );
}

function LinesPlayerLimit({ mode, text }: { mode: Mode; text: string }) {
  const p = usePlayer(mode, 3);
  return <PlayButton p={p} onPlay={() => p.play([{ text }])} />;
}

/** Content words of a text, for checking notes against key points. */
const STOP = new Set('the a an and or but of to in on at for with by from is are was were be been it its this that these those as their they them which who than then so such not can will would could should may might into about over more most also very just only'.split(' '));
const content = (t: string) => splitWords(t).filter((w) => w.length > 2 && !STOP.has(w));

/** Share of a key point's content words that appear in the notes (word stems of 5 letters count). */
export function noteCoverage(point: string, notes: string): number {
  const have = new Set(content(notes).map((w) => w.slice(0, 5)));
  const need = content(point);
  if (!need.length) return 1;
  return need.filter((w) => have.has(w.slice(0, 5))).length / need.length;
}

/** Note-taking: listen to a lecture once while typing notes, answer from the notes, then see what they caught. */
export function NotesTask({ data, mode, onSubmit }: { data: GenOut<'notes'>; mode: Mode; onSubmit: (o: TaskOutcome) => void }) {
  const player = usePlayer(mode, 1);
  const [notes, setNotes] = useState('');
  const [done, setDone] = useState(false);
  const [fb, setFb] = useState<NotesFeedback | null>(null);
  useEffect(() => {
    if (!done || mode !== 'practice') return;
    aiTask('notesFeedback', { title: data.title, keyPoints: data.keyPoints, notes })
      .then(setFb)
      .catch(() => {});
  }, [done]); // once, after the questions
  return (
    <div className="stack">
      <h3 style={{ margin: 0 }}>{data.title}</h3>
      <div className="small muted">The lecture plays once. Take notes while you listen: short words, arrows, abbreviations. The questions come after, and you can only use your notes.</div>
      <PlayButton p={player} onPlay={() => player.play([{ text: data.text }])} />
      <textarea rows={8} spellCheck={false} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Your notes…" disabled={done} />
      {player.plays > 0 && !player.playing && (
        <McqList
          questions={data.questions}
          mode={mode}
          context={data.text}
          onSubmit={(o) => {
            setDone(true);
            onSubmit({ ...o, marks: [...o.marks, ...data.keyPoints.map((p) => ({ type: 'note-taking', correct: noteCoverage(p, notes) >= 0.4 }))] });
          }}
        />
      )}
      {done && mode === 'practice' && (
        <div className="soft stack">
          <b>Key points a good note-taker writes down</b>
          {data.keyPoints.map((p, k) => {
            const got = fb ? fb.covered[k] : noteCoverage(p, notes) >= 0.4;
            return (
              <div key={p} className="small">
                <span style={{ color: got ? 'var(--good)' : 'var(--bad)' }}>{got ? '✓' : '✗'}</span> {p}
              </div>
            );
          })}
          {fb ? (
            <div className="small stack" style={{ gap: 4 }}>
              <div>{fb.missed}</div>
              <ul style={{ margin: 0 }}>
                {fb.tips.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="small muted">Checking your notes…</div>
          )}
          <details>
            <summary className="small">Transcript</summary>
            <p className="small">{data.text}</p>
          </details>
        </div>
      )}
    </div>
  );
}

/** Words and habits that sound too casual in an email to a professor or an office. */
const CASUAL = /\b(hey|hi there|yo|gonna|wanna|gotta|ya|u|ur|pls|plz|thx|asap|ok\?|or what|i need you to|fix it|send me)\b|!{2,}/i;

/** Email tone: rewrite a too-casual sentence for the reader, then compare with a model. */
export function ToneItems({ data, mode, onSubmit }: { data: GenOut<'tone'>; mode: Mode; onSubmit: (o: TaskOutcome) => void }) {
  const [i, setI] = useState(0);
  const [text, setText] = useState('');
  const [checked, setChecked] = useState(false);
  const results = useRef<boolean[]>([]);
  const item = data.items[i];
  if (!item) return <div className="muted">Done.</div>;
  const casual = CASUAL.exec(text);
  const ok = !casual && countWords(text) >= 6;
  function next() {
    results.current[i] = ok;
    setText('');
    setChecked(false);
    if (i + 1 < data.items.length) setI(i + 1);
    else {
      const marks = results.current.map((c) => ({ type: 'tone', correct: c }));
      onSubmit({ points: marks.filter((m) => m.correct).length, max: marks.length, marks });
      setI(data.items.length);
    }
  }
  return (
    <div className="stack">
      <div className="small muted">
        Item {i + 1} of {data.items.length} · writing to <b>{item.reader}</b>
      </div>
      <div className="soft">
        <s className="muted">{item.casual}</s>
      </div>
      <textarea rows={3} spellCheck={false} value={text} disabled={checked} onChange={(e) => setText(e.target.value)} placeholder="Rewrite it in the right tone…" />
      {checked && (
        <div className="stack small">
          {casual ? <div className="banner error">Still casual: “{casual[0]}”.</div> : countWords(text) < 6 ? <div className="banner error">Too short: a full, polite sentence works better.</div> : <div className="banner info">The tone works.</div>}
          {mode === 'practice' && (
            <div className="soft">
              <b>Model:</b> {item.better}
              <div className="muted">{item.tip}</div>
            </div>
          )}
        </div>
      )}
      {!checked ? (
        <button className="btn primary" disabled={!text.trim()} onClick={() => setChecked(true)} style={{ alignSelf: 'flex-start' }}>
          Check
        </button>
      ) : (
        <button className="btn primary" onClick={next} style={{ alignSelf: 'flex-start' }}>
          {i + 1 < data.items.length ? 'Next' : 'Finish'}
        </button>
      )}
    </div>
  );
}
