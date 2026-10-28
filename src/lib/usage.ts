import { tokenCost, type TokenUsage } from '../../shared/pricing.ts';
import type { Settings, UsageDay } from './types.ts';

/**
 * Estimated spending. Speech engines and the API client report usage here; the store saves it
 * and tells this module the daily limit, so paid services can stop once it is reached.
 */
type Listener = (delta: Partial<UsageDay>) => void;

let listener: Listener | undefined;
let rates: Settings['rates'] = { sttPerHour: 1, ttsPerMillion: 15, hdTtsPerMillion: 30 };
let capCheck: () => boolean = () => false;

export class CapReachedError extends Error {
  constructor() {
    super("Today's spending limit is reached, so the AI tutor is paused until tomorrow. Free drills still work, and you can change the limit in Settings.");
  }
}

export function connectUsage(l: Listener, r: Settings['rates'], reached: () => boolean): void {
  listener = l;
  rates = r;
  capCheck = reached;
}

export function capReached(): boolean {
  return capCheck();
}

export function recordAi(u: TokenUsage): void {
  listener?.({ ai: tokenCost(u), aiCalls: 1 });
}

export function recordListening(seconds: number): void {
  if (seconds > 0) listener?.({ sttSec: seconds, speech: (seconds / 3600) * rates.sttPerHour });
}

export function recordVoice(chars: number, hd: boolean): void {
  if (chars > 0) listener?.({ ttsChars: chars, speech: (chars / 1_000_000) * (hd ? rates.hdTtsPerMillion : rates.ttsPerMillion) });
}

export function dayTotal(d: UsageDay | undefined): number {
  return d ? d.ai + d.speech : 0;
}

export function addUsage(d: UsageDay | undefined, delta: Partial<UsageDay>): UsageDay {
  const base = d ?? { ai: 0, speech: 0, aiCalls: 0, sttSec: 0, ttsChars: 0 };
  return {
    ai: base.ai + (delta.ai ?? 0),
    speech: base.speech + (delta.speech ?? 0),
    aiCalls: base.aiCalls + (delta.aiCalls ?? 0),
    sttSec: base.sttSec + (delta.sttSec ?? 0),
    ttsChars: base.ttsChars + (delta.ttsChars ?? 0),
  };
}
