import { serverStatus } from '../lib/api.ts';
import { AzureEngine } from './azure.ts';
import { BrowserEngine } from './browser.ts';
import type { SpeakOptions, SpeechEngine } from './types.ts';

export * from './types.ts';

let engine: Promise<SpeechEngine> | undefined;

/** Azure when the server has a key, otherwise the browser's own speech (test mode). */
export function getEngine(): Promise<SpeechEngine> {
  engine ??= serverStatus().then((s) => (s.speech ? new AzureEngine() : new BrowserEngine()));
  return engine;
}

/** Speaks the tutor reply as it streams in. */
export class SpeakQueue {
  private queue: string[] = [];
  private running?: Promise<void>;
  private stopped = false;

  constructor(
    private engine: SpeechEngine,
    private opts: SpeakOptions,
  ) {}

  push(sentence: string): void {
    if (this.stopped || !sentence.trim()) return;
    this.queue.push(sentence);
    this.running ??= this.run();
  }

  /**
   * The first sentence starts right away; everything that arrives while it plays is spoken as one
   * stretch, so the voice keeps a natural flow instead of restarting its melody every sentence.
   */
  private async run(): Promise<void> {
    while (this.queue.length && !this.stopped) {
      const chunk = this.queue.splice(0).join(' ');
      await this.engine.speak(chunk, this.opts);
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
