import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '../../lib/store.tsx';
import { ListenCancelled, type Assessment, type ListenHandle, type ListenOptions, type WordScore } from '../../speech/index.ts';
import { typedAssessment } from '../../speech/score.ts';
import { Icon } from './Icon.tsx';

export type ListenState = 'idle' | 'listening' | 'scoring';

/** Runs one listening attempt at a time and exposes its live state. */
export function useListen() {
  const { engine } = useApp();
  const [state, setState] = useState<ListenState>('idle');
  const [partial, setPartial] = useState('');
  const [error, setError] = useState<string | null>(null);
  /** The microphone failed once; from now on answers are typed. */
  const [micFailed, setMicFailed] = useState(false);
  const failed = useRef(false);
  const handle = useRef<ListenHandle | null>(null);

  useEffect(() => () => handle.current?.cancel(), []);

  const listen = useCallback(
    async (opts: ListenOptions): Promise<Assessment | null> => {
      handle.current?.cancel();
      setError(null);
      setPartial('');
      setState('listening');
      const start = (): ListenHandle =>
        failed.current
          ? typedOnly(opts.reference)
          : engine.listen({
              ...opts,
              onPartial: (t) => {
                setPartial(t);
                opts.onPartial?.(t);
              },
            });
      let h = start();
      handle.current = h;
      try {
        try {
          return await h.result;
        } catch (e) {
          if (e instanceof ListenCancelled || failed.current || !isMicError(e)) throw e;
          // No microphone here: keep the attempt open and take a typed answer instead.
          failed.current = true;
          setMicFailed(true);
          setError('The microphone is not available here, so type your answer instead.');
          h = start();
          handle.current = h;
          return await h.result;
        }
      } catch (e) {
        if (!(e instanceof ListenCancelled)) setError(micError(e));
        return null;
      } finally {
        if (handle.current === h) {
          handle.current = null;
          setState('idle');
        }
      }
    },
    [engine],
  );

  const stop = useCallback(() => {
    if (handle.current) {
      setState('scoring');
      handle.current.stop();
    }
  }, []);
  const cancel = useCallback(() => handle.current?.cancel(), []);
  const submitTyped = useCallback((text: string) => handle.current?.submitTyped(text), []);

  return { state, partial, error, listen, stop, cancel, submitTyped, canListen: engine.canListen && !micFailed, micFailed };
}

function isMicError(e: unknown): boolean {
  return /NotAllowed|Permission|NotFound|not-allowed|audio-capture|NotReadable/i.test(e instanceof Error ? `${e.name} ${e.message}` : String(e));
}

/** A listening attempt that only accepts typed text. */
function typedOnly(reference?: string): ListenHandle {
  let done: (a: Assessment) => void = () => {};
  let fail: (e: Error) => void = () => {};
  const result = new Promise<Assessment>((resolve, reject) => {
    done = resolve;
    fail = reject;
  });
  return {
    result,
    stop: () => fail(new ListenCancelled()),
    cancel: () => fail(new ListenCancelled()),
    submitTyped: (text) => done(typedAssessment(text, reference)),
  };
}

function micError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/NotAllowed|Permission/i.test(msg)) return 'Microphone access was blocked. Allow the microphone in your browser settings and try again.';
  if (/NotFound/i.test(msg)) return 'No microphone was found.';
  return msg;
}

/** Speak text with the learner's chosen voice and speed. */
export function useSpeak() {
  const { engine, user } = useApp();
  const [speaking, setSpeaking] = useState(false);
  const speak = useCallback(
    async (text: string, rate?: number) => {
      setSpeaking(true);
      try {
        await engine.speak(text, { voice: user.settings.voice, browserVoice: user.settings.browserVoice, rate: rate ?? user.settings.speechRate });
      } catch (e) {
        console.error(e);
      } finally {
        setSpeaking(false);
      }
    },
    [engine, user.settings.voice, user.settings.browserVoice, user.settings.speechRate],
  );
  const prefetch = useCallback(
    (text: string, rate?: number) => engine.prefetch(text, { voice: user.settings.voice, browserVoice: user.settings.browserVoice, rate: rate ?? user.settings.speechRate }),
    [engine, user.settings.voice, user.settings.browserVoice, user.settings.speechRate],
  );
  const stop = useCallback(() => {
    engine.stopSpeaking();
    setSpeaking(false);
  }, [engine]);
  return { speak, prefetch, stop, speaking };
}

/** Big round microphone button with live text, plus a type-instead fallback when there's no mic. */
export function MicControl({
  state,
  partial,
  error,
  onStart,
  onStop,
  onTyped,
  canListen,
  hint,
  disabled,
}: {
  state: ListenState;
  partial: string;
  error: string | null;
  onStart: () => void;
  onStop: () => void;
  onTyped: (text: string) => void;
  canListen: boolean;
  hint?: string;
  disabled?: boolean;
}) {
  const [typed, setTyped] = useState('');
  const [showType, setShowType] = useState(!canListen);
  const live = state === 'listening';
  return (
    <div className="stack" style={{ textAlign: 'center' }}>
      <div className="row" style={{ justifyContent: 'center' }}>
        <button
          className={`mic ${live ? 'live' : ''}`}
          onClick={live ? onStop : onStart}
          disabled={disabled || state === 'scoring'}
          aria-label={live ? 'Stop' : 'Start speaking'}
        >
          <Icon name={live ? 'stop' : 'mic'} size={34} />
        </button>
      </div>
      <div className="small muted">
        {state === 'scoring' ? 'Scoring…' : live ? 'Listening… tap to finish' : (hint ?? 'Tap the microphone and speak')}
      </div>
      {live && <div className="partial">{partial || '…'}</div>}
      {error && <div className="banner error">{error}</div>}
      {(showType || !canListen) && live && (
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            if (typed.trim()) onTyped(typed.trim());
            setTyped('');
          }}
        >
          <input type="text" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Type what you would say" autoFocus />
          <button className="btn small" type="submit">
            Send
          </button>
        </form>
      )}
      {canListen && !showType && live && (
        <button className="btn ghost small" onClick={() => setShowType(true)}>
          No microphone? Type instead
        </button>
      )}
    </div>
  );
}

function wordClass(w: WordScore): string {
  if (w.error === 'Omission') return 'missing';
  if (w.error === 'Insertion') return 'faint';
  if (w.accuracy >= 80) return 'good';
  if (w.accuracy >= 60) return 'ok';
  return 'bad';
}

/** The sentence coloured word by word; tap a word to see its sounds and hear it. */
export function WordScores({ a }: { a: Assessment }) {
  const [sel, setSel] = useState<number | null>(null);
  const { speak } = useSpeak();
  const w = sel != null ? a.words[sel] : null;
  return (
    <div className="stack">
      <div className="words">
        {a.words.map((x, i) => (
          <button key={i} className={`word ${wordClass(x)} ${sel === i ? 'sel' : ''}`} onClick={() => setSel(sel === i ? null : i)} title={`${Math.round(x.accuracy)}`}>
            {x.word}
          </button>
        ))}
      </div>
      {w && (
        <div className="soft fade-in">
          <div className="spread">
            <div>
              <b>{w.word}</b>{' '}
              <span className="muted small">
                {w.error === 'Omission' ? 'skipped' : `${Math.round(w.accuracy)}/100${w.error !== 'None' ? ` · ${w.error}` : ''}`}
              </span>
            </div>
            <button className="btn small" onClick={() => speak(w.word, 0.8)}>
              <Icon name="volume" size={16} /> Hear it
            </button>
          </div>
          {w.phonemes.length > 0 && (
            <div className="phonemes" style={{ marginTop: 8 }}>
              {w.phonemes.map((p, i) => (
                <span key={i} className="phoneme" style={{ color: p.accuracy >= 80 ? 'var(--good)' : p.accuracy >= 60 ? 'var(--ok)' : 'var(--bad)' }}>
                  <b>/{p.phoneme}/</b>
                  <span className="small">{Math.round(p.accuracy)}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Play a recorded blob. */
export function PlayBlob({ blob, label = 'My voice' }: { blob?: Blob; label?: string }) {
  const [url, setUrl] = useState<string>();
  const audio = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    if (!blob) return;
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  if (!url) return null;
  return (
    <>
      <button
        className="btn small"
        onClick={() => {
          audio.current ??= new Audio();
          audio.current.src = url;
          audio.current.play().catch(() => {});
        }}
      >
        <Icon name="play" size={14} /> {label}
      </button>
    </>
  );
}

/** Score summary chips under an attempt. */
export function ScoreChips({ a, showFluency = true }: { a: Assessment; showFluency?: boolean }) {
  if (a.engine === 'typed') return <div className="small muted">Typed answer: no pronunciation score.</div>;
  const chip = (label: string, v: number | null) =>
    v == null ? null : (
      <span className={`chip ${v >= 80 ? 'good' : v >= 60 ? 'ok' : 'bad'}`}>
        {label} {Math.round(v)}
      </span>
    );
  return (
    <div className="row">
      {chip('Overall', a.pron)}
      {chip('Accuracy', a.accuracy)}
      {showFluency && chip('Fluency', a.fluency)}
      {a.reference && chip('Completeness', a.completeness)}
      {chip('Rhythm', a.prosody)}
      {a.engine === 'browser' && <span className="chip">estimate</span>}
    </div>
  );
}

/** Seconds since the component mounted, for practice time. */
export function useElapsed() {
  const start = useRef(Date.now());
  return useCallback(() => Math.round((Date.now() - start.current) / 1000), []);
}
