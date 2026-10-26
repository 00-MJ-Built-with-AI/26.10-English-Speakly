import { useEffect, useRef, useState } from 'react';
import type { JournalResult } from '../../../shared/tasks.ts';
import { promptOfTheDay } from '../../content/journal.ts';
import { analyzeHesitation } from '../../engine/hesitation.ts';
import { workingLevel } from '../../engine/path.ts';
import { fluencyScore } from '../../engine/scoring.ts';
import { startOfDay } from '../../engine/srs.ts';
import { countWords } from '../../engine/text.ts';
import { aiTask } from '../../lib/api.ts';
import { useApp } from '../../lib/store.tsx';
import type { JournalEntry } from '../../lib/types.ts';
import type { Assessment } from '../../speech/index.ts';
import { HesitationChips } from '../components/Hesitation.tsx';
import { Icon } from '../components/Icon.tsx';
import { MicControl, PlayBlob, ScoreChips, useElapsed, useListen, useSpeak, WordScores } from '../components/speaking.tsx';

type Entry = JournalEntry & { id: string };

/** One prompt a day; talk for 1-2 minutes; get feedback and a fluency trend. */
export function Journal() {
  const app = useApp();
  const level = workingLevel(app.user);
  const mic = useListen();
  const { speak } = useSpeak();
  const elapsed = useElapsed();
  const [offset, setOffset] = useState(0);
  const [own, setOwn] = useState('');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [result, setResult] = useState<{ a: Assessment; r: JournalResult } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [practice, setPractice] = useState<Assessment | null>(null);
  const [added, setAdded] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const prompt = own.trim() || promptOfTheDay(new Date(), offset);

  useEffect(() => {
    app.repo.list<JournalEntry>('journal', { limit: 60 }).then(setEntries);
  }, [app.repo]);
  useEffect(() => () => clearInterval(timer.current), []);

  const doneToday = entries.some((e) => e.at >= startOfDay(Date.now()));

  async function record() {
    setError(null);
    setResult(null);
    setPractice(null);
    setAdded(null);
    setSeconds(0);
    const t0 = Date.now();
    timer.current = setInterval(() => setSeconds(Math.round((Date.now() - t0) / 1000)), 500);
    const a = await mic.listen({ maxSeconds: 120, endSilenceMs: 4000, noSpeechMs: 15_000, record: true });
    clearInterval(timer.current);
    if (!a || !a.text.trim()) return;
    setBusy(true);
    try {
      const r = await aiTask('journal', { level, prompt, transcript: a.text, seconds: a.speechMs / 1000 || seconds });
      setResult({ a, r });
      const real = a.engine !== 'typed';
      const hesitation = real ? analyzeHesitation(a) : undefined;
      const audioPath = await app.saveRecording(a.audio, { title: `Journal: ${prompt}`, kind: 'journal', seconds: Math.round(a.speechMs / 1000), text: a.text, score: real ? Math.round(a.pron) : undefined });
      const entry: JournalEntry = { at: Date.now(), prompt, text: a.text, seconds: Math.round(a.speechMs / 1000), feedback: r, hesitation, pron: real ? a.pron : undefined, audioPath };
      const id = await app.repo.add('journal', entry);
      setEntries((e) => [{ ...entry, id }, ...e]);
      await app.logAttempt({
        at: Date.now(),
        kind: 'journal',
        title: `Journal: ${prompt}`,
        seconds: elapsed(),
        hesitation,
        scores: { grammar: r.grammarScore, vocabulary: r.vocabularyScore, ...(real ? { pronunciation: a.pron, fluency: fluencyScore(a, false) } : {}) },
      });
      await app.addMistakes(
        r.corrections.map((c) => ({ kind: c.kind, said: c.original, better: c.corrected, why: c.explanation })),
        'Journal',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <div className="spread">
        <h1>Speaking journal</h1>
        {doneToday && <span className="chip good">Done today</span>}
      </div>
      <p className="muted">Talk for one to two minutes without preparing. Small mistakes are fine; keep going.</p>

      <div className="card stack">
        <div className="section-title">Today's prompt</div>
        <div className="prompt-text">{prompt}</div>
        <div className="row">
          <button className="btn small" onClick={() => speak(prompt)}>
            <Icon name="volume" size={16} /> Hear it
          </button>
          <button className="btn small" onClick={() => (setOwn(''), setOffset(offset + 1))}>
            <Icon name="refresh" size={16} /> Another prompt
          </button>
        </div>
        <input type="text" placeholder="Or talk about your own topic…" value={own} onChange={(e) => setOwn(e.target.value)} />
        {!result && (
          <MicControl
            {...mic}
            onStart={record}
            onStop={mic.stop}
            onTyped={mic.submitTyped}
            disabled={busy}
            hint={mic.state === 'listening' ? `${seconds} s` : 'Tap and talk; pause for 4 seconds when you finish'}
          />
        )}
        {mic.state === 'listening' && (
          <div className="bar">
            <span style={{ width: `${Math.min(100, (seconds / 120) * 100)}%`, background: seconds >= 60 ? 'var(--good)' : undefined }} />
          </div>
        )}
        {busy && <div className="muted">Reading your entry…</div>}
        {error && <div className="banner error">{error}</div>}
      </div>

      {result && (
        <div className="stack fade-in">
          <div className="card stack">
            <h3>What you said</h3>
            <p>{result.a.text}</p>
            <div className="small muted">
              {countWords(result.a.text)} words{result.a.speechMs ? ` in ${Math.round(result.a.speechMs / 1000)} s` : ''}
            </div>
            {result.a.engine !== 'typed' && (
              <>
                <HesitationChips h={analyzeHesitation(result.a)} />
                <ScoreChips a={result.a} />
                <PlayBlob blob={result.a.audio} />
              </>
            )}
          </div>
          <div className="card stack">
            <h3>Feedback</h3>
            <p>{result.r.feedback}</p>
            {result.r.corrections.map((c, k) => (
              <div key={k} className="soft">
                <s className="muted">{c.original}</s> → <b style={{ color: 'var(--good)' }}>{c.corrected}</b>
                <div className="small muted">{c.explanation}</div>
              </div>
            ))}
            <p className="small muted">Level of this entry: around {result.r.cefr}. Corrections were added to your review list.</p>
          </div>
          <div className="card stack">
            <div className="spread">
              <h3>A more natural version</h3>
              <button className="btn small" onClick={() => speak(result.r.polished)}>
                <Icon name="volume" size={16} /> Listen
              </button>
            </div>
            <p>{result.r.polished}</p>
            {practice ? (
              <>
                <WordScores a={practice} />
                <ScoreChips a={practice} />
              </>
            ) : null}
            <MicControl
              {...mic}
              onStart={async () => {
                const a = await mic.listen({ reference: result.r.polished, maxSeconds: 90, endSilenceMs: 2500, noSpeechMs: 10_000 });
                if (a) setPractice(a);
              }}
              onStop={mic.stop}
              onTyped={mic.submitTyped}
              hint="Read the natural version aloud"
            />
          </div>
          {result.r.phrases.length > 0 && (
            <div className="card stack">
              <h3>Phrases for this topic</h3>
              {result.r.phrases.map((p) => (
                <div key={p.phrase}>
                  <b>{p.phrase}</b> <span className="small muted">{p.meaning}</span>
                  <div className="small">“{p.example}”</div>
                </div>
              ))}
              <button
                className="btn small"
                style={{ alignSelf: 'flex-start' }}
                disabled={added != null}
                onClick={async () => setAdded(await app.addVocab(result.r.phrases, 'Journal'))}
              >
                {added == null ? 'Add to my phrases' : `Added ${added}`}
              </button>
            </div>
          )}
          <button className="btn" style={{ alignSelf: 'flex-start' }} onClick={() => (setResult(null), setOffset(offset + 1))}>
            Another entry
          </button>
        </div>
      )}

      {entries.length > 0 && (
        <div className="card">
          <h3>Past entries</h3>
          <JournalTrend entries={entries} />
          {entries.slice(0, 20).map((e) => (
            <details key={e.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
              <summary>
                <span className="small muted">{new Date(e.at).toLocaleDateString()}</span> {e.prompt}
              </summary>
              <p className="small" style={{ marginTop: 8 }}>
                {e.text}
              </p>
              {e.hesitation && <HesitationChips h={e.hesitation} showStart={false} />}
              {(e.feedback as JournalResult | undefined)?.polished && (
                <p className="small">
                  <b>Natural version:</b> {(e.feedback as JournalResult).polished}
                </p>
              )}
              {e.audioPath && <SavedAudio path={e.audioPath} />}
            </details>
          ))}
        </div>
      )}
    </div>
  );
}

function SavedAudio({ path }: { path: string }) {
  const { repo } = useApp();
  const [blob, setBlob] = useState<Blob>();
  return blob ? (
    <PlayBlob blob={blob} label="Play" />
  ) : (
    <button
      className="btn small"
      onClick={async () => {
        try {
          setBlob(await (await fetch(await repo.audioUrl(path))).blob());
        } catch {
          /* recording deleted */
        }
      }}
    >
      <Icon name="play" size={14} /> Load recording
    </button>
  );
}

/** Words per entry and smoothness over time. */
function JournalTrend({ entries }: { entries: Entry[] }) {
  const pts = [...entries].reverse().slice(-30);
  if (pts.length < 2) return null;
  const W = 600;
  const H = 120;
  const maxWords = Math.max(...pts.map((e) => countWords(e.text)), 50);
  const x = (i: number) => 20 + (i / (pts.length - 1)) * (W - 40);
  const yW = (v: number) => H - 16 - (v / maxWords) * (H - 32);
  const yS = (v: number) => H - 16 - (v / 100) * (H - 32);
  const smooth = pts.map((e, i) => (e.hesitation ? `${x(i)},${yS(e.hesitation.score)}` : null)).filter(Boolean);
  return (
    <div style={{ marginBottom: 8 }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }} role="img" aria-label="Journal trend">
        <polyline fill="none" stroke="var(--voc)" strokeWidth="2.5" points={pts.map((e, i) => `${x(i)},${yW(countWords(e.text))}`).join(' ')} />
        {smooth.length > 1 && <polyline fill="none" stroke="var(--flu)" strokeWidth="2.5" strokeDasharray="5 4" points={smooth.join(' ')} />}
      </svg>
      <div className="row small">
        <span style={{ color: 'var(--voc)' }}>— words per entry</span>
        <span style={{ color: 'var(--flu)' }}>- - smoothness</span>
      </div>
    </div>
  );
}
