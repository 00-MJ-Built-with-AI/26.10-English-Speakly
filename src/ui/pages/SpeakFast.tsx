import { useEffect, useRef, useState } from 'react';
import type { GradeResult } from '../../../shared/tasks.ts';
import { unitById, type FastPrompt } from '../../content/units.ts';
import { currentUnit, markPracticed, workingLevel } from '../../engine/path.ts';
import { fluencyScore, PASS_MARK } from '../../engine/scoring.ts';
import { analyzeHesitation, combineHesitation } from '../../engine/hesitation.ts';
import { aiTask } from '../../lib/api.ts';
import { href } from '../../lib/router.ts';
import { useApp } from '../../lib/store.tsx';
import type { Assessment } from '../../speech/index.ts';
import { Icon } from '../components/Icon.tsx';
import { MicControl, useElapsed, useListen, useSpeak } from '../components/speaking.tsx';

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export function SpeakFast({ unitId }: { unitId?: string }) {
  const app = useApp();
  const unit = unitById(unitId ?? '') ?? currentUnit(app.user);
  const level = unit?.level ?? workingLevel(app.user);
  const target = PASS_MARK[level].startSeconds;
  const [items, setItems] = useState<FastPrompt[]>(unit?.fast ?? []);
  const [fromUnit, setFromUnit] = useState(true);
  const [i, setI] = useState(-1);
  const [count, setCount] = useState(0);
  const [results, setResults] = useState<{ a: Assessment; g: GradeResult }[]>([]);
  const [grading, setGrading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [speakPrompt, setSpeakPrompt] = useState(false);
  const [done, setDone] = useState(false);
  const mic = useListen();
  const { speak } = useSpeak();
  const elapsed = useElapsed();
  const [clock, setClock] = useState(0);
  const clockStart = useRef(0);
  const cur = items[i];
  const res = results[i];

  useEffect(() => {
    if (mic.state !== 'listening') return;
    clockStart.current = performance.now();
    const t = setInterval(() => setClock((performance.now() - clockStart.current) / 1000), 100);
    return () => clearInterval(t);
  }, [mic.state, i]);

  async function more() {
    setLoading(true);
    setError(null);
    try {
      const r = (await aiTask('generate', { kind: 'fast', level, topic: unit?.topic, focus: unit?.grammar.name, count: 6 })) as { items: FastPrompt[] };
      setItems(r.items);
      setFromUnit(false);
      setResults([]);
      setI(-1);
      setDone(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function go(n: number) {
    setI(n);
    for (let c = 3; c > 0; c--) {
      setCount(c);
      await new Promise((r) => setTimeout(r, 650));
    }
    setCount(0);
    const p = items[n];
    if (speakPrompt) await speak(p.prompt);
    setClock(0);
    const a = await mic.listen({ maxSeconds: 25, endSilenceMs: 1500, noSpeechMs: 12_000, onSpeechStart: () => setClock((performance.now() - clockStart.current) / 1000) });
    if (!a) return;
    setGrading(true);
    try {
      const g = await aiTask('grade', { level, instruction: p.instruction, prompt: p.prompt, example: p.example, grammarFocus: unit?.grammar.name ?? 'general accuracy', transcript: a.text });
      setResults((r) => {
        const x = [...r];
        x[n] = { a, g };
        return x;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGrading(false);
    }
  }

  async function finish() {
    const rs = results.filter(Boolean);
    const real = rs.filter((r) => r.a.engine !== 'typed');
    await app.logAttempt({
      at: Date.now(),
      kind: 'fast',
      title: `Speak fast${unit && fromUnit ? `: ${unit.title}` : ''}`,
      unitId: unit?.id,
      seconds: elapsed(),
      hesitation: combineHesitation(real.map((r) => analyzeHesitation(r.a))),
      scores: {
        grammar: avg(rs.map((r) => r.g.grammarScore)),
        ...(real.length ? { fluency: avg(real.map((r) => fluencyScore(r.a, true))) } : {}),
      },
    });
    await app.addMistakes(
      rs.filter((r) => !r.g.correct && r.a.text).map((r) => ({ kind: 'grammar' as const, said: r.a.text, better: r.g.corrected, why: r.g.feedback })),
      'Speak fast',
    );
    if (unit && fromUnit) app.update((u) => markPracticed(u, unit.id, 'grammar'));
    setDone(true);
  }

  if (done) {
    const rs = results.filter(Boolean);
    const real = rs.filter((r) => r.a.engine !== 'typed');
    return (
      <div className="stack">
        <h1>Drill done</h1>
        <div className="card">
          <p>
            <b>{rs.filter((r) => r.g.correct).length}</b> of {rs.length} correct.{' '}
            {real.length > 0 && (
              <>
                Average start: <b>{(avg(real.map((r) => r.a.startDelayMs)) / 1000).toFixed(1)} s</b> (goal ≤ {target} s).
              </>
            )}
          </p>
          <p className="muted small">Wrong answers went to your review list.</p>
        </div>
        <div className="row">
          <button className="btn primary" onClick={more}>
            More drills
          </button>
          {unit && (
            <a className="btn" href={href(`/unit/${unit.id}`)}>
              Back to {unit.title}
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="spread">
        <div>
          <h1>Speak fast</h1>
          <p className="muted small">
            Start speaking within {target} seconds, even if it's not perfect. {unit && fromUnit ? `${unit.level} · ${unit.grammar.name}` : `${level} · new drills`}
          </p>
        </div>
        <div className="row">
          <label className="row small">
            <input type="checkbox" checked={speakPrompt} onChange={(e) => setSpeakPrompt(e.target.checked)} /> Read prompts aloud
          </label>
          <button className="btn small" onClick={more} disabled={loading}>
            <Icon name="refresh" size={16} /> {loading ? 'Making…' : 'New drills'}
          </button>
        </div>
      </div>
      {error && <div className="banner error">{error}</div>}
      {i < 0 ? (
        <div className="card stack" style={{ textAlign: 'center' }}>
          <p>{items.length} prompts. Each one appears after a 3-2-1 countdown and the microphone opens straight away.</p>
          <button className="btn primary big" onClick={() => go(0)} disabled={!items.length}>
            Start
          </button>
        </div>
      ) : count > 0 ? (
        <div className="card" style={{ textAlign: 'center' }}>
          <div className="countdown">{count}</div>
        </div>
      ) : (
        cur && (
          <div className="card stack">
            <div className="spread">
              <span className="small muted">
                {i + 1} / {items.length}
              </span>
              {mic.state === 'listening' && (
                <span className={`chip ${clock <= target ? 'good' : 'bad'}`}>
                  <span className="timer-ring">{clock.toFixed(1)} s</span>
                </span>
              )}
            </div>
            <div className="section-title">{cur.instruction}</div>
            <div className="prompt-text">{cur.prompt}</div>
            {!res && <MicControl {...mic} onStart={() => go(i)} onStop={mic.stop} onTyped={mic.submitTyped} disabled={grading} />}
            {grading && <div className="muted">Checking…</div>}
            {res && (
              <div className="stack fade-in">
                <div className="soft">“{res.a.text || '(nothing heard)'}”</div>
                <div className="row">
                  <span className={`chip ${res.g.correct ? 'good' : 'bad'}`}>{res.g.correct ? 'Correct' : 'Not quite'}</span>
                  {res.a.engine !== 'typed' && (
                    <span className={`chip ${res.a.startDelayMs / 1000 <= target ? 'good' : 'ok'}`}>Started after {(res.a.startDelayMs / 1000).toFixed(1)} s</span>
                  )}
                </div>
                {!res.g.correct && (
                  <div>
                    Better: <b>{res.g.corrected}</b>
                  </div>
                )}
                <div className="small muted">{res.g.feedback}</div>
                <div className="row">
                  <button className="btn small" onClick={() => speak(res.g.correct ? res.a.text : res.g.corrected)}>
                    <Icon name="volume" size={14} /> Hear the good version
                  </button>
                  <button className="btn small ghost" onClick={() => {
                      setResults((r) => {
                        const x = [...r];
                        delete x[i];
                        return x;
                      });
                      go(i);
                    }}>
                    <Icon name="refresh" size={14} /> Again
                  </button>
                  {i + 1 < items.length ? (
                    <button className="btn primary" onClick={() => go(i + 1)}>
                      Next <Icon name="next" size={18} />
                    </button>
                  ) : (
                    <button className="btn primary" onClick={finish}>
                      Finish
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      )}
    </div>
  );
}
