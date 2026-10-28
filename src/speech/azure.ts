import type * as SDK from 'microsoft-cognitiveservices-speech-sdk';
import { speechToken } from '../lib/api.ts';
import { micStream, VoiceRecorder } from './mic.ts';
import { combine, typedAssessment, type Segment } from './score.ts';
import { DEFAULT_VOICE, isHdVoice, standardVoiceFor } from './voices.ts';
import { phoneLine } from './fx.ts';
import { capReached, recordListening, recordVoice } from '../lib/usage.ts';
import { BrowserEngine } from './browser.ts';
import {
  ListenCancelled,
  type Assessment,
  type ListenHandle,
  type ListenOptions,
  type SpeakOptions,
  type SpeechEngine,
  type WordError,
  type WordScore,
} from './types.ts';

let sdkPromise: Promise<typeof SDK> | undefined;
const loadSdk = () => (sdkPromise ??= import('microsoft-cognitiveservices-speech-sdk'));

let tokenCache: { token: string; region: string; expiresAt: number } | undefined;
async function token() {
  if (!tokenCache || tokenCache.expiresAt - Date.now() < 60_000) tokenCache = await speechToken();
  return tokenCache;
}

async function speechConfig(sdk: typeof SDK) {
  const t = await token();
  const cfg = sdk.SpeechConfig.fromAuthorizationToken(t.token, t.region);
  cfg.speechRecognitionLanguage = 'en-US';
  cfg.outputFormat = sdk.OutputFormat.Detailed;
  return cfg;
}

const TICKS_PER_MS = 10_000;

interface AzureWord {
  Word: string;
  Offset?: number;
  Duration?: number;
  PronunciationAssessment?: { AccuracyScore?: number; ErrorType?: string };
  Phonemes?: { Phoneme: string; PronunciationAssessment?: { AccuracyScore?: number } }[];
}

function parseSegment(sdk: typeof SDK, result: SDK.SpeechRecognitionResult): Segment | null {
  const raw = result.properties.getProperty(sdk.PropertyId.SpeechServiceResponse_JsonResult);
  if (!raw) return null;
  const json = JSON.parse(raw) as {
    DisplayText?: string;
    Duration?: number;
    NBest?: {
      Display?: string;
      PronunciationAssessment?: { AccuracyScore?: number; FluencyScore?: number; ProsodyScore?: number };
      Words?: AzureWord[];
    }[];
  };
  const best = json.NBest?.[0];
  if (!best) return null;
  const words: WordScore[] = (best.Words ?? []).map((w) => ({
    word: w.Word,
    accuracy: w.PronunciationAssessment?.AccuracyScore ?? 0,
    error: (w.PronunciationAssessment?.ErrorType ?? 'None') as WordError,
    phonemes: (w.Phonemes ?? []).map((p) => ({ phoneme: p.Phoneme, accuracy: p.PronunciationAssessment?.AccuracyScore ?? 0 })),
    offsetMs: w.Offset != null ? w.Offset / TICKS_PER_MS : undefined,
    durationMs: w.Duration != null ? w.Duration / TICKS_PER_MS : undefined,
  }));
  return {
    text: best.Display ?? json.DisplayText ?? result.text,
    words,
    accuracy: best.PronunciationAssessment?.AccuracyScore,
    fluency: best.PronunciationAssessment?.FluencyScore,
    prosody: best.PronunciationAssessment?.ProsodyScore,
    durationMs: (json.Duration ?? 0) / TICKS_PER_MS,
  };
}

/** Real scoring through Azure AI Speech: per-word and per-sound accuracy, fluency, prosody. */
export class AzureEngine implements SpeechEngine {
  readonly kind = 'azure';
  readonly canListen = true;
  private audio = new Audio();
  private cache = new Map<string, Promise<string>>();
  private finishSpeaking?: () => void;

  /** Free browser speech, used once today's spending limit is reached. */
  private free = new BrowserEngine();

  listen(opts: ListenOptions): ListenHandle {
    if (capReached()) return this.free.listen(opts);
    let stopFn: () => void = () => {};
    let cancelled = false;
    let typed: string | undefined;
    let settle: (() => void) | undefined;
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
        settle?.();
      },
    };

    handle.result = (async (): Promise<Assessment> => {
      const sdk = await loadSdk();
      const [cfg, stream] = await Promise.all([speechConfig(sdk), micStream()]);
      if (typed != null) return typedAssessment(typed, opts.reference);
      cfg.setProperty(sdk.PropertyId.Speech_SegmentationSilenceTimeoutMs, opts.reference ? '700' : '900');
      if (opts.language) cfg.speechRecognitionLanguage = opts.language;
      const assess = opts.assess !== false && (!opts.language || opts.language.startsWith('en'));
      if (!assess) cfg.requestWordLevelTimestamps();
      const input = stream.clone();
      const recognizer = new sdk.SpeechRecognizer(cfg, sdk.AudioConfig.fromStreamInput(input));
      if (assess) {
        const pa = new sdk.PronunciationAssessmentConfig(
          opts.reference ?? '',
          sdk.PronunciationAssessmentGradingSystem.HundredMark,
          sdk.PronunciationAssessmentGranularity.Phoneme,
          Boolean(opts.reference),
        );
        pa.enableProsodyAssessment = true;
        pa.phonemeAlphabet = 'IPA';
        pa.applyTo(recognizer);
      }

      const recorder = new VoiceRecorder();
      if (opts.record) recorder.start(stream);
      const segments: Segment[] = [];
      const startedAt = performance.now();
      let firstSpeechAt: number | undefined;
      let lastSpeechAt = startedAt;
      let finished = false;
      let partialBase = '';

      await new Promise<void>((resolve, reject) => {
        settle = resolve;
        let timer: ReturnType<typeof setInterval> | undefined;
        const finish = () => {
          if (finished) return;
          finished = true;
          if (timer) clearInterval(timer);
          recognizer.stopContinuousRecognitionAsync(
            () => resolve(),
            () => resolve(),
          );
        };
        stopFn = finish;
        recognizer.recognizing = (_s, e) => {
          lastSpeechAt = performance.now();
          if (firstSpeechAt == null) {
            firstSpeechAt = lastSpeechAt;
            opts.onSpeechStart?.();
          }
          opts.onPartial?.((partialBase + ' ' + e.result.text).trim());
        };
        recognizer.recognized = (_s, e) => {
          if (e.result.reason !== sdk.ResultReason.RecognizedSpeech) return;
          lastSpeechAt = performance.now();
          const seg = parseSegment(sdk, e.result);
          if (seg && (seg.words.length || seg.text)) {
            segments.push(seg);
            partialBase = segments.map((s) => s.text).join(' ');
            opts.onPartial?.(partialBase);
          }
        };
        recognizer.canceled = (_s, e) => {
          if (e.reason === sdk.CancellationReason.Error) {
            finished = true;
            if (timer) clearInterval(timer);
            reject(new Error(e.errorDetails || 'Speech service error'));
          } else finish();
        };
        recognizer.startContinuousRecognitionAsync(
          () => {
            timer = setInterval(() => {
              const now = performance.now();
              if (now - startedAt > opts.maxSeconds * 1000) return finish();
              if (opts.manualStop) return;
              if (firstSpeechAt == null) {
                if (now - startedAt > (opts.noSpeechMs ?? 10_000)) finish();
              } else if (opts.endSilenceMs && now - lastSpeechAt > opts.endSilenceMs) finish();
            }, 100);
          },
          (err) => reject(new Error(err)),
        );
      }).finally(() => {
        recordListening((performance.now() - startedAt) / 1000);
        recognizer.close();
        input.getTracks().forEach((t) => t.stop());
      });

      const audio = opts.record ? await recorder.stop() : undefined;
      if (cancelled) throw new ListenCancelled();
      if (typed != null) return typedAssessment(typed, opts.reference);
      const delay = firstSpeechAt != null ? firstSpeechAt - startedAt : undefined;
      return { ...combine('azure', segments, opts.reference, delay), audio };
    })();
    return handle;
  }

  /** Set when this Azure resource can't use HD voices (region or tier); then standard voices are used. */
  private noHd = false;

  private voiceId(opts: SpeakOptions): string {
    const v = opts.voice ?? DEFAULT_VOICE;
    return this.noHd ? standardVoiceFor(v) : v;
  }

  private ssml(text: string, voice: string, rate: number): string {
    const esc = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    // HD voices don't accept <prosody>; their speed is changed at playback instead.
    if (isHdVoice(voice)) return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US"><voice name="${voice}" parameters="temperature=0.8">${esc}</voice></speak>`;
    const pct = Math.round((rate - 1) * 100);
    return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US"><voice name="${voice}"><prosody rate="${pct >= 0 ? '+' : ''}${pct}%">${esc}</prosody></voice></speak>`;
  }

  private synth(text: string, opts: SpeakOptions): Promise<string> {
    const voice = this.voiceId(opts);
    const rate = isHdVoice(voice) ? 1 : (opts.rate ?? 1);
    const key = `${voice}|${rate}|${text}`;
    let hit = this.cache.get(key);
    if (!hit) {
      hit = (async () => {
        const sdk = await loadSdk();
        const cfg = await speechConfig(sdk);
        cfg.speechSynthesisOutputFormat = sdk.SpeechSynthesisOutputFormat.Audio24Khz48KBitRateMonoMp3;
        recordVoice(text.length, isHdVoice(voice));
        const synth = new sdk.SpeechSynthesizer(cfg, null as unknown as SDK.AudioConfig);
        const data = await new Promise<ArrayBuffer>((resolve, reject) =>
          synth.speakSsmlAsync(
            this.ssml(text, voice, rate),
            (r) => {
              synth.close();
              if (r.reason === sdk.ResultReason.SynthesizingAudioCompleted) resolve(r.audioData);
              else reject(new Error(r.errorDetails || 'Voice failed'));
            },
            (e) => {
              synth.close();
              reject(new Error(e));
            },
          ),
        );
        return URL.createObjectURL(new Blob([data], { type: 'audio/mpeg' }));
      })();
      hit = hit.catch((err) => {
        this.cache.delete(key);
        if (!isHdVoice(voice)) throw err;
        console.warn('HD voice unavailable on this Azure resource; using the standard voice.', err);
        this.noHd = true;
        return this.synth(text, opts);
      });
      this.cache.set(key, hit);
      if (this.cache.size > 200) this.cache.delete(this.cache.keys().next().value!);
    }
    return hit;
  }

  async modelAudio(text: string, opts: SpeakOptions = {}): Promise<Blob | null> {
    if (capReached()) return null;
    return (await fetch(await this.synth(text, opts))).blob();
  }

  prefetch(text: string, opts: SpeakOptions = {}): void {
    if (capReached()) return;
    this.synth(text, opts).catch(() => {});
  }

  async speak(text: string, opts: SpeakOptions = {}): Promise<void> {
    this.stopSpeaking();
    if (capReached()) return this.free.speak(text, opts);
    const url = await this.synth(text, opts);
    await new Promise<void>((resolve) => {
      this.finishSpeaking = resolve;
      this.audio.src = url;
      this.audio.playbackRate = isHdVoice(this.voiceId(opts)) ? (opts.rate ?? 1) : 1;
      this.audio.preservesPitch = true;
      phoneLine(this.audio, Boolean(opts.phone));
      this.audio.onended = () => resolve();
      this.audio.onerror = () => resolve();
      this.audio.play().catch(() => resolve());
    });
    this.finishSpeaking = undefined;
  }

  stopSpeaking(): void {
    this.free.stopSpeaking();
    this.audio.pause();
    this.finishSpeaking?.();
    this.finishSpeaking = undefined;
  }
}
