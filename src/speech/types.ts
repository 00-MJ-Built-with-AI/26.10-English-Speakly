export type WordError = 'None' | 'Mispronunciation' | 'Omission' | 'Insertion' | 'UnexpectedBreak' | 'MissingBreak' | 'Monotone';

export interface PhonemeScore {
  phoneme: string;
  accuracy: number;
}

export interface WordScore {
  word: string;
  accuracy: number;
  error: WordError;
  phonemes: PhonemeScore[];
  offsetMs?: number;
  durationMs?: number;
}

/** One scored stretch of speech. */
export interface Assessment {
  engine: 'azure' | 'browser' | 'typed';
  /** What was recognised. */
  text: string;
  reference?: string;
  words: WordScore[];
  accuracy: number;
  fluency: number;
  completeness: number;
  prosody: number | null;
  /** Overall pronunciation score 0-100. */
  pron: number;
  /** From the start of listening to the first word. */
  startDelayMs: number;
  speechMs: number;
  wordsPerMinute: number;
  longPauses: number;
  audio?: Blob;
}

export interface ListenOptions {
  /** Text the learner should say (scripted scoring). Leave out for free speech. */
  reference?: string;
  maxSeconds: number;
  /** Stop after this much silence once speech has started. Ignored with manualStop. */
  endSilenceMs?: number;
  /** Give up if nothing is said for this long. */
  noSpeechMs?: number;
  /** Push-to-talk: only stop() ends listening. */
  manualStop?: boolean;
  record?: boolean;
  /** Recognition language (default en-US), e.g. ar-JO for Arabic. */
  language?: string;
  /** Score pronunciation (default true). Off for other languages. */
  assess?: boolean;
  onPartial?: (text: string) => void;
  onSpeechStart?: () => void;
}

export interface ListenHandle {
  result: Promise<Assessment>;
  /** Finish now and score what was said. */
  stop(): void;
  /** Throw away this attempt. */
  cancel(): void;
  /** Use typed text instead of the microphone (test mode / no mic). */
  submitTyped(text: string): void;
}

export interface SpeakOptions {
  rate?: number;
  voice?: string;
}

export interface SpeechEngine {
  readonly kind: 'azure' | 'browser';
  /** Can it hear the microphone at all? */
  readonly canListen: boolean;
  listen(opts: ListenOptions): ListenHandle;
  /** Speaks and resolves when finished (or stopped). */
  speak(text: string, opts?: SpeakOptions): Promise<void>;
  /** Prepare audio ahead of time so speak() starts instantly. */
  prefetch(text: string, opts?: SpeakOptions): void;
  /** The model voice as audio (for the intonation graph); null when the engine can't provide it. */
  modelAudio(text: string, opts?: SpeakOptions): Promise<Blob | null>;
  stopSpeaking(): void;
}

export class ListenCancelled extends Error {
  constructor() {
    super('cancelled');
  }
}
