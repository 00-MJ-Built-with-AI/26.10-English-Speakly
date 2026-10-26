import { useMemo, useState } from 'react';
import { SOUNDS, soundById, type SoundSet } from '../../content/sounds.ts';
import { markPracticed } from '../../engine/path.ts';
import { blend } from '../../engine/scoring.ts';
import { href } from '../../lib/router.ts';
import { useApp } from '../../lib/store.tsx';
import type { Assessment } from '../../speech/index.ts';
import { Icon } from '../components/Icon.tsx';
import { MOUTH } from '../../content/mouth.ts';
import { MouthPair } from '../components/MouthDiagram.tsx';
import { IntonationGraph } from '../components/IntonationGraph.tsx';
import { MicControl, ScoreChips, useElapsed, useListen, useSpeak, WordScores } from '../components/speaking.tsx';

export function SoundsList() {
  const { user } = useApp();
  const [weakFirst, setWeakFirst] = useState(false);
  const list = useMemo(
    () => (weakFirst ? [...SOUNDS].sort((a, b) => (user.sounds[a.id] ?? 101) - (user.sounds[b.id] ?? 101)) : SOUNDS),
    [weakFirst, user.sounds],
  );
  return (
    <div>
      <div className="spread">
        <div>
          <h1>Sound drills</h1>
          <p className="muted">American English sounds that Arabic speakers most often find hard, plus stress, rhythm and intonation.</p>
        </div>
        <label className="row small">
          <input type="checkbox" checked={weakFirst} onChange={(e) => setWeakFirst(e.target.checked)} /> Weakest first
        </label>
      </div>
      <div className="grid grid-2" style={{ marginTop: 12 }}>
        {list.map((s) => {
          const v = user.sounds[s.id];
          return (
            <a key={s.id} className="list-item" href={href(`/practice/sounds/${s.id}`)} style={{ marginTop: 0 }}>
              <span className="icon-tile">
                <Icon name="wave" />
              </span>
              <span className="grow">
                <b>{s.title}</b>
                <div className="small muted">{s.kind}</div>
              </span>
              {v != null && <span className={`chip ${v >= 80 ? 'good' : v >= 60 ? 'ok' : 'bad'}`}>{Math.round(v)}</span>}
            </a>
          );
        })}
      </div>
    </div>
  );
}

/** Accuracy of the target sound inside a word (falls back to the whole word). */
function targetAccuracy(a: Assessment, set: SoundSet): number | null {
  if (a.engine === 'typed') return null;
  if (set.kind === 'stress' || set.kind === 'intonation' || set.kind === 'rhythm') return a.prosody ?? a.pron;
  const ph = a.words.flatMap((w) => w.phonemes).filter((p) => set.ipa.includes(p.phoneme));
  if (ph.length) return ph.reduce((x, p) => x + p.accuracy, 0) / ph.length;
  return a.accuracy;
}

function shuffle<T>(xs: T[]): T[] {
  return [...xs].sort(() => Math.random() - 0.5);
}

export function SoundDrill({ id, unitId }: { id: string; unitId?: string }) {
  const set = soundById(id);
  const app = useApp();
  const mic = useListen();
  const { speak } = useSpeak();
  const elapsed = useElapsed();
  const [quiz, setQuiz] = useState<{ word: string; pair: [string, string]; answer?: string }[]>(() =>
    set ? shuffle(set.pairs).slice(0, 6).map((p) => ({ pair: p, word: p[Math.random() < 0.5 ? 0 : 1] })) : [],
  );
  const [qi, setQi] = useState(0);
  const [results, setResults] = useState<Record<string, Assessment>>({});
  const [active, setActive] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  if (!set) return <p>Sound not found.</p>;

  const sayItems = set.pairs.length ? set.pairs.flatMap((p) => p) : (set.words ?? []);

  async function say(text: string, record = false) {
    setActive(text);
    const a = await mic.listen({ reference: text, maxSeconds: 15, endSilenceMs: 1000, noSpeechMs: 7000, record });
    setActive(null);
    if (a) setResults((r) => ({ ...r, [text]: a }));
  }

  const targets = set.pairs.length ? set.pairs.map((p) => p[0]) : (set.words ?? []);
  const scores = [...targets, ...set.sentences].map((t) => (results[t] ? targetAccuracy(results[t], set) : null)).filter((x): x is number => x != null);
  const quizDone = quiz.filter((q) => q.answer).length;
  const quizRight = quiz.filter((q) => q.answer === q.word).length;

  async function save() {
    const score = scores.reduce((a, b) => a + b, 0) / scores.length;
    app.update((u) => {
      u.sounds[set!.id] = blend(u.sounds[set!.id] ?? null, score, 0.4);
      if (unitId) markPracticed(u, unitId, 'pronunciation');
    });
    await app.logAttempt({ at: Date.now(), kind: 'sounds', title: `Sound drill: ${set!.title}`, unitId, seconds: elapsed(), scores: { pronunciation: score }, detail: { quiz: `${quizRight}/${quizDone}` } }, { skillWeight: 0.15 });
    setSaved(true);
  }

  const row = (text: string, isTarget: boolean) => {
    const r = results[text];
    const acc = r ? targetAccuracy(r, set) : null;
    return (
      <div key={text} className="soft">
        <div className="spread">
          <div className="row">
            <b style={{ fontSize: '1.15rem' }}>{text}</b>
            {!isTarget && <span className="chip">contrast</span>}
            {acc != null && <span className={`chip ${acc >= 80 ? 'good' : acc >= 60 ? 'ok' : 'bad'}`}>{Math.round(acc)}</span>}
          </div>
          <div className="row">
            <button className="btn small" onClick={() => speak(text, 0.85)}>
              <Icon name="volume" size={16} />
            </button>
            <button className="btn small primary" onClick={() => say(text)} disabled={mic.state !== 'idle'}>
              <Icon name="mic" size={16} />
            </button>
          </div>
        </div>
        {active === text && (
          <div style={{ marginTop: 10 }}>
            <MicControl {...mic} onStart={() => {}} onStop={mic.stop} onTyped={mic.submitTyped} />
          </div>
        )}
        {r && r.words.some((w) => w.phonemes.length) && (
          <div style={{ marginTop: 8 }}>
            <WordScores a={r} />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="stack">
      <a className="small" href={href(unitId ? `/unit/${unitId}` : '/practice/sounds')}>
        ← {unitId ? 'Back to unit' : 'All sounds'}
      </a>
      <h1>{set.title}</h1>
      <div className="card stack">
        <p style={{ margin: 0 }}>{set.tip}</p>
        {MOUTH[set.id] && (
          <>
            <MouthPair target={MOUTH[set.id].target} contrast={MOUTH[set.id].contrast} />
            <ol className="small" style={{ margin: 0, paddingLeft: 20 }}>
              {MOUTH[set.id].steps.map((st) => (
                <li key={st}>{st}</li>
              ))}
            </ol>
          </>
        )}
      </div>

      {quiz.length > 0 && (
        <div className="card stack">
          <div className="spread">
            <h3>1. Hear the difference</h3>
            <span className="small muted">
              {quizRight}/{quizDone} right
            </span>
          </div>
          {qi < quiz.length ? (
            <>
              <div className="row">
                <button className="btn" onClick={() => speak(quiz[qi].word, 0.9)}>
                  <Icon name="volume" /> Play word {qi + 1}
                </button>
                <span className="muted small">Which word did you hear?</span>
              </div>
              <div className="row">
                {quiz[qi].pair.map((w) => {
                  const answered = quiz[qi].answer;
                  const cls = answered ? (w === quiz[qi].word ? 'good' : w === answered ? 'bad' : '') : '';
                  return (
                    <button
                      key={w}
                      className={`btn big ${cls ? `chip ${cls}` : ''}`}
                      disabled={Boolean(answered)}
                      onClick={() => setQuiz((q) => q.map((x, k) => (k === qi ? { ...x, answer: w } : x)))}
                    >
                      {w}
                    </button>
                  );
                })}
              </div>
              {quiz[qi].answer && (
                <button className="btn primary small" onClick={() => setQi(qi + 1)}>
                  Next <Icon name="next" size={16} />
                </button>
              )}
            </>
          ) : (
            <div className="row">
              <span>Done: {quizRight} of {quiz.length}.</span>
              <button
                className="btn small"
                onClick={() => {
                  setQuiz(shuffle(set.pairs).slice(0, 6).map((p) => ({ pair: p, word: p[Math.random() < 0.5 ? 0 : 1] })));
                  setQi(0);
                }}
              >
                Again
              </button>
            </div>
          )}
        </div>
      )}

      <div className="card stack">
        <h3>{quiz.length ? '2. ' : '1. '}Say the words</h3>
        <div className="grid grid-2">{set.pairs.length ? set.pairs.flatMap((p) => [row(p[0], true), row(p[1], false)]) : sayItems.map((w) => row(w, true))}</div>
      </div>

      <div className="card stack">
        <h3>{quiz.length ? '3. ' : '2. '}Say the sentences</h3>
        {set.sentences.map((s) => {
          const r = results[s];
          return (
            <div key={s} className="soft stack">
              <div className="spread">
                <b>{s}</b>
                <div className="row">
                  <button className="btn small" onClick={() => speak(s)}>
                    <Icon name="volume" size={16} />
                  </button>
                  <button className="btn small primary" onClick={() => say(s, true)} disabled={mic.state !== 'idle'}>
                    <Icon name="mic" size={16} />
                  </button>
                </div>
              </div>
              {active === s && <MicControl {...mic} onStart={() => {}} onStop={mic.stop} onTyped={mic.submitTyped} />}
              {r && (
                <>
                  <WordScores a={r} />
                  <ScoreChips a={r} showFluency={false} />
                  {r.audio && r.engine !== 'typed' && <IntonationGraph text={s} userAudio={r.audio} />}
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className="row">
        <button className="btn primary big" onClick={save} disabled={!scores.length || saved}>
          {saved ? 'Saved' : `Save score${scores.length ? ` (${Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)})` : ''}`}
        </button>
        {saved && (
          <a className="btn" href={href(unitId ? `/unit/${unitId}` : '/practice/sounds')}>
            Done
          </a>
        )}
      </div>
    </div>
  );
}
