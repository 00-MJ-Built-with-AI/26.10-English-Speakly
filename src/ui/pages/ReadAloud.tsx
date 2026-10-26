import { useState } from 'react';
import { unitById } from '../../content/units.ts';
import { currentUnit, workingLevel } from '../../engine/path.ts';
import { aiTask } from '../../lib/api.ts';
import { useApp } from '../../lib/store.tsx';
import type { Assessment } from '../../speech/index.ts';
import { Icon } from '../components/Icon.tsx';
import { MicControl, PlayBlob, ScoreChips, useElapsed, useListen, useSpeak, WordScores } from '../components/speaking.tsx';

export function ReadAloud({ unitId, custom, onBack }: { unitId?: string; custom?: { title: string; text: string }; onBack?: () => void }) {
  const app = useApp();
  const unit = custom ? undefined : (unitById(unitId ?? '') ?? currentUnit(app.user));
  const level = unit?.level ?? workingLevel(app.user);
  const [passage, setPassage] = useState<{ title: string; text: string }>(() => custom ?? { title: unit ? unit.title : 'Practice passage', text: (unit?.shadow ?? []).join(' ') });
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Assessment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mic = useListen();
  const { speak, speaking, stop } = useSpeak();
  const elapsed = useElapsed();

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const r = (await aiTask('generate', { kind: 'readaloud', level, topic: topic || unit?.topic })) as { title: string; text: string };
      setPassage(r);
      setResult(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function read() {
    const a = await mic.listen({ reference: passage.text, maxSeconds: 120, endSilenceMs: 2500, noSpeechMs: 10_000, record: true });
    if (!a) return;
    setResult(a);
    if (a.engine !== 'typed') {
      await app.logAttempt({ at: Date.now(), kind: custom ? 'mytext' : 'readaloud', title: `Read aloud: ${passage.title}`, unitId: unit?.id, seconds: elapsed(), scores: { pronunciation: a.pron, fluency: a.fluency } });
      app.saveRecording(a.audio, { title: `Read aloud: ${passage.title}`, kind: 'readaloud', seconds: Math.round(a.speechMs / 1000), text: passage.text, score: Math.round(a.pron) });
      await app.addMistakes(
        a.words.filter((w) => w.error !== 'Omission' && w.accuracy < 60).map((w) => ({ kind: 'pronunciation', said: w.word, better: w.word, why: `Pronunciation ${Math.round(w.accuracy)}/100 reading aloud` })),
        'Read aloud',
      );
    }
  }

  return (
    <div className="stack">
      <h1>Read aloud</h1>
      {onBack && (
        <button className="btn ghost small" onClick={onBack} style={{ alignSelf: 'flex-start', paddingLeft: 0 }}>
          ← My texts
        </button>
      )}
      {!custom && <div className="card row">
        <input type="text" placeholder={`Topic (optional), e.g. ${unit?.topic ?? 'a team meeting'}`} value={topic} onChange={(e) => setTopic(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
        <button className="btn" onClick={generate} disabled={loading}>
          <Icon name="refresh" size={16} /> {loading ? 'Writing…' : `New ${level} passage`}
        </button>
      </div>}
      {error && <div className="banner error">{error}</div>}
      <div className="card stack">
        <div className="spread">
          <h2>{passage.title}</h2>
          <button className="btn small" onClick={() => (speaking ? stop() : speak(passage.text))}>
            <Icon name={speaking ? 'stop' : 'volume'} size={16} /> {speaking ? 'Stop' : 'Model reading'}
          </button>
        </div>
        {result ? <WordScores a={result} /> : <p style={{ fontSize: '1.2rem', lineHeight: 1.7 }}>{passage.text}</p>}
        {result && (
          <div className="stack">
            <ScoreChips a={result} />
            <div className="small muted">
              Pace {Math.round(result.wordsPerMinute)} words/min (natural is 130-160) · {result.longPauses} long pause{result.longPauses === 1 ? '' : 's'}
            </div>
            <PlayBlob blob={result.audio} />
          </div>
        )}
        <MicControl {...mic} onStart={read} onStop={mic.stop} onTyped={mic.submitTyped} hint="Tap and read the whole passage; pause to finish" />
      </div>
    </div>
  );
}
