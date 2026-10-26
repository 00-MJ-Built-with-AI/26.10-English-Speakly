import { UNITS } from '../content/units.ts';
import { LEVELS } from '../../shared/tasks.ts';
import type { Attempt, UserDoc } from '../lib/types.ts';
import { levelProgress, unitState } from './path.ts';
import { streak } from './progress.ts';

/** XP: 5 per practice minute (up to 30 minutes per activity) plus a bonus per kind of activity. */
const KIND_BONUS: Partial<Record<Attempt['kind'], number>> = {
  placement: 30,
  testout: 20,
  toefl: 25,
  tutor: 15,
  roleplay: 15,
  journal: 15,
  review: 10,
  vocab: 10,
  fillers: 10,
};
export const UNIT_BONUS = 50;

export function xpForAttempt(a: Attempt): number {
  return Math.min(30, Math.round(a.seconds / 60)) * 5 + (KIND_BONUS[a.kind] ?? 5);
}

/** Level n needs 50·(n-1)² XP: 50, 200, 450, 800, ... */
export function levelFromXp(xp: number): { level: number; from: number; to: number } {
  const level = Math.floor(Math.sqrt(xp / 50)) + 1;
  return { level, from: 50 * (level - 1) ** 2, to: 50 * level ** 2 };
}

const doneUnits = (u: UserDoc) => UNITS.filter((x) => unitState(u, x.id).status === 'done').length;

export interface Achievement {
  id: string;
  title: string;
  desc: string;
  icon: string;
  /** Unlocked? Gets the user and (when there is one) the attempt just logged. */
  test(u: UserDoc, a?: Attempt): boolean;
  /** Progress toward it, for the badge page. */
  progress?(u: UserDoc): [number, number];
}

const count = (u: UserDoc, k: string) => u.counts[k] ?? 0;
const minutes = (u: UserDoc) => Math.round(Object.values(u.daily).reduce((a, b) => a + b, 0) / 60);
const kindCount = (u: UserDoc, ...kinds: string[]) => kinds.reduce((n, k) => n + count(u, `kind:${k}`), 0);

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-words', title: 'First words', desc: 'Finish your first practice.', icon: 'mic', test: (u) => kindCount(u, ...Object.keys(KIND_BONUS), 'shadow', 'readaloud', 'sounds', 'fast', 'better', 'mytext', 'lesson') > 0 },
  ...[3, 7, 30, 100].map(
    (n): Achievement => ({ id: `streak-${n}`, title: `${n}-day streak`, desc: `Practise ${n} days in a row.`, icon: 'flame', test: (u) => streak(u) >= n, progress: (u) => [Math.min(streak(u), n), n] }),
  ),
  ...LEVELS.map(
    (l): Achievement => ({
      id: `level-${l}`,
      title: `${l} confirmed`,
      desc: `Finish every ${l} unit.`,
      icon: 'trophy',
      test: (u) => {
        const p = levelProgress(u, l);
        return p.done === p.total;
      },
      progress: (u) => {
        const p = levelProgress(u, l);
        return [p.done, p.total];
      },
    }),
  ),
  { id: 'fast-track', title: 'Fast track', desc: 'Pass a level in the fast-track level test.', icon: 'target', test: (_u, a) => a?.kind === 'placement' && /passed$/.test(a.title) },
  { id: 'units-10', title: 'Ten units', desc: 'Complete 10 units.', icon: 'path', test: (u) => doneUnits(u) >= 10, progress: (u) => [Math.min(doneUnits(u), 10), 10] },
  { id: 'sound-explorer', title: 'Sound explorer', desc: 'Score 10 different sound drills.', icon: 'wave', test: (u) => Object.keys(u.sounds).length >= 10, progress: (u) => [Math.min(Object.keys(u.sounds).length, 10), 10] },
  { id: 'sound-master', title: 'Crystal clear', desc: 'Reach 90 on any sound drill.', icon: 'wave', test: (u) => Object.values(u.sounds).some((v) => v >= 90) },
  { id: 'journal-7', title: 'Diary habit', desc: 'Record 7 journal entries.', icon: 'book', test: (u) => kindCount(u, 'journal') >= 7, progress: (u) => [Math.min(kindCount(u, 'journal'), 7), 7] },
  { id: 'journal-30', title: 'Storyteller', desc: 'Record 30 journal entries.', icon: 'book', test: (u) => kindCount(u, 'journal') >= 30, progress: (u) => [Math.min(kindCount(u, 'journal'), 30), 30] },
  { id: 'chatterbox', title: 'Chatterbox', desc: 'Have 10 conversations or role-plays.', icon: 'chat', test: (u) => kindCount(u, 'tutor', 'roleplay') >= 10, progress: (u) => [Math.min(kindCount(u, 'tutor', 'roleplay'), 10), 10] },
  { id: 'role-player', title: 'Role player', desc: 'Finish 5 role-plays.', icon: 'users', test: (u) => kindCount(u, 'roleplay') >= 5, progress: (u) => [Math.min(kindCount(u, 'roleplay'), 5), 5] },
  { id: 'mock-1', title: 'Test day rehearsal', desc: 'Take a full TOEFL mock test.', icon: 'trophy', test: (_u, a) => a?.kind === 'toefl' && a.title.startsWith('Mock test') },
  { id: 'target-band', title: 'On target', desc: 'Reach your target TOEFL band.', icon: 'target', test: (u) => u.settings.targetBand != null && u.toeflBand != null && u.toeflBand >= u.settings.targetBand },
  { id: 'phrases-25', title: 'Phrase collector', desc: 'Collect 25 phrases.', icon: 'book', test: (u) => count(u, 'vocab') >= 25, progress: (u) => [Math.min(count(u, 'vocab'), 25), 25] },
  { id: 'phrases-learned-25', title: 'Phrase master', desc: 'Fully learn 25 phrases.', icon: 'check', test: (u) => count(u, 'vocabLearned') >= 25, progress: (u) => [Math.min(count(u, 'vocabLearned'), 25), 25] },
  { id: 'mistakes-25', title: 'Mistake fixer', desc: 'Fully fix 25 mistakes in review.', icon: 'repeat', test: (u) => count(u, 'mistakesLearned') >= 25, progress: (u) => [Math.min(count(u, 'mistakesLearned'), 25), 25] },
  { id: 'quick-start', title: 'Quick starter', desc: 'Average under 1.5 s to start in a speak-fast drill.', icon: 'bolt', test: (_u, a) => a?.kind === 'fast' && a.hesitation != null && a.hesitation.startDelayMs < 1500 },
  { id: 'smooth-minute', title: 'Smooth talker', desc: 'Speak for a minute with a smoothness of 90+.', icon: 'wave', test: (_u, a) => a?.hesitation != null && a.hesitation.speechMs >= 60_000 && a.hesitation.score >= 90 },
  { id: 'hour-1', title: 'First hour', desc: 'Practise for 60 minutes in total.', icon: 'chart', test: (u) => minutes(u) >= 60, progress: (u) => [Math.min(minutes(u), 60), 60] },
  { id: 'hours-10', title: 'Ten hours', desc: 'Practise for 10 hours in total.', icon: 'chart', test: (u) => minutes(u) >= 600, progress: (u) => [Math.min(minutes(u), 600), 600] },
];

/**
 * Updates counters and XP for a logged attempt and unlocks achievements.
 * Mutates the user; returns the XP gained and the achievements unlocked now.
 */
export function rewardAttempt(u: UserDoc, a: Attempt, now = Date.now()): { xp: number; unlocked: Achievement[] } {
  u.counts[`kind:${a.kind}`] = (u.counts[`kind:${a.kind}`] ?? 0) + 1;
  let xp = xpForAttempt(a);
  const done = doneUnits(u);
  const newUnits = Math.max(0, done - (u.counts.unitsDone ?? 0));
  u.counts.unitsDone = Math.max(done, u.counts.unitsDone ?? 0);
  xp += newUnits * UNIT_BONUS;
  u.xp = (u.xp ?? 0) + xp;
  return { xp, unlocked: unlockAchievements(u, a, now) };
}

export function unlockAchievements(u: UserDoc, a?: Attempt, now = Date.now()): Achievement[] {
  const got: Achievement[] = [];
  for (const ach of ACHIEVEMENTS) {
    if (u.achievements[ach.id]) continue;
    if (ach.test(u, a)) {
      u.achievements[ach.id] = now;
      got.push(ach);
    }
  }
  return got;
}
