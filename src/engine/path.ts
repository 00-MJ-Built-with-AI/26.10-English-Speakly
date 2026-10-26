import { UNITS, type Unit } from '../content/units.ts';
import { UNIT_PARTS, type Level, type UnitPart, type UnitState, type UserDoc } from '../lib/types.ts';

function fresh(open: boolean): UnitState {
  return {
    status: open ? 'open' : 'locked',
    checked: false,
    parts: {
      pronunciation: { passed: false, best: 0, practiced: false },
      grammar: { passed: false, best: 0, practiced: false },
      task: { passed: false, best: 0, practiced: false },
    },
  };
}

export function unitState(user: UserDoc, id: string): UnitState {
  const s = user.units[id];
  if (s) return s;
  return fresh(UNITS[0].id === id);
}

export function ensureUnit(user: UserDoc, id: string): UnitState {
  user.units[id] ??= unitState(user, id);
  return user.units[id];
}

/** The unit to work on now: the first one that is not done. */
export function currentUnit(user: UserDoc): Unit | undefined {
  return UNITS.find((u) => unitState(user, u.id).status !== 'done');
}

export function nextUnit(id: string): Unit | undefined {
  const i = UNITS.findIndex((u) => u.id === id);
  return i >= 0 ? UNITS[i + 1] : undefined;
}

function finish(user: UserDoc, id: string, viaTestOut: boolean): void {
  const s = ensureUnit(user, id);
  if (s.status === 'done') return;
  s.status = 'done';
  s.doneAt = Date.now();
  s.viaTestOut = viaTestOut;
  const next = nextUnit(id);
  if (next) {
    const n = ensureUnit(user, next.id);
    if (n.status === 'locked') n.status = 'open';
  }
}

export interface PartResult {
  passed: boolean;
  score: number;
}

/**
 * Applies a unit check. Parts passed now stay passed; the unit is done when all three are.
 * Returns the parts that still need lessons.
 */
export function recordCheck(user: UserDoc, id: string, results: Partial<Record<UnitPart, PartResult>>): UnitPart[] {
  const s = ensureUnit(user, id);
  if (s.status === 'locked') s.status = 'open';
  const firstCheck = !s.checked;
  s.checked = true;
  for (const part of UNIT_PARTS) {
    const r = results[part];
    if (!r) continue;
    const p = s.parts[part];
    p.best = Math.max(p.best, Math.round(r.score));
    if (r.passed) p.passed = true;
    else p.practiced = false;
  }
  const missing = UNIT_PARTS.filter((p) => !s.parts[p].passed);
  if (!missing.length) finish(user, id, firstCheck);
  return missing;
}

export function markPracticed(user: UserDoc, id: string, part: UnitPart): void {
  ensureUnit(user, id).parts[part].practiced = true;
}

/** Lets the learner skip ahead to a unit (e.g. after deciding a level is too easy). */
export function openUnit(user: UserDoc, id: string): void {
  const s = ensureUnit(user, id);
  if (s.status === 'locked') s.status = 'open';
}

export function levelProgress(user: UserDoc, level: Level): { done: number; total: number } {
  const units = UNITS.filter((u) => u.level === level);
  return { done: units.filter((u) => unitState(user, u.id).status === 'done').length, total: units.length };
}

/** Highest level where every unit is done. */
export function confirmedLevel(user: UserDoc): Level | null {
  let best: Level | null = null;
  for (const level of ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as Level[]) {
    const p = levelProgress(user, level);
    if (p.done === p.total) best = level;
    else break;
  }
  return best;
}

/** The level the tutor should talk at: the current unit's level. */
export function workingLevel(user: UserDoc): Level {
  return currentUnit(user)?.level ?? 'C2';
}

/** Marks every unit of a level as tested out (fast-track level test) and opens the next level. */
export function testOutLevel(user: UserDoc, level: Level): void {
  const units = UNITS.filter((u) => u.level === level);
  for (const unit of units) {
    const s = ensureUnit(user, unit.id);
    for (const p of UNIT_PARTS) {
      s.parts[p].passed = true;
      s.parts[p].best = Math.max(s.parts[p].best, 70);
    }
    s.checked = true;
    if (s.status !== 'done') {
      s.status = 'done';
      s.doneAt = Date.now();
      s.viaTestOut = true;
    }
  }
  const next = nextUnit(units[units.length - 1].id);
  if (next) {
    const n = ensureUnit(user, next.id);
    if (n.status === 'locked') n.status = 'open';
  }
}
