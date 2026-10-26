import { words as toWords } from '../engine/text.ts';
import { micStream, VoiceRecorder } from './mic.ts';
import { combine, typedAssessment } from './score.ts';
import { ListenCancelled, type Assessment, type ListenHandle, type ListenOptions, type SpeakOptions, type SpeechEngine, type WordScore } from './types.ts';

interface Rec {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string; confidence: number }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

const RecognitionCtor = (): (new () => Rec) | undefined =>
  (globalThis as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec }).SpeechRecognition ??
  (globalThis as unknown as { webkitSpeechRecognition?: new () => Rec }).webkitSpeechRecognition;

/**
 * Test-mode engine: the browser's own speech recognition and voices. It checks the words, not
 * the sounds, so pronunciation scores are rough estimates until Azure is connected.
 */
export class BrowserEngine implements SpeechEngine {
  readonly kind = 'browser';
  readonly canListen = Boolean(RecognitionCtor());
  private finishSpeaking?: () => void;

  listen(opts: ListenOptions): ListenHandle {
    let stopFn: () => void = () => {};
    let cancelled = false;
    let typed: string | undefined;
    let wake: (() => void) | undefined;
    const handle: ListenHandle = {
      result: null as never,
      stop: () => stopFn(),
      cancel: () => {
        cancelled = true;
        stopFn();
      },
      submitTyped: (text) => {
        typed = text;
        stopFn();
        wake?.();
      },
    };
    handle.result = (async (): Promise<Assessment> => {
      const Ctor = RecognitionCtor();
      if (!Ctor) {
        // No recognition at all: wait for typed text.
        await new Promise<void>((resolve) => {
          wake = resolve;
          stopFn = resolve;
        });
        if (cancelled) throw new ListenCancelled();
        return typedAssessment(typed ?? '', opts.reference);
      }
      const recorder = new VoiceRecorder();
      if (opts.record) {
        try {
          recorder.start(await micStream());
        } catch {
          /* recording is optional */
        }
      }
      const rec = new Ctor();
      rec.lang = opts.language ?? 'en-US';
      rec.continuous = true;
      rec.interimResults = true;
      const startedAt = performance.now();
      let firstAt: number | undefined;
      let lastAt = startedAt;
      const finals: { text: string; confidence: number; at: number }[] = [];
      let finished = false;
      let fatal: string | undefined;
      await new Promise<void>((resolve) => {
        wake = resolve;
        let timer: ReturnType<typeof setInterval> | undefined;
        const finish = () => {
          if (finished) return;
          finished = true;
          if (timer) clearInterval(timer);
          try {
            rec.stop();
          } catch {
            resolve();
          }
          setTimeout(resolve, 800);
        };
        stopFn = finish;
        rec.onresult = (e) => {
          lastAt = performance.now();
          if (firstAt == null) {
            firstAt = lastAt;
            opts.onSpeechStart?.();
          }
          let interim = '';
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const r = e.results[i];
            if (r.isFinal) finals.push({ text: r[0].transcript, confidence: r[0].confidence, at: lastAt });
            else interim += r[0].transcript;
          }
          opts.onPartial?.((finals.map((f) => f.text).join(' ') + ' ' + interim).trim());
        };
        rec.onerror = (e) => {
          if (['not-allowed', 'service-not-allowed', 'audio-capture'].includes(e.error)) fatal = e.error;
          finish();
        };
        rec.onend = () => {
          if (timer) clearInterval(timer);
          resolve();
        };
        rec.start();
        timer = setInterval(() => {
          const now = performance.now();
          if (now - startedAt > opts.maxSeconds * 1000) return finish();
          if (opts.manualStop) return;
          if (firstAt == null) {
            if (now - startedAt > (opts.noSpeechMs ?? 10_000)) finish();
          } else if (opts.endSilenceMs && now - lastAt > opts.endSilenceMs) finish();
        }, 100);
      });
      const audio = opts.record ? await recorder.stop() : undefined;
      if (cancelled) throw new ListenCancelled();
      if (typed != null) return typedAssessment(typed, opts.reference);
      if (fatal && !finals.length) throw new Error(`NotAllowedError: ${fatal}`);
      const text = finals.map((f) => f.text).join(' ').trim();
      const conf = finals.length ? finals.reduce((a, f) => a + (f.confidence || 0.8), 0) / finals.length : 0;
      const ws = toWords(text);
      const span = Math.max(1, lastAt - (firstAt ?? lastAt));
      const wordScores: WordScore[] = ws.map((w, i) => ({
        word: w,
        accuracy: Math.round(60 + conf * 35),
        error: 'None',
        phonemes: [],
        offsetMs: (firstAt ?? startedAt) - startedAt + (span * i) / ws.length,
        durationMs: (span / ws.length) * 0.8,
      }));
      const a = combine('browser', [{ text, words: wordScores, durationMs: span }], opts.reference, firstAt != null ? firstAt - startedAt : 0);
      return { ...a, audio };
    })();
    return handle;
  }

  private voiceFor(): SpeechSynthesisVoice | undefined {
    const vs = speechSynthesis.getVoices().filter((v) => v.lang === 'en-US');
    return vs.find((v) => /natural|online|google/i.test(v.name)) ?? vs[0];
  }

  prefetch(): void {}

  async modelAudio(): Promise<Blob | null> {
    return null; // the browser's own voices can't be recorded
  }

  speak(text: string, opts: SpeakOptions = {}): Promise<void> {
    this.stopSpeaking();
    if (typeof speechSynthesis === 'undefined') return Promise.resolve();
    return new Promise((resolve) => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US';
      u.rate = opts.rate ?? 1;
      const v = this.voiceFor();
      if (v) u.voice = v;
      this.finishSpeaking = resolve;
      u.onend = () => resolve();
      u.onerror = () => resolve();
      speechSynthesis.speak(u);
      // Some browsers never fire onend for long text; don't hang the app.
      setTimeout(resolve, 2000 + text.length * 120);
    });
  }

  stopSpeaking(): void {
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
    this.finishSpeaking?.();
    this.finishSpeaking = undefined;
  }
}
