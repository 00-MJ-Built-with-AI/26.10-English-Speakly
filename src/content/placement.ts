import type { CheckStep } from '../engine/check.ts';
import type { Level } from '../lib/types.ts';
import { unitsByLevel } from './units.ts';

function shuffled<T>(xs: T[], rand: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * One level block of the fast-track test: 2 sentences to read, 3 quick grammar prompts from
 * different units, and 1 open question. About two and a half minutes.
 */
export function levelSteps(level: Level, rand: () => number = Math.random): CheckStep[] {
  const units = shuffled(unitsByLevel(level), rand);
  const pick = (k: number) => units[k % units.length];
  const longest = (k: number) => [...pick(k).shadow].sort((a, b) => b.length - a.length)[0];
  const steps: CheckStep[] = [
    { part: 'pronunciation', text: longest(0) },
    { part: 'pronunciation', text: longest(1) },
  ];
  for (let k = 0; k < 3; k++) {
    const u = pick(k + 2);
    steps.push({ part: 'grammar', prompt: u.fast[Math.floor(rand() * u.fast.length)], grammarFocus: u.grammar.name });
  }
  const t = pick(5);
  steps.push({ part: 'task', question: t.question, canDo: units.flatMap((u) => u.canDo).slice(0, 6) });
  return steps;
}
