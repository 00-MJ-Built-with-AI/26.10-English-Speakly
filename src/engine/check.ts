import type { GradeResult, TaskResult } from '../../shared/tasks.ts';
import type { FastPrompt } from '../content/units.ts';
import type { Level, Mistake, Skill, UnitPart } from '../lib/types.ts';
import type { Assessment } from '../speech/types.ts';
import { analyzeHesitation, type HesitationStats } from './hesitation.ts';
import type { PartResult } from './path.ts';
import { fluencyScore, PASS_MARK } from './scoring.ts';

/** One step of a speaking check (unit check or level test). */
export type CheckStep =
  | { part: 'pronunciation'; text: string }
  | { part: 'grammar'; prompt: FastPrompt; grammarFocus: string }
  | { part: 'task'; question: string; canDo: string[] };

export interface CheckResults {
  pron: Assessment[];
  grades: { a: Assessment; g: GradeResult }[];
  task: { a: Assessment; r: TaskResult } | null;
}

export interface CheckOutcome {
  parts: Partial<Record<UnitPart, PartResult>>;
  mistakes: Pick<Mistake, 'kind' | 'said' | 'better' | 'why'>[];
  scores: Partial<Record<Skill, number>>;
  hesitation?: HesitationStats;
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** Pass/fail per part plus mistakes and skill scores, from what was said in a check. */
export function evaluateCheck(level: Level, parts: UnitPart[], r: CheckResults): CheckOutcome {
  const mark = PASS_MARK[level];
  const out: CheckOutcome = { parts: {}, mistakes: [], scores: {} };
  const grammar: number[] = [];
  if (parts.includes('pronunciation') && r.pron.length) {
    const real = r.pron.filter((a) => a.engine !== 'typed');
    const score = avg(r.pron.map((a) => a.pron));
    out.parts.pronunciation = { passed: real.length > 0 && score >= mark.pron, score };
    if (real.length) out.scores.pronunciation = avg(real.map((a) => a.pron));
    for (const a of real)
      for (const w of a.words)
        if (w.error !== 'Omission' && w.accuracy < 60) out.mistakes.push({ kind: 'pronunciation', said: w.word, better: w.word, why: `Pronunciation ${Math.round(w.accuracy)}/100` });
  }
  if (parts.includes('grammar') && r.grades.length) {
    const correct = r.grades.filter((x) => x.g.correct).length;
    const real = r.grades.filter((x) => x.a.engine !== 'typed');
    const delay = avg(real.map((x) => x.a.startDelayMs)) / 1000;
    const quick = !real.length || delay <= mark.startSeconds;
    const need = Math.ceil((r.grades.length * 2) / 3);
    out.parts.grammar = { passed: correct >= need && quick, score: (correct / r.grades.length) * 100 };
    grammar.push(...r.grades.map((x) => x.g.grammarScore));
    for (const x of r.grades) if (!x.g.correct && x.a.text) out.mistakes.push({ kind: 'grammar', said: x.a.text, better: x.g.corrected, why: x.g.feedback });
  }
  if (parts.includes('task') && r.task) {
    const { a, r: t } = r.task;
    const typed = a.engine === 'typed';
    const fluency = typed ? undefined : fluencyScore(a, true);
    grammar.push(t.grammarScore);
    out.scores.vocabulary = t.vocabularyScore;
    if (fluency != null) out.scores.fluency = fluency;
    const score = avg([t.grammarScore, t.vocabularyScore, t.coherenceScore, ...(fluency != null ? [fluency] : [])]);
    out.parts.task = { passed: t.achieved && (typed || (fluency ?? 0) >= mark.fluency), score };
    for (const c of t.corrections) out.mistakes.push({ kind: c.kind, said: c.original, better: c.corrected, why: c.explanation });
    if (!typed) out.hesitation = analyzeHesitation(a);
  }
  if (grammar.length) out.scores.grammar = avg(grammar);
  return out;
}

export function checkPassed(o: CheckOutcome): boolean {
  const ps = Object.values(o.parts);
  return ps.length > 0 && ps.every((p) => p.passed);
}
