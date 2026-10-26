import { useEffect, useState } from 'react';
import { LEARNED_BOX, review } from '../../engine/srs.ts';
import { wordAccuracy } from '../../engine/text.ts';
import { href } from '../../lib/router.ts';
import { useApp } from '../../lib/store.tsx';
import type { Mistake } from '../../lib/types.ts';
import type { Assessment } from '../../speech/index.ts';
import { Icon } from '../components/Icon.tsx';
import { MicControl, useElapsed, useListen, useSpeak, WordScores } from '../components/speaking.tsx';

type M = Mistake & { id: string };

/** Spaced-repetition speaking review of past mistakes. */
export function Review() {
  const app = useApp();
  const { repo } = app;
  const [items, setItems] = useState<M[] | null>(null);
  const [total, setTotal] = useState(0);
  const [i, setI] = useState(0);
  const [shown, setShown] = useState(false);
  const [result, setResult] = useState<{ a: Assessment; ok: boolean; unjudged?: boolean } | null>(null);
  const [stats, setStats] = useState({ right: 0, wrong: 0 });
  const mic = useListen();
  const { speak } = useSpeak();
  const elapsed = useElapsed();

  useEffect(() => {
    repo.list<Mistake>('mistakes', { dueBefore: Date.now() }).then((all) => {
      const due = all.filter((m) => m.box < LEARNED_BOX);
      setTotal(due.length);
      setItems(due.slice(0, 15));
    });
  }, [repo]);

  if (!items) return <p className="muted">Loading…</p>;
  const m = items[i];

  async function attempt() {
    if (!m) return;
    const isPron = m.kind === 'pronunciation';
    const a = await mic.listen({ reference: isPron || shown ? m.better : undefined, maxSeconds: 20, endSilenceMs: 1400, noSpeechMs: 10_000 });
    if (!a) return;
    if (isPron && a.engine === 'typed') {
      // Typing can't show pronunciation: leave the schedule alone.
      setResult({ a, ok: false, unjudged: true });
      return;
    }
    const ok = isPron ? a.accuracy >= 70 && a.completeness >= 80 : wordAccuracy(m.better, a.text) >= 0.8;
    setResult({ a, ok });
    if (!shown || !ok) {
      const next = review(m, ok && !shown);
      await repo.update('mistakes', m.id, { box: next.box, due: next.due, reps: next.reps, lapses: next.lapses });
      setStats((s) => (ok && !shown ? { ...s, right: s.right + 1 } : { ...s, wrong: s.wrong + 1 }));
    }
  }

  function next() {
    setResult(null);
    setShown(false);
    if (i + 1 >= items!.length) {
      app.logAttempt({ at: Date.now(), kind: 'review', title: 'Mistake review', seconds: elapsed(), scores: {}, detail: stats });
    }
    setI(i + 1);
  }

  if (!m) {
    return (
      <div className="stack">
        <h1>Review</h1>
        <div className="card">
          {items.length === 0 ? (
            <p>Nothing due right now. Mistakes from your practice come back here on a schedule (1, 3, 7, 14, 30 days) until you get them right.</p>
          ) : (
            <p>
              Done! {stats.right} right, {stats.wrong} to see again soon.{total > items.length ? ` ${total - items.length} more are due.` : ''}
            </p>
          )}
        </div>
        <div className="row">
          {total > items.length && (
            <button className="btn primary" onClick={() => location.reload()}>
              Next batch
            </button>
          )}
          <a className="btn" href={href('/today')}>
            Back to today
          </a>
        </div>
      </div>
    );
  }

  const isPron = m.kind === 'pronunciation';
  return (
    <div className="stack">
      <div className="spread">
        <h1>Review</h1>
        <span className="small muted">
          {i + 1} / {items.length}
        </span>
      </div>
      <div className="card stack">
        <span className={`chip ${isPron ? 'brand' : 'ok'}`} style={{ alignSelf: 'flex-start' }}>
          {m.kind}
        </span>
        {isPron ? (
          <>
            <div className="section-title">Say this word clearly</div>
            <div className="prompt-text">{m.better}</div>
            <div>
              <button className="btn small" onClick={() => speak(m.better, 0.8)}>
                <Icon name="volume" size={16} /> Hear it
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="section-title">You said this. Say it correctly.</div>
            <div className="prompt-text">
              <s style={{ textDecorationColor: 'var(--bad)' }}>{m.said}</s>
            </div>
            {shown ? (
              <div className="soft">
                <b>{m.better}</b>
                <div className="small muted">{m.why}</div>
              </div>
            ) : (
              !result && (
                <button className="btn small ghost" onClick={() => setShown(true)} style={{ alignSelf: 'flex-start' }}>
                  Show answer
                </button>
              )
            )}
          </>
        )}
        {!result && <MicControl {...mic} onStart={attempt} onStop={mic.stop} onTyped={mic.submitTyped} />}
        {result && (
          <div className="stack fade-in">
            {isPron ? <WordScores a={result.a} /> : <div className="soft">“{result.a.text || '(nothing heard)'}”</div>}
            <div className={`banner ${result.ok ? 'info' : result.unjudged ? '' : 'error'}`}>
              {result.unjudged
                ? 'Pronunciation can only be checked by voice, so this one stays in your list.'
                : result.ok
                  ? shown
                    ? 'Good. It will come back soon to make it stick.'
                    : 'Correct! See you again in a few days.'
                  : `Not yet. ${isPron ? '' : `Correct: “${m.better}”. `}It comes back tomorrow.`}
            </div>
            {!isPron && (
              <div>
                <button className="btn small" onClick={() => speak(m.better)}>
                  <Icon name="volume" size={14} /> Hear the correct version
                </button>
              </div>
            )}
            <button className="btn primary" onClick={next} style={{ alignSelf: 'flex-start' }}>
              Next <Icon name="next" size={18} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
