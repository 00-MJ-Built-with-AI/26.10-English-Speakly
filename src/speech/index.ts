import { serverStatus } from '../lib/api.ts';
import { AzureEngine } from './azure.ts';
import { BrowserEngine } from './browser.ts';
import type { SpeechEngine } from './types.ts';

export * from './types.ts';

let engine: Promise<SpeechEngine> | undefined;

/** Azure when the server has a key, otherwise the browser's own speech (test mode). */
export function getEngine(): Promise<SpeechEngine> {
  engine ??= serverStatus().then((s) => (s.speech ? new AzureEngine() : new BrowserEngine()));
  return engine;
}

/** Sentence-by-sentence speaking: synthesises ahead so the tutor sounds continuous. */
export class SpeakQueue {
  private queue: string[] = [];
  private running?: Promise<void>;
  private stopped = false;

  constructor(
    private engine: SpeechEngine,
    private opts: { voice?: string; rate?: number },
  ) {}

  push(sentence: string): void {
    if (this.stopped || !sentence.trim()) return;
    this.queue.push(sentence);
    this.engine.prefetch(sentence, this.opts);
    this.running ??= this.run();
  }

  private async run(): Promise<void> {
    while (this.queue.length && !this.stopped) {
      await this.engine.speak(this.queue.shift()!, this.opts);
    }
    this.running = undefined;
  }

  /** Resolves when everything pushed so far has been spoken. */
  async drain(): Promise<void> {
    while (this.running) await this.running;
  }

  stop(): void {
    this.stopped = true;
    this.queue = [];
    this.engine.stopSpeaking();
  }
}
