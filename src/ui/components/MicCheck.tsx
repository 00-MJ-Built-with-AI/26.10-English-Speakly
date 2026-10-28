import { useEffect, useRef, useState } from 'react';
import { dbfs, micVerdict, percentile, type MicCheckResult } from '../../engine/audiocheck.ts';
import { wordAccuracy } from '../../engine/text.ts';
import { useApp } from '../../lib/store.tsx';
import { micStream } from '../../speech/mic.ts';
import { Icon } from './Icon.tsx';
import { useListen, useSpeak } from './speaking.tsx';

const TEST_SENTENCE = "Hello, I'm checking my microphone before I practise my English today.";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Live microphone level in dBFS, sampled every 100 ms while active. */
function useMicLevel(active: boolean) {
  const [level, setLevel] = useState(-100);
  const samples = useRef<number[]>([]);
  useEffect(() => {
    if (!active) return;
    let ctx: AudioContext | undefined;
    let timer: ReturnType<typeof setInterval> | undefined;
    let alive = true;
    micStream()
      .then((stream) => {
        if (!alive) return;
        ctx = new AudioContext();
        const an = ctx.createAnalyser();
        an.fftSize = 2048;
        ctx.createMediaStreamSource(stream).connect(an);
        const buf = new Float32Array(an.fftSize);
        timer = setInterval(() => {
          an.getFloatTimeDomainData(buf);
          let s = 0;
          for (const v of buf) s += v * v;
          const db = dbfs(Math.sqrt(s / buf.length));
          samples.current.push(db);
          setLevel(db);
        }, 100);
      })
      .catch(() => {});
    return () => {
      alive = false;
      if (timer) clearInterval(timer);
      ctx?.close().catch(() => {});
    };
  }, [active]);
  return {
    level,
    /** Samples collected since the last call. */
    take: () => samples.current.splice(0),
  };
}

type Phase = 'idle' | 'quiet' | 'speak' | 'echo' | 'done' | 'error';

/** One-minute check of the microphone, room noise, echo and recognition. Saves the result. */
export function MicCheck({ onDone }: { onDone?: (r: MicCheckResult) => void }) {
  const app = useApp();
  const mic = useListen();
  const { speak } = useSpeak();
  const [phase, setPhase] = useState<Phase>('idle');
  const [result, setResult] = useState<MicCheckResult | null>(app.user.micCheck ?? null);
  const [error, setError] = useState<string | null>(null);
  const meter = useMicLevel(phase !== 'idle' && phase !== 'done' && phase !== 'error');

  async function run() {
    setError(null);
    try {
      await micStream();
    } catch {
      setPhase('error');
      setError('The microphone is blocked or missing. Allow microphone access for this site in your browser, then try again.');
      return;
    }
    setPhase('quiet');
    await sleep(600);
    meter.take();
    await sleep(3000);
    const noise = percentile(meter.take(), 0.5);

    setPhase('speak');
    const a = await mic.listen({ reference: TEST_SENTENCE, maxSeconds: 15, endSilenceMs: 1500, noSpeechMs: 8000 });
    const speech = percentile(meter.take(), 0.9);
    const recognized = a && a.engine !== 'typed' ? wordAccuracy(TEST_SENTENCE, a.text) : null;

    setPhase('echo');
    meter.take();
    await speak('This is the tutor speaking. If you are using speakers, your microphone may hear this sentence.');
    const echo = percentile(meter.take(), 0.9);

    const r: MicCheckResult = { at: Date.now(), ...micVerdict(noise, speech, echo - noise, recognized) };
    setResult(r);
    setPhase('done');
    app.update((u) => (u.micCheck = r));
    onDone?.(r);
  }

  const bar = Math.max(0, Math.min(100, ((meter.level + 70) / 70) * 100));
  return (
    <div className="stack">
      {phase === 'idle' || phase === 'done' || phase === 'error' ? (
        <button className="btn primary big" onClick={run} style={{ alignSelf: 'flex-start' }}>
          <Icon name="mic" /> {result ? 'Check again' : 'Start the check'}
        </button>
      ) : (
        <div className="soft stack">
          <b>
            {phase === 'quiet' && 'Stay quiet for 3 seconds…'}
            {phase === 'speak' && 'Now read this out loud:'}
            {phase === 'echo' && 'Listen: the tutor is speaking. Stay quiet.'}
          </b>
          {phase === 'speak' && <div className="prompt-text">{TEST_SENTENCE}</div>}
          {phase === 'speak' && mic.partial && <div className="partial">{mic.partial}</div>}
          <div className="bar" aria-label="Microphone level">
            <span style={{ width: `${bar}%`, background: meter.level > -6 ? 'var(--bad)' : meter.level > -45 ? 'var(--good)' : 'var(--faint)', transition: 'width 0.1s' }} />
          </div>
        </div>
      )}
      {error && <div className="banner error">{error}</div>}
      {result && phase !== 'quiet' && phase !== 'speak' && phase !== 'echo' && (
        <div className="stack fade-in">
          <div className={`banner ${result.ok && !result.issues.length ? 'info' : result.ok ? '' : 'error'}`}>
            {result.ok && !result.issues.length ? 'All good: your setup is ready for fair scores.' : result.ok ? 'Usable, with a few things to improve:' : 'Fix these before practising, or your scores will be unfair:'}
          </div>
          {result.issues.map((i) => (
            <div key={i.text} className="row small">
              <span className={`chip ${i.level === 'bad' ? 'bad' : 'ok'}`}>{i.level === 'bad' ? 'Fix' : 'Tip'}</span>
              <span>{i.text}</span>
            </div>
          ))}
          <div className="small faint">
            Background {result.noiseDb} dB · voice {result.speechDb} dB{result.echoRiseDb != null ? ` · echo +${Math.max(0, result.echoRiseDb)} dB` : ''}
            {result.recognized != null ? ` · recognised ${Math.round(result.recognized * 100)}%` : ''} · checked {new Date(result.at).toLocaleDateString()}
          </div>
        </div>
      )}
    </div>
  );
}

export function MicCheckPage() {
  return (
    <div className="stack">
      <h1>Microphone check</h1>
      <p className="muted">About 20 seconds. It measures background noise, how loud your voice is, whether your microphone hears the tutor through your speakers, and whether a test sentence is recognised.</p>
      <div className="card">
        <MicCheck />
      </div>
    </div>
  );
}
