import { useEffect, useRef, useState } from 'react';
import type { GenOut, SpeakCompare } from '../../../shared/toefl.ts';
import type { ToeflResult } from '../../../shared/tasks.ts';
import { INTERVIEW_SECONDS, INTERVIEW_SETS, REPEAT_SECONDS, repeatBand } from '../../content/toefl.ts';
import { fluencyScore } from '../../engine/scoring.ts';
import { wordAccuracy } from '../../engine/text.ts';
import { addSoundSamples, soundSamples, weakSounds } from '../../engine/toeflExtras.ts';
import { soundById } from '../../content/sounds.ts';
import { href } from '../../lib/router.ts';
import { aiTask } from '../../lib/api.ts';
import { toeflItem } from '../../ai/toeflBank.ts';
import { useApp } from '../../lib/store.tsx';
import type { Assessment } from '../../speech/index.ts';
import { Icon } from '../components/Icon.tsx';
import { MicControl, PlayBlob, useElapsed, useListen, useSpeak, WordScores } from '../components/speaking.tsx';

const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];

/** Where you should be in a 45-second answer. */
const CUES = [
  { until: 8, label: 'Answer the question' },
  { until: 22, label: 'Give your reason' },
  { until: 38, label: 'Give an example' },
  { until: 45, label: 'Wrap up' },
];

function useSeconds(running: boolean) {
  const [s, setS] = useState(0);
  useEffect(() => {
    setS(0);
    if (!running) return;
    const t0 = performance.now();
    const t = setInterval(() => setS((performance.now() - t0) / 1000), 200);
    return () => clearInterval(t);
  }, [running]);
  return s;
}

/**
 * One interview answer with live structure cues; afterwards the band, which parts were there,
 * and the learner's own answer rewritten at band 5.5 to listen to.
 */
export function CoachAnswer({ question, model }: { question: string; model?: string }) {
  const app = useApp();
  const mic = useListen();
  const { speak, speaking, stop } = useSpeak();
  const [a, setA] = useState<Assessment | null>(null);
  const [score, setScore] = useState<ToeflResult | null>(null);
  const [compare, setCompare] = useState<SpeakCompare | null>(null);
  const [state, setState] = useState<'idle' | 'asking' | 'answering' | 'scoring' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [showModel, setShowModel] = useState(false);
  const secs = useSeconds(mic.state === 'listening');
  const cue = CUES.find((c) => secs < c.until) ?? CUES[CUES.length - 1];

  async function start() {
    setError(null);
    setA(null);
    setScore(null);
    setCompare(null);
    setState('asking');
    await speak(question);
    setState('answering');
    const r = await mic.listen({ maxSeconds: INTERVIEW_SECONDS, endSilenceMs: 7000, noSpeechMs: 15_000, record: true });
    if (!r) {
      setState('idle');
      return;
    }
    setA(r);
    setState('scoring');
    if (r.engine === 'azure') app.update((u) => addSoundSamples(u.toefl.sounds, soundSamples(r)));
    const seconds = r.speechMs / 1000;
    try {
      const [s, c] = await Promise.all([
        aiTask('toefl', { question, transcript: r.text, seconds, pronunciation: r.engine !== 'typed' ? r.pron : undefined, fluency: r.engine !== 'typed' ? fluencyScore(r, true) : undefined }),
        aiTask('speakCompare', { question, transcript: r.text, seconds }),
      ]);
      setScore(s);
      setCompare(c);
      app.update((u) => (u.toeflBand = u.toeflBand == null ? s.band : Math.round((u.toeflBand * 0.8 + s.band * 0.2) * 2) / 2));
      await app.logAttempt({ at: Date.now(), kind: 'toefl', title: `Interview coach: ${question}`, seconds: Math.round(seconds), scores: {}, detail: { band: s.band, task: 'coach' } });
      if (s.corrections.length) await app.addMistakes(s.corrections.map((c) => ({ kind: c.kind, said: c.original, better: c.corrected, why: c.explanation })), 'TOEFL interview coach');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setState('done');
  }

  const seconds = a ? a.speechMs / 1000 : 0;
  const parts = compare ? ([['answer', 'Direct answer'], ['reason', 'Reason'], ['example', 'Example'], ['wrapUp', 'Wrap-up']] as const) : [];
  return (
    <div className="stack">
      <div className="prompt-text" style={{ fontSize: '1.15rem' }}>
        {question}
      </div>
      {state === 'idle' && (
        <button className="btn primary" onClick={start} style={{ alignSelf: 'flex-start' }}>
          <Icon name="mic" size={16} /> {a ? 'Answer again' : 'Hear the question and answer'}
        </button>
      )}
      {state === 'asking' && <div className="muted">The interviewer is asking…</div>}
      {mic.state === 'listening' && (
        <div className="soft stack">
          <div className="spread">
            <span className="status-pill">
              <span className="dot live" /> {cue.label}
            </span>
            <span className={`chip ${secs < 38 ? 'brand' : 'bad'}`}>{Math.max(0, Math.ceil(INTERVIEW_SECONDS - secs))} s</span>
          </div>
          <div className="row" style={{ gap: 4 }}>
            {CUES.map((c, k) => (
              <span key={c.label} style={{ flex: c.until - (k ? CUES[k - 1].until : 0), height: 6, borderRadius: 3, background: secs >= (k ? CUES[k - 1].until : 0) ? 'var(--brand)' : 'var(--line)' }} />
            ))}
          </div>
          <div className="partial">{mic.partial}</div>
          <button className="btn small" onClick={mic.stop} style={{ alignSelf: 'flex-start' }}>
            I'm done
          </button>
          {!mic.canListen && <MicControl {...mic} onStart={() => {}} onStop={mic.stop} onTyped={mic.submitTyped} canListen={false} />}
        </div>
      )}
      {mic.error && <div className="banner error">{mic.error}</div>}
      {state === 'scoring' && <div className="muted">Scoring and writing a band 5.5 version…</div>}
      {error && <div className="banner error">{error}</div>}
      {a && state === 'done' && (
        <div className="stack fade-in">
          <div className="soft small">“{a.text || '(nothing heard)'}”</div>
          <div className="row">
            {score && <span className="chip brand">Band {score.band.toFixed(1)}</span>}
            {a.engine !== 'typed' && <span className={`chip ${seconds >= 35 ? 'good' : seconds >= 25 ? 'ok' : 'bad'}`}>{Math.round(seconds)} s of speech</span>}
            {a.engine !== 'typed' && seconds < 30 && <span className="small muted">Short: aim to use 35-45 seconds.</span>}
          </div>
          {compare && (
            <div className="row">
              {parts.map(([k, label]) => (
                <span key={k} className={`chip ${compare.structure[k] ? 'good' : 'bad'}`}>
                  {compare.structure[k] ? '✓' : '✗'} {label}
                </span>
              ))}
            </div>
          )}
          {score && (
            <div className="small stack">
              <div>
                <b>Delivery:</b> {score.delivery}
              </div>
              <div>
                <b>Language use:</b> {score.languageUse}
              </div>
              <div>
                <b>Topic development:</b> {score.topicDevelopment}
              </div>
            </div>
          )}
          {compare && (
            <div className="card stack" style={{ background: 'var(--brand-soft, transparent)' }}>
              <b>Your answer at band 5.5</b>
              <p style={{ margin: 0, lineHeight: 1.6 }}>{compare.improved}</p>
              <ul className="small" style={{ margin: 0 }}>
                {compare.changes.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
              <div className="row">
                <button className="btn small" onClick={() => (speaking ? stop() : speak(compare.improved))}>
                  <Icon name="volume" size={14} /> {speaking ? 'Stop' : 'Listen to the 5.5 version'}
                </button>
                <PlayBlob blob={a.audio} />
              </div>
            </div>
          )}
          <button className="btn" onClick={() => setState('idle')} style={{ alignSelf: 'flex-start' }}>
            <Icon name="refresh" size={14} /> Try this question again
          </button>
        </div>
      )}
      {model && (
        <div>
          <button className="btn small ghost" onClick={() => setShowModel(!showModel)}>
            {showModel ? 'Hide' : 'Show'} model answer
          </button>
          {showModel && (
            <div className="soft stack" style={{ marginTop: 6 }}>
              <p className="small" style={{ margin: 0, lineHeight: 1.6 }}>
                {model}
              </p>
              <button className="btn small" onClick={() => speak(model)} style={{ alignSelf: 'flex-start' }}>
                <Icon name="volume" size={14} /> Listen and shadow
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const ALL_QUESTIONS = INTERVIEW_SETS.flatMap((s) => s.questions);

/** One question at a time with structure cues and a band 5.5 rewrite. */
export function Coach() {
  const [q, setQ] = useState(() => pick(ALL_QUESTIONS));
  return (
    <div className="stack">
      <h1>Answer structure coach</h1>
      <p className="muted">45 seconds: answer, reason, example, wrap-up. The bar shows where you should be. Afterwards you hear your own answer at band 5.5.</p>
      <div className="card" key={q}>
        <CoachAnswer question={q} />
      </div>
      <button className="btn" onClick={() => setQ(pick(ALL_QUESTIONS.filter((x) => x !== q)))} style={{ alignSelf: 'flex-start' }}>
        Another question <Icon name="next" size={14} />
      </button>
    </div>
  );
}

const THEMES = ['Campus life', 'Technology', 'Environment', 'Work and careers', 'Health and sport', 'Education', 'Travel and culture', 'Cities and housing', 'Science and research', 'Media and news'];

/** Interview sets by theme, each question with a band 5.5-6 model answer. */
export function TopicBank() {
  const [theme, setTheme] = useState<string | null>(null);
  const [set, setSet] = useState<GenOut<'interview'> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function load(t: string) {
    setTheme(t);
    setLoading(true);
    setError(null);
    setSet(null);
    try {
      setSet((await toeflItem({ kind: 'interview', difficulty: 'harder', topic: t })) as GenOut<'interview'>);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="stack">
      <h1>Interview topic bank</h1>
      <div className="card stack">
        <div className="row">
          {THEMES.map((t) => (
            <button key={t} className={`btn small ${theme === t ? 'primary' : 'ghost'}`} onClick={() => load(t)} disabled={loading}>
              {t}
            </button>
          ))}
        </div>
        {loading && <div className="muted">Writing questions and model answers…</div>}
        {error && <div className="banner error">{error}</div>}
      </div>
      {set && (
        <>
          <div className="small muted">
            {set.topic} · {set.intro}
          </div>
          {set.questions.map((q, k) => (
            <div key={q} className="card">
              <div className="small muted">Question {k + 1} of 4</div>
              <CoachAnswer question={q} model={set.models[k]} />
            </div>
          ))}
        </>
      )}
    </div>
  );
}

/** Splits a long sentence into 2-3 chunks at commas or near equal word counts. */
export function chunksOf(sentence: string): string[] {
  const words = sentence.split(/\s+/);
  const parts = Math.min(3, Math.max(2, Math.round(words.length / 7)));
  const out: string[] = [];
  let from = 0;
  for (let p = 1; p < parts; p++) {
    let cut = Math.round((words.length * p) / parts);
    // Prefer to cut just after a comma within two words of the even split.
    for (let d = 0; d <= 2; d++) {
      if (words[cut - 1 + d]?.endsWith(',')) {
        cut += d;
        break;
      }
      if (words[cut - 1 - d]?.endsWith(',')) {
        cut -= d;
        break;
      }
    }
    out.push(words.slice(from, cut).join(' '));
    from = cut;
  }
  out.push(words.slice(from).join(' '));
  return out;
}

/** Long Listen and Repeat sentences, built up: first chunk, then two chunks, then the whole sentence. */
export function LongRepeat() {
  const app = useApp();
  const mic = useListen();
  const { speak, speaking } = useSpeak();
  const elapsed = useElapsed();
  const [set, setSet] = useState<GenOut<'longRepeat'> | null>(null);
  const [i, setI] = useState(0);
  const [stage, setStage] = useState(0);
  const [last, setLast] = useState<{ a: Assessment; ref: string } | null>(null);
  const [bands, setBands] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logged = useRef(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setSet((await toeflItem({ kind: 'longRepeat', difficulty: 'harder' })) as GenOut<'longRepeat'>);
      setI(0);
      setStage(0);
      setBands([]);
      setLast(null);
      logged.current = false;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  const sentence = set?.sentences[i];
  const chunks = sentence ? chunksOf(sentence) : [];
  const target = chunks.slice(0, stage + 1).join(' ');
  const full = stage >= chunks.length - 1;

  async function attempt() {
    setLast(null);
    await speak(target, 1);
    const a = await mic.listen({ reference: target, maxSeconds: REPEAT_SECONDS(target) + 2, endSilenceMs: 1500, noSpeechMs: (REPEAT_SECONDS(target) + 2) * 1000, record: true });
    if (!a) return;
    setLast({ a, ref: target });
    if (a.engine === 'azure') app.update((u) => addSoundSamples(u.toefl.sounds, soundSamples(a)));
    if (full) setBands((b) => [...b.slice(0, i), repeatBand(wordAccuracy(target, a.text), a.pron)]);
  }

  function next() {
    setLast(null);
    if (!full) setStage(stage + 1);
    else {
      setStage(0);
      setI(i + 1);
    }
  }

  const finished = set != null && i >= set.sentences.length;
  useEffect(() => {
    if (!finished || logged.current || !bands.length) return;
    logged.current = true;
    const band = Math.round((bands.reduce((x, y) => x + y, 0) / bands.length) * 2) / 2;
    app.logAttempt({ at: Date.now(), kind: 'toefl', title: `Long-sentence repeat: ${set?.topic}`, seconds: elapsed(), scores: {}, detail: { band, task: 'long-repeat' } });
  }, [finished]); // log once at the end

  const acc = last ? wordAccuracy(last.ref, last.a.text) : 0;
  return (
    <div className="stack">
      <h1>Long-sentence repeat</h1>
      <p className="muted">
        Scores drop most on the longest Listen and Repeat sentences. Each one is built up: first part, first two parts, then all of it. Keep every small word and ending.
      </p>
      {!set || finished ? (
        <div className="card stack">
          {finished && bands.length > 0 && (
            <span className="chip brand" style={{ alignSelf: 'flex-start', fontSize: '1rem' }}>
              Average {(Math.round((bands.reduce((x, y) => x + y, 0) / bands.length) * 2) / 2).toFixed(1)} / 6 on full sentences
            </span>
          )}
          <button className="btn primary" onClick={load} disabled={loading} style={{ alignSelf: 'flex-start' }}>
            <Icon name="refresh" size={16} /> {loading ? 'Writing sentences…' : finished ? 'Another set' : 'Start'}
          </button>
          {error && <div className="banner error">{error}</div>}
        </div>
      ) : (
        <div className="card stack">
          <div className="spread small muted">
            <span>
              Sentence {i + 1} of {set.sentences.length} · {set.topic}
            </span>
            <span>
              Step {stage + 1} of {chunks.length}
              {full ? ' (whole sentence)' : ''}
            </span>
          </div>
          <div className="row" style={{ gap: 4 }}>
            {chunks.map((_, k) => (
              <span key={k} className={`chip ${k <= stage ? 'brand' : ''}`}>
                {k <= stage ? `part ${k + 1}` : '…'}
              </span>
            ))}
          </div>
          {speaking && <div className="muted">Listen…</div>}
          {mic.state === 'listening' && (
            <div className="stack">
              <div className="prompt-text">Repeat now</div>
              <div className="partial">{mic.partial}</div>
              {!mic.canListen && <MicControl {...mic} onStart={() => {}} onStop={mic.stop} onTyped={mic.submitTyped} canListen={false} />}
            </div>
          )}
          {mic.error && <div className="banner error">{mic.error}</div>}
          {last && (
            <div className="stack fade-in">
              <WordScores a={last.a} />
              <span className={`chip ${acc >= 0.9 ? 'good' : acc >= 0.75 ? 'ok' : 'bad'}`} style={{ alignSelf: 'flex-start' }}>
                {Math.round(acc * 100)}% of words{full && bands[i] != null ? ` · band ${bands[i].toFixed(1)}` : ''}
              </span>
              {acc < 0.8 && <div className="small muted">Under 80%: try this step again before adding more.</div>}
              <PlayBlob blob={last.a.audio} />
            </div>
          )}
          {mic.state === 'idle' && !speaking && (
            <div className="row">
              <button className={`btn ${last ? '' : 'primary'}`} onClick={attempt}>
                <Icon name={last ? 'refresh' : 'volume'} size={16} /> {last ? 'Try again' : 'Listen and repeat'}
              </button>
              {last && (
                <button className="btn primary" onClick={next}>
                  {full ? (i + 1 < set.sentences.length ? 'Next sentence' : 'Finish') : 'Add the next part'} <Icon name="next" size={14} />
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Easy everyday questions for starting to speak at once. */
const QUICK = [
  'What did you have for breakfast today?',
  'What is your favorite place in your city?',
  'How do you usually get to work or class?',
  'What did you do last weekend?',
  'Do you prefer mornings or evenings? Why?',
  'What is a skill you would like to learn?',
  'Describe your bedroom in a few words.',
  'Who is someone you admire?',
  'What kind of music do you like?',
  'What is the best gift you have ever received?',
  'Do you like cooking? Why or why not?',
  'What is your favorite season?',
  'What app do you use most on your phone?',
  'Where would you like to travel next?',
  'What do you usually do to relax?',
  'What was your favorite subject at school?',
  'Do you prefer studying alone or in a group?',
  'What is a good book or film you saw recently?',
  'How do you stay healthy?',
  'What is something that made you happy this week?',
  'Do you prefer the city or the countryside?',
  'What time do you usually go to sleep?',
  'What is your dream job?',
  'What is a tradition in your family?',
  'How do you usually spend a holiday?',
  'What would you do with a free afternoon?',
  'What sport do you enjoy watching or playing?',
  'What is the most useful thing you learned this year?',
  'Do you like rainy days? Why?',
  'What do you like about your neighborhood?',
];

const shuffled = <T,>(xs: T[]) => xs.map((x) => [Math.random(), x] as const).sort((a, b) => a[0] - b[0]).map(([, x]) => x);

/** Five quick questions, 15 seconds each: the goal is to start speaking within 2 seconds. */
export function QuickRound({ onDone }: { onDone?: () => void }) {
  const app = useApp();
  const mic = useListen();
  const { speak, speaking } = useSpeak();
  const elapsed = useElapsed();
  const [qs] = useState(() => shuffled(QUICK).slice(0, 5));
  const [i, setI] = useState(-1);
  const [res, setRes] = useState<(Assessment | null)[]>([]);
  const acc = useRef<(Assessment | null)[]>([]);
  const secs = useSeconds(mic.state === 'listening');

  async function run(n: number) {
    setI(n);
    await speak(qs[n], 1);
    const a = await mic.listen({ maxSeconds: 15, endSilenceMs: 4000, noSpeechMs: 8000, record: false });
    acc.current[n] = a;
    setRes([...acc.current]);
    if (a?.engine === 'azure') app.update((u) => addSoundSamples(u.toefl.sounds, soundSamples(a)));
    if (n + 1 < qs.length) run(n + 1);
    else finish(acc.current);
  }
  function finish(all: (Assessment | null)[]) {
    const delays = all.filter((a): a is Assessment => Boolean(a && a.engine !== 'typed')).map((a) => a.startDelayMs);
    if (delays.length) app.update((u) => (u.toefl.quick = [...u.toefl.quick, ...delays].slice(-30)));
    app.logAttempt({ at: Date.now(), kind: 'toefl', title: 'TOEFL quick answers', seconds: elapsed(), scores: {}, detail: { task: 'quick' } });
    setI(qs.length);
  }

  if (i < 0) {
    return (
      <div className="stack">
        <p style={{ margin: 0 }}>5 easy questions, 15 seconds each, one after another. Start talking right away; say anything true and simple. The microphone opens by itself.</p>
        <button className="btn primary" onClick={() => run(0)} style={{ alignSelf: 'flex-start' }}>
          <Icon name="mic" size={16} /> Start
        </button>
      </div>
    );
  }
  if (i >= qs.length) {
    const real = res.filter((a): a is Assessment => Boolean(a && a.engine !== 'typed'));
    const avg = real.length ? real.reduce((x, a) => x + a.startDelayMs, 0) / real.length / 1000 : null;
    return (
      <div className="stack">
        {avg != null && (
          <span className={`chip ${avg <= 2 ? 'good' : avg <= 3.5 ? 'ok' : 'bad'}`} style={{ alignSelf: 'flex-start', fontSize: '1rem' }}>
            Started after {avg.toFixed(1)} s on average
          </span>
        )}
        {qs.map((q, k) => (
          <div key={q} className="spread small">
            <span>{q}</span>
            <span className="muted">{res[k] ? (res[k]!.engine === 'typed' ? 'typed' : `${(res[k]!.startDelayMs / 1000).toFixed(1)} s · ${res[k]!.text.split(/\s+/).filter(Boolean).length} words`) : 'no answer'}</span>
          </div>
        ))}
        <div className="small muted">Aim: start within 2 seconds. Use a starter while you think: "Well, I'd say…", "Honestly,…", "That's easy:…".</div>
        <div className="row">
          {onDone ? (
            <button className="btn primary" onClick={onDone}>
              Next part <Icon name="next" size={14} />
            </button>
          ) : (
            <button className="btn primary" onClick={() => location.reload()}>
              Another round
            </button>
          )}
        </div>
      </div>
    );
  }
  return (
    <div className="stack" style={{ textAlign: 'center' }}>
      <div className="small muted">
        Question {i + 1} of {qs.length}
      </div>
      <div className="prompt-text">{qs[i]}</div>
      {speaking && <div className="muted">Listen…</div>}
      {mic.state === 'listening' && (
        <div className="stack">
          <span className={`chip ${secs < 2 ? 'good' : 'bad'}`} style={{ alignSelf: 'center' }}>
            {Math.max(0, Math.ceil(15 - secs))} s
          </span>
          <div className="partial">{mic.partial}</div>
          {!mic.canListen && <MicControl {...mic} onStart={() => {}} onStop={mic.stop} onTyped={mic.submitTyped} canListen={false} />}
        </div>
      )}
      {mic.error && <div className="banner error">{mic.error}</div>}
    </div>
  );
}

export function QuickAnswers() {
  const { user } = useApp();
  const q = user.toefl.quick;
  const avg = q.length ? q.reduce((a, b) => a + b, 0) / q.length / 1000 : null;
  return (
    <div className="stack">
      <h1>15-second quick answers</h1>
      {avg != null && <div className="small muted">Your recent average start: {avg.toFixed(1)} s (aim: under 2 s).</div>}
      <div className="card">
        <QuickRound />
      </div>
    </div>
  );
}

/** The 10-minute speaking drill: a quick-answer round, then one coached interview answer. */
export function SpeakingDrill() {
  const [step, setStep] = useState(0);
  const [q] = useState(() => pick(ALL_QUESTIONS));
  return (
    <div className="stack">
      <h1>Speaking: daily drill</h1>
      <div className="small muted">Part {Math.min(step + 1, 2)} of 2: {step === 0 ? 'quick answers (start fast)' : 'one coached interview answer'}</div>
      <div className="card">{step === 0 ? <QuickRound onDone={() => setStep(1)} /> : <CoachAnswer question={q} />}</div>
      {step === 1 && (
        <a className="btn" href={href('/toefl/speaking')} style={{ alignSelf: 'flex-start' }}>
          Done: back to Speaking
        </a>
      )}
    </div>
  );
}

/** Sounds that keep scoring low in TOEFL speaking answers, linked to their drills. */
export function SoundsFromToefl() {
  const { user } = useApp();
  const weak = weakSounds(user.toefl.sounds).slice(0, 4);
  const measured = Object.keys(user.toefl.sounds).length;
  return (
    <div className="card stack">
      <h3 style={{ margin: 0 }}>Sounds to fix from your TOEFL answers</h3>
      {weak.length ? (
        <div className="grid grid-2">
          {weak.map((w) => (
            <a key={w.id} className="list-item" href={href(`/practice/sounds/${w.id}`)} style={{ marginTop: 0 }}>
              <span className="grow">
                <b>{soundById(w.id)?.title ?? w.id}</b>
                <div className="small muted">Score {w.score} in your answers</div>
              </span>
              <Icon name="next" size={14} />
            </a>
          ))}
        </div>
      ) : (
        <div className="small muted">
          {measured ? 'No weak sounds so far in your TOEFL answers.' : 'Sound scores come from your spoken TOEFL answers once Azure speech is set up (not in test mode).'}
        </div>
      )}
    </div>
  );
}
