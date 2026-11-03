import { useMemo, useState } from 'react';
import type { GenOut } from '../../../shared/toefl.ts';
import { PHRASES } from '../../content/toeflPhrases.ts';
import { countWords, words as splitWords } from '../../engine/text.ts';
import { aiTask } from '../../lib/api.ts';
import { href } from '../../lib/router.ts';
import { useApp } from '../../lib/store.tsx';
import { Icon } from '../components/Icon.tsx';
import { PracticeRunner } from './Practice.tsx';
import { recordOutcome } from './record.ts';
import { McqList, TaskView, type TaskOutcome } from './tasks.tsx';

const DAY = 86_400_000;
/** Days until the next review for each spaced-repetition box. */
const BOX_DAYS = [0, 1, 3, 7, 14, 30, 60];

// ---- Reading ----

/** Learn academic words in context, then review them on a spaced schedule. */
export function VocabTrainer() {
  const { user, update } = useApp();
  const words = user.toefl.vocab;
  const now = Date.now();
  const due = Object.entries(words).filter(([, v]) => v.due <= now);
  const [mode, setMode] = useState<'home' | 'learn' | 'review'>('home');
  const [set, setSet] = useState<GenOut<'vocab'> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [learned, setLearned] = useState<TaskOutcome | null>(null);

  async function learn() {
    setLoading(true);
    setError(null);
    setLearned(null);
    try {
      setSet((await aiTask('toeflGen', { kind: 'vocab', difficulty: 'harder', topic: Object.keys(words).length ? `Do not use these words: ${Object.keys(words).slice(-60).join(', ')}` : undefined })) as GenOut<'vocab'>);
      setMode('learn');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  function learnedSet(o: TaskOutcome) {
    if (!set) return;
    setLearned(o);
    update((u) => {
      recordOutcome(u, 'vocab', o);
      set.items.forEach((it, k) => {
        const right = o.marks[k]?.correct;
        u.toefl.vocab[it.word.toLowerCase()] = { meaning: it.meaning, sentence: it.sentence, box: right ? 1 : 0, due: Date.now() + (right ? DAY : 0) };
      });
    });
  }

  if (mode === 'review') return <VocabReview onDone={() => setMode('home')} />;

  return (
    <div className="stack">
      <h1>Academic vocabulary</h1>
      <div className="card stack">
        <p style={{ margin: 0 }}>
          Words that appear in university texts, met in a sentence. Words you miss come back sooner; words you know come back after 1, 3, 7, 14, 30 and 60 days.
        </p>
        <div className="row">
          <span className="chip">{Object.keys(words).length} words learning</span>
          <span className={`chip ${due.length ? 'bad' : 'good'}`}>{due.length} due now</span>
        </div>
        <div className="row">
          <button className="btn primary" onClick={() => setMode('review')} disabled={!due.length}>
            <Icon name="repeat" size={16} /> Review due words
          </button>
          <button className="btn" onClick={learn} disabled={loading}>
            <Icon name="spark" size={16} /> {loading ? 'Choosing words…' : 'Learn 8 new words'}
          </button>
        </div>
        {error && <div className="banner error">{error}</div>}
      </div>
      {mode === 'learn' && set && (
        <div className="card">
          <TaskView kind="vocab" data={set} mode="practice" onSubmit={learnedSet} />
          {learned && <div className="banner info" style={{ marginTop: 12 }}>Added to your review list: {learned.points} of {learned.max} known already.</div>}
        </div>
      )}
    </div>
  );
}

function VocabReview({ onDone }: { onDone: () => void }) {
  const { user, update } = useApp();
  const [queue] = useState(() => Object.entries(user.toefl.vocab).filter(([, v]) => v.due <= Date.now()).map(([w]) => w));
  const [i, setI] = useState(0);
  const [shown, setShown] = useState(false);
  const word = queue[i];
  const v = word ? user.toefl.vocab[word] : null;
  function grade(knew: boolean) {
    update((u) => {
      const e = u.toefl.vocab[word];
      if (!e) return;
      e.box = knew ? Math.min(BOX_DAYS.length - 1, e.box + 1) : 0;
      e.due = Date.now() + BOX_DAYS[e.box] * DAY + (knew ? 0 : 10 * 60_000);
    });
    setShown(false);
    setI(i + 1);
  }
  if (!word || !v) {
    return (
      <div className="stack">
        <h1>Review done</h1>
        <button className="btn primary" onClick={onDone} style={{ alignSelf: 'flex-start' }}>
          Back
        </button>
      </div>
    );
  }
  return (
    <div className="stack">
      <div className="small muted">
        Word {i + 1} of {queue.length}
      </div>
      <div className="card stack">
        <div className="prompt-text">{word}</div>
        <div className="soft">{v.sentence}</div>
        {shown ? (
          <>
            <div>
              <b>Meaning:</b> {v.meaning}
            </div>
            <div className="row">
              <button className="btn primary" onClick={() => grade(true)}>
                I knew it
              </button>
              <button className="btn" onClick={() => grade(false)}>
                Not yet
              </button>
            </div>
          </>
        ) : (
          <button className="btn primary" onClick={() => setShown(true)} style={{ alignSelf: 'flex-start' }}>
            Show the meaning
          </button>
        )}
      </div>
    </div>
  );
}

/** Read a passage against the clock, then answer without looking back. */
export function SpeedReading() {
  const { update } = useApp();
  const [data, setData] = useState<GenOut<'academic'> | null>(null);
  const [phase, setPhase] = useState<'ready' | 'reading' | 'questions' | 'done'>('ready');
  const [start, setStart] = useState(0);
  const [wpm, setWpm] = useState(0);
  const [outcome, setOutcome] = useState<TaskOutcome | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setData((await aiTask('toeflGen', { kind: 'academic', difficulty: 'standard' })) as GenOut<'academic'>);
      setPhase('ready');
      setOutcome(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="stack">
      <h1>Speed and comprehension</h1>
      <div className="card stack">
        <p className="small muted" style={{ margin: 0 }}>
          Read at your normal test pace, press "Done", then answer from memory. Aim for about 200 words per minute with 80% or more right; faster reading leaves time to check answers in the real modules.
        </p>
        <button className="btn primary" onClick={load} disabled={loading} style={{ alignSelf: 'flex-start' }}>
          <Icon name="refresh" size={16} /> {loading ? 'Writing a passage…' : data ? 'New passage' : 'Get a passage'}
        </button>
        {error && <div className="banner error">{error}</div>}
      </div>
      {data && phase === 'ready' && (
        <button
          className="btn primary big"
          onClick={() => {
            setStart(Date.now());
            setPhase('reading');
          }}
        >
          Start reading (the timer starts)
        </button>
      )}
      {data && phase === 'reading' && (
        <div className="card stack">
          <h3 style={{ margin: 0 }}>{data.title}</h3>
          <p style={{ lineHeight: 1.7, margin: 0 }}>{data.text}</p>
          <button
            className="btn primary"
            onClick={() => {
              setWpm(Math.round(countWords(data.text) / Math.max(0.1, (Date.now() - start) / 60000)));
              setPhase('questions');
            }}
            style={{ alignSelf: 'flex-start' }}
          >
            Done reading
          </button>
        </div>
      )}
      {data && (phase === 'questions' || phase === 'done') && (
        <div className="card stack">
          <span className={`chip ${wpm >= 200 ? 'good' : wpm >= 150 ? 'ok' : 'bad'}`} style={{ alignSelf: 'flex-start' }}>
            {wpm} words per minute
          </span>
          <McqList
            questions={data.questions}
            mode="practice"
            onSubmit={(o) => {
              setOutcome(o);
              setPhase('done');
              update((u) => recordOutcome(u, 'academic', o));
            }}
          />
          {outcome && (
            <div className="banner info">
              {outcome.points} / {outcome.max} right at {wpm} wpm.{' '}
              {outcome.points / outcome.max < 0.8 ? 'Slow down a little: accuracy first.' : wpm < 200 ? 'Good understanding; try reading a bit faster next time.' : 'Fast and accurate.'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export const ParaphrasePractice = () => (
  <PracticeRunner section="reading" title="Paraphrase matching" kinds={['paraphrase']} intro={<p className="muted">The right answers in Reading and Listening are usually paraphrases. Check who does what, why, and words like some, may and not.</p>} />
);
export const SpellingPractice = () => (
  <PracticeRunner section="reading" title="Word-ending spelling" kinds={['spelling']} fixedDifficulty="standard" intro={<p className="muted">Complete the Words needs exact endings. Type the full word that fits; spellcheck is off, like the test.</p>} />
);

// ---- Listening ----

export const DictationPractice = () => (
  <PracticeRunner section="listening" title="Dictation" kinds={['dictation']} intro={<p className="muted">Up to 3 plays per sentence. Small words (to, the, have) and endings are where points go missing.</p>} />
);
export const NotesPractice = () => <PracticeRunner section="listening" title="Note-taking" kinds={['notes']} intro={<p className="muted">The lecture plays once. You see which key points your notes caught at the end.</p>} />;
export const ImpliedPractice = () => <PracticeRunner section="listening" title="Implied meaning" kinds={['implied']} intro={<p className="muted">Listen for what people mean, not only what they say.</p>} />;

// ---- Writing ----

const PATTERNS = [
  'indirect questions (Do you know where the office is?)',
  'question word order with auxiliaries (Have you ever…, Why didn\'t…)',
  'relative clauses (who, which, that, where)',
  'passive voice (was cancelled, has been moved)',
  'conditionals (If I had…, would…)',
  'adverb and phrasal verb position (always, already, turn it in)',
];

/** Build a Sentence items that all practise one grammar pattern. */
export function GrammarDrills() {
  const [pattern, setPattern] = useState(PATTERNS[0]);
  return (
    <div className="stack">
      <div className="card stack">
        <b>Pick a pattern</b>
        <div className="row">
          {PATTERNS.map((p) => (
            <button key={p} className={`btn small ${pattern === p ? 'primary' : 'ghost'}`} onClick={() => setPattern(p)}>
              {p.split(' (')[0]}
            </button>
          ))}
        </div>
        <div className="small muted">e.g. {pattern.split(' (')[1]?.replace(/\)$/, '')}</div>
      </div>
      <PracticeRunner key={pattern} section="writing" title="Build a Sentence: grammar drills" kinds={['build']} topic={`Every item must practise this pattern: ${pattern}.`} fixedDifficulty="standard" />
    </div>
  );
}

const shuffle = <T,>(xs: T[]) => xs.map((x) => [Math.random(), x] as const).sort((a, b) => a[0] - b[0]).map(([, x]) => x);

/** Email and discussion phrases, with a quick "which phrase fits?" drill. */
export function PhraseBank() {
  const [drill, setDrill] = useState(0);
  const questions = useMemo(() => {
    const qs = shuffle(PHRASES).slice(0, 8).map((cat) => {
      const right = shuffle(cat.phrases)[0];
      const wrong = shuffle(PHRASES.filter((c) => c.id !== cat.id))
        .slice(0, 3)
        .map((c) => shuffle(c.phrases)[0]);
      const options = shuffle([right, ...wrong]);
      return { question: `Which phrase fits? ${cat.situation}`, options, answer: options.indexOf(right), type: 'phrases' as never, explanation: `"${right}" — ${cat.title.toLowerCase()}.` };
    });
    return qs;
  }, [drill]); // a new drill each time
  const [started, setStarted] = useState(false);
  const [score, setScore] = useState<TaskOutcome | null>(null);
  return (
    <div className="stack">
      <h1>Phrase bank</h1>
      <div className="card stack">
        <div className="row">
          <button className="btn primary" onClick={() => (setStarted(true), setScore(null), setDrill((d) => d + 1))}>
            <Icon name="bolt" size={16} /> {started ? 'New drill' : 'Drill: which phrase fits?'}
          </button>
          <a className="btn" href={href('/toefl/writing/practice?task=email')}>
            Use them in an email
          </a>
        </div>
        {started && (
          <div key={drill}>
            <McqList questions={questions} mode="practice" onSubmit={setScore} />
            {score && <div className="banner info">{score.points} / {score.max}</div>}
          </div>
        )}
      </div>
      {(['email', 'discussion'] as const).map((task) => (
        <div key={task} className="card stack">
          <h3 style={{ margin: 0 }}>{task === 'email' ? 'Write an Email' : 'Academic Discussion'}</h3>
          {PHRASES.filter((c) => c.task === task).map((c) => (
            <div key={c.id}>
              <b className="small">{c.title}</b>
              <ul className="small" style={{ margin: '2px 0 0' }}>
                {c.phrases.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

const same = (a: string, b: string) => splitWords(a).join(' ') === splitWords(b).join(' ');

/** Mistakes from your scored writing: grouped by kind, drilled until fixed twice. */
export function ErrorPatterns() {
  const { user, update } = useApp();
  const open = user.toefl.writeErrors.filter((e) => e.fixed < 2);
  const kinds = Object.entries(open.reduce<Record<string, number>>((a, e) => ((a[e.kind] = (a[e.kind] ?? 0) + 1), a), {})).sort((a, b) => b[1] - a[1]);
  const [i, setI] = useState(0);
  const [typed, setTyped] = useState('');
  const [checked, setChecked] = useState<boolean | null>(null);
  const e = open[i % Math.max(1, open.length)];
  function check() {
    const ok = same(typed, e.corrected);
    setChecked(ok);
    if (ok) update((u) => u.toefl.writeErrors.filter((x) => x.at === e.at && x.original === e.original).forEach((x) => x.fixed++));
  }
  return (
    <div className="stack">
      <h1>Your error patterns</h1>
      {!open.length ? (
        <div className="card muted">
          Nothing to fix yet. Mistakes from your scored emails and discussion posts collect here. <a href={href('/toefl/writing/practice?task=email')}>Write an email</a>
        </div>
      ) : (
        <>
          <div className="card">
            <div className="section-title">Most frequent</div>
            <div className="row">
              {kinds.map(([k, n]) => (
                <span key={k} className="chip">
                  {k} · {n}
                </span>
              ))}
            </div>
          </div>
          <div className="card stack">
            <div className="small muted">
              Fix it ({i % open.length + 1} of {open.length}) · {e.kind}
            </div>
            <div className="soft">{e.original}</div>
            <input type="text" spellCheck={false} value={typed} onChange={(ev) => (setTyped(ev.target.value), setChecked(null))} placeholder="Type the corrected version…" />
            {checked != null && (
              <div className={`banner ${checked ? 'info' : 'error'}`}>
                {checked ? 'Correct.' : <>Better: <b>{e.corrected}</b></>} <span className="muted">{e.explanation}</span>
              </div>
            )}
            <div className="row">
              <button className="btn primary" onClick={check} disabled={!typed.trim()}>
                Check
              </button>
              <button className="btn" onClick={() => (setI(i + 1), setTyped(''), setChecked(null))}>
                Next <Icon name="next" size={14} />
              </button>
            </div>
            <div className="small muted">Each mistake leaves the list after you fix it correctly twice.</div>
          </div>
        </>
      )}
    </div>
  );
}
