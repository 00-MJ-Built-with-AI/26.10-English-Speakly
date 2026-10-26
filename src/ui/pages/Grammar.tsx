import { useState } from 'react';
import { unitById } from '../../content/units.ts';
import { wordAccuracy } from '../../engine/text.ts';
import { href } from '../../lib/router.ts';
import type { Assessment } from '../../speech/index.ts';
import { Icon } from '../components/Icon.tsx';
import { MicControl, ScoreChips, useListen, useSpeak, WordScores } from '../components/speaking.tsx';

/** The grammar note with spoken examples: hear each, then say it. */
export function Grammar({ unitId }: { unitId: string }) {
  const unit = unitById(unitId);
  const { speak } = useSpeak();
  const mic = useListen();
  const [active, setActive] = useState<number | null>(null);
  const [results, setResults] = useState<Record<number, Assessment>>({});
  if (!unit) return <p>Unit not found.</p>;
  const g = unit.grammar;
  return (
    <div className="stack">
      <a href={href(`/unit/${unit.id}`)} className="small">
        ← {unit.title}
      </a>
      <h1>{g.name}</h1>
      <div className="card">
        <p style={{ fontSize: '1.05rem' }}>{g.note}</p>
      </div>
      <div className="section-title">Say the examples</div>
      {g.examples.map((ex, i) => {
        const r = results[i];
        return (
          <div key={i} className="card">
            <div className="spread">
              <div className="prompt-text" style={{ fontSize: '1.15rem' }}>
                {ex}
              </div>
              <div className="row">
                <button className="btn small" onClick={() => speak(ex)}>
                  <Icon name="volume" size={16} /> Hear
                </button>
                <button className="btn small" onClick={() => speak(ex, 0.75)}>
                  Slow
                </button>
                <button
                  className="btn small primary"
                  onClick={async () => {
                    setActive(i);
                    const a = await mic.listen({ reference: ex, maxSeconds: 15, endSilenceMs: 1200, noSpeechMs: 8000 });
                    setActive(null);
                    if (a) setResults((x) => ({ ...x, [i]: a }));
                  }}
                  disabled={mic.state !== 'idle'}
                >
                  <Icon name="mic" size={16} /> Say it
                </button>
              </div>
            </div>
            {active === i && (
              <div style={{ marginTop: 12 }}>
                <MicControl {...mic} onStart={() => {}} onStop={mic.stop} onTyped={mic.submitTyped} />
              </div>
            )}
            {r && (
              <div className="stack" style={{ marginTop: 12 }}>
                <WordScores a={r} />
                <ScoreChips a={r} showFluency={false} />
                {wordAccuracy(ex, r.text) < 0.8 && r.engine !== 'typed' && <div className="small muted">Some words were missing or different. Try again.</div>}
              </div>
            )}
          </div>
        );
      })}
      <a className="btn primary big" href={href(`/practice/fast?unit=${unit.id}`)}>
        <Icon name="bolt" /> Now use it: speak-fast drills
      </a>
    </div>
  );
}
