import { useState } from 'react';
import { acceptNumber, CATEGORY_LABELS, makeItem, type NumberCategory, type NumberItem } from '../../engine/numbers.ts';
import { useApp } from '../../lib/store.tsx';
import { Icon } from '../components/Icon.tsx';
import { MicControl, useElapsed, useListen, useSpeak } from '../components/speaking.tsx';

const ALL = Object.keys(CATEGORY_LABELS) as NumberCategory[];
const ROUND = 10;

/** Say prices, dates, times, phone numbers and emails, and spell names, out loud. */
export function Numbers() {
  const app = useApp();
  const mic = useListen();
  const { speak } = useSpeak();
  const elapsed = useElapsed();
  const [cats, setCats] = useState<NumberCategory[]>(['price', 'date', 'time', 'phone', 'email', 'spell']);
  const [mode, setMode] = useState<'say' | 'hear'>('say');
  const [items, setItems] = useState<NumberItem[]>([]);
  const [i, setI] = useState(0);
  const [results, setResults] = useState<{ said: string; ok: boolean }[]>([]);
  const item = items[i];
  const res = results[i];
  const done = items.length > 0 && i >= items.length;

  function start() {
    setItems(Array.from({ length: ROUND }, (_, k) => makeItem(cats[k % cats.length])).sort(() => Math.random() - 0.5));
    setI(0);
    setResults([]);
  }

  async function answer() {
    if (!item) return;
    if (mode === 'hear') await speak(item.sentence);
    const a = await mic.listen({ maxSeconds: 20, endSilenceMs: 1600, noSpeechMs: 10_000 });
    if (!a) return;
    setResults((r) => {
      const x = [...r];
      x[i] = { said: a.text, ok: acceptNumber(item, a.text) };
      return x;
    });
  }

  function log() {
    const right = results.filter((r) => r?.ok).length;
    app.logAttempt({ at: Date.now(), kind: 'numbers', title: 'Numbers and spelling', seconds: elapsed(), scores: {}, detail: { right, total: results.length, cats } });
  }

  if (!items.length) {
    return (
      <div className="stack">
        <h1>Numbers and spelling</h1>
        <p className="muted">Prices, dates, phone numbers and emails come up in every call and meeting, and they are easy to get wrong under pressure. {ROUND} quick items per round.</p>
        <div className="card stack">
          <div className="section-title">What to practise</div>
          <div className="row">
            {ALL.map((c) => (
              <button key={c} className={`btn small ${cats.includes(c) ? 'primary' : ''}`} onClick={() => setCats((x) => (x.includes(c) ? (x.length > 1 ? x.filter((y) => y !== c) : x) : [...x, c]))}>
                {CATEGORY_LABELS[c]}
              </button>
            ))}
          </div>
          <div className="section-title">Mode</div>
          <div className="row">
            <button className={`btn ${mode === 'say' ? 'primary' : ''}`} onClick={() => setMode('say')}>
              Say it: read what you see
            </button>
            <button className={`btn ${mode === 'hear' ? 'primary' : ''}`} onClick={() => setMode('hear')}>
              Hear and repeat: listen, then say it
            </button>
          </div>
          <button className="btn primary big" onClick={start} style={{ alignSelf: 'flex-start' }}>
            <Icon name="play" /> Start
          </button>
        </div>
      </div>
    );
  }

  if (done) {
    const right = results.filter((r) => r.ok).length;
    return (
      <div className="stack">
        <h1>
          {right} of {results.length} right
        </h1>
        <div className="card">
          {items.map((it, k) => (
            <div key={k} className="spread small" style={{ padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
              <span>
                <b>{it.written}</b> <span className="muted">· {CATEGORY_LABELS[it.category]}</span>
                <div className="muted">You said: “{results[k]?.said || '–'}”</div>
                {!results[k]?.ok && <div>Say: {it.spoken[0]}</div>}
              </span>
              <span className="row">
                <button className="btn ghost small" onClick={() => speak(it.sentence)} aria-label="Listen">
                  <Icon name="volume" size={16} />
                </button>
                <span className={`chip ${results[k]?.ok ? 'good' : 'bad'}`}>{results[k]?.ok ? 'right' : 'again'}</span>
              </span>
            </div>
          ))}
        </div>
        <div className="row">
          <button
            className="btn primary"
            onClick={() => {
              log();
              start();
            }}
          >
            Another round
          </button>
          <button
            className="btn"
            onClick={() => {
              log();
              setItems([]);
            }}
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="spread">
        <span className="small muted">
          {i + 1} / {items.length} · {CATEGORY_LABELS[item.category]}
        </span>
        <span className="small muted">{results.filter((r) => r?.ok).length} right</span>
      </div>
      <div className="card stack" style={{ textAlign: 'center' }}>
        {mode === 'say' || res ? (
          <div className="prompt-text" style={{ fontSize: '2rem', wordBreak: 'break-word' }}>
            {item.written}
          </div>
        ) : (
          <div className="muted">Listen, then say what you heard.</div>
        )}
        {item.category === 'spell' && mode === 'say' && !res && <div className="small muted">Spell it letter by letter.</div>}
        {!res && <MicControl {...mic} onStart={answer} onStop={mic.stop} onTyped={mic.submitTyped} hint={mode === 'hear' ? 'Tap: you hear it, then say it' : 'Tap and say it'} />}
        {res && (
          <div className="stack fade-in">
            <div className="soft">“{res.said || '(nothing heard)'}”</div>
            <div className={`banner ${res.ok ? 'info' : 'error'}`}>{res.ok ? 'Right!' : `Say it like this: ${item.spoken[0]}`}</div>
            <div className="row" style={{ justifyContent: 'center' }}>
              <button className="btn small" onClick={() => speak(item.sentence)}>
                <Icon name="volume" size={14} /> Hear it
              </button>
              {i + 1 < items.length ? (
                <button className="btn primary" onClick={() => setI(i + 1)}>
                  Next <Icon name="next" size={16} />
                </button>
              ) : (
                <button className="btn primary" onClick={() => setI(i + 1)}>
                  See results
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
