/** Token usage of one or more Claude requests. */
export interface TokenUsage {
  model: string;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

/** US dollars per million tokens (Anthropic list prices). */
const PRICES: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  'claude-opus-5-5': { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
  'claude-sonnet-5-5': { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  'claude-haiku-5-5': { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 },
};

/** Estimated cost in dollars. Unknown models are priced like the default model. */
export function tokenCost(u: TokenUsage): number {
  const p = PRICES[u.model] ?? PRICES['claude-opus-5-5'];
  return (u.input * p.input + u.output * p.output + u.cacheRead * p.cacheRead + u.cacheWrite * p.cacheWrite) / 1_000_000;
}

/** Separates usage data from the tutor's streamed text. */
export const USAGE_MARK = '\u0000';
