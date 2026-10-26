import { useEffect, useState } from 'react';
import { unitById } from '../../content/units.ts';
import { currentUnit, markPracticed, workingLevel } from '../../engine/path.ts';
import { aiTask } from '../../lib/api.ts';
import { href } from '../../lib/router.ts';
import { useApp } from '../../lib/store.tsx';
import type { Assessment } from '../../speech/index.ts';
import { Icon } from '../components/Icon.tsx';
import { MicControl, PlayBlob, ScoreChips, useElapsed, useListen, useSpeak, WordScores } from '../components/speaking.tsx';

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export function Shadowing({ unitId }: { unitId?: string }) {
  const app = useApp();
  const unit = unitById(unitId ?? '') ?? currentUnit(app.user);
  const level = unit?.level ?? workingLevel(app.user);
  const [sentences, setSentences] = useState<string[]>(unit?.shadow ?? []);
  const [source, setSource] = useState<'unit' | 'ai'>('unit');
  const [loading, setLoading] = useState(false);
  const [i, setI] = useState(0);
  const [hide, setHide] = useState(false);
  const [results, setResults] = useState<Record<number, Assessment>>({});
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mic = useListen();
  const { speak, prefetch, speaking } = useSpeak();
  const elapsed = useElapsed();
  const s = sentences[i];

  useEffect(() => {
    if (s) prefetch(s);
  }, [s, prefetch]);

  async function newSet() {
    setLoading(true);
    setError(null);
    try {
      const r = (await aiTask('generate', { kind: 'shadow', level, topic: unit?.topic, focus: unit?.grammar.name, count: 6 })) as { sentences: string[] };
      setSentences(r.sentences);
      setSource('ai');
      setI(0);
      setResults({});
      setDone(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function shadow() {
    await speak(s);
    const a = await mic.listen({ reference: s, maxSeconds: 20, endSilenceMs: 1300, noSpeechMs: 6000, record: true });
    if (a) setResults((x) => ({ ...x, [i]: a }));
  }

  async function finish() {
    const all = Object.values(results);
    const real = all.filter((a) => a.engine !== 'typed');
    await app.logAttempt({
      at: Date.now(),
      kind: 'shadow',
      title: `Shadowing${unit && source === 'unit' ? `: ${unit.title}` : ''}`,
      unitId: unit?.id,
      seconds: elapsed(),
      scores: real.length ? { pronunciation: avg(real.map((a) => a.pron)), fluency: avg(real.map((a) => a.fluency)) } : {},
    });
    const weak = real.flatMap((a) => a.words.filter((w) => w.error !== 'Omission' && w.accuracy < 60));
    await app.addMistakes(
      weak.map((w) => ({ kind: 'pronunciation', said: w.word, better: w.word, why: `Pronunciation ${Math.round(w.accuracy)}/100 while shadowing` })),
      'Shadowing',
    );
    if (unit && source === 'unit') app.update((u) => markPracticed(u, unit.id, 'pronunciation'));
    setDone(true);
  }

  const r = results[i];
  if (done) {
    const all = Object.values(results).filter((a) => a.engine !== 'typed');
    return (
      <div className="stack">
        <h1>Nice work</h1>
        <div className="card">
          <p>
            You shadowed {Object.keys(results).length} sentences. Average pronunciation <b>{Math.round(avg(all.map((a) => a.pron)))}</b>.
          </p>
          <p className="muted small">Words under 60 were added to your review list.</p>
        </div>
        <div className="row">
          {unit && (
            <a className="btn primary" href={href(`/unit/${unit.id}`)}>
              Back to {unit.title}
            </a>
          )}
          <button className="btn" onClick={newSet}>
            New sentences
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="spread">
        <div>
          <h1>Shadowing</h1>
          <p className="muted small">
            Listen, then repeat immediately, copying the rhythm and melody. {unit && source === 'unit' ? `${unit.level} · ${unit.title}` : `${level} · new sentences`}
          </p>
        </div>
        <div className="row">
          <label className="row small">
            <input type="checkbox" checked={hide} onChange={(e) => setHide(e.target.checked)} /> Hide text
          </label>
          <button className="btn small" onClick={newSet} disabled={loading}>
            <Icon name="refresh" size={16} /> {loading ? 'Making…' : 'New sentences'}
          </button>
        </div>
      </div>
      {error && <div className="banner error">{error}</div>}
      {s && (
        <div className="card stack">
          <div className="spread">
            <span className="small muted">
              {i + 1} / {sentences.length}
            </span>
            <div className="row">
              <button className="btn small" onClick={() => speak(s)} disabled={speaking}>
                <Icon name="volume" size={16} /> Play
              </button>
              <button className="btn small" onClick={() => speak(s, 0.7)} disabled={speaking}>
                <Icon name="slow" size={16} /> Slow
              </button>
            </div>
          </div>
          <div className="prompt-text" style={{ filter: hide && !r ? 'blur(7px)' : undefined }}>
            {r ? <WordScores a={r} /> : s}
          </div>
          {r && (
            <div className="stack">
              <ScoreChips a={r} />
              <div className="row">
                <PlayBlob blob={r.audio} />
                <button className="btn small" onClick={() => speak(s)}>
                  <Icon name="volume" size={14} /> Model
                </button>
              </div>
            </div>
          )}
          <MicControl
            {...mic}
            onStart={shadow}
            onStop={mic.stop}
            onTyped={mic.submitTyped}
            disabled={speaking}
            hint={r ? 'Tap to try again' : 'Tap: you hear the sentence, then repeat it'}
          />
          <div className="spread">
            <button className="btn ghost" onClick={() => setI(Math.max(0, i - 1))} disabled={i === 0}>
              <Icon name="back" size={18} /> Back
            </button>
            {i + 1 < sentences.length ? (
              <button className="btn primary" onClick={() => setI(i + 1)}>
                Next <Icon name="next" size={18} />
              </button>
            ) : (
              <button className="btn primary" onClick={finish} disabled={!Object.keys(results).length}>
                Finish
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
