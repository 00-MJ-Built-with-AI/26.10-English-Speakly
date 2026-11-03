import type { GenKind } from '../../../shared/toefl.ts';
import type { Section } from '../../engine/toeflScale.ts';
import type { UserDoc } from '../../lib/types.ts';
import type { TaskOutcome } from './tasks.tsx';

export const KIND_SECTION: Record<GenKind, Section> = {
  complete: 'reading',
  daily: 'reading',
  academic: 'reading',
  response: 'listening',
  conversation: 'listening',
  announcement: 'listening',
  talk: 'listening',
  build: 'writing',
  email: 'writing',
  discussion: 'writing',
};

export const KIND_LABEL: Record<GenKind, string> = {
  complete: 'Complete the Words',
  daily: 'Read in Daily Life',
  academic: 'Read an Academic Passage',
  response: 'Listen and Choose a Response',
  conversation: 'Listen to a Conversation',
  announcement: 'Listen to an Announcement',
  talk: 'Listen to an Academic Talk',
  build: 'Build a Sentence',
  email: 'Write an Email',
  discussion: 'Write for an Academic Discussion',
};

export const SECTION_KINDS: Record<Exclude<Section, 'speaking'>, { kind: GenKind; key: string }[]> = {
  reading: [
    { kind: 'complete', key: 'complete' },
    { kind: 'daily', key: 'daily' },
    { kind: 'academic', key: 'academic' },
  ],
  listening: [
    { kind: 'response', key: 'response' },
    { kind: 'conversation', key: 'conversation' },
    { kind: 'announcement', key: 'announcement' },
    { kind: 'talk', key: 'talk' },
  ],
  writing: [
    { kind: 'build', key: 'build' },
    { kind: 'email', key: 'email' },
    { kind: 'discussion', key: 'discussion' },
  ],
};

/** Adds a task's results to the per-type accuracy and per-section points. */
export function recordOutcome(u: UserDoc, kind: GenKind, o: TaskOutcome): void {
  const section = KIND_SECTION[kind];
  for (const m of o.marks) {
    const t = (u.toefl.typeStats[m.type] ??= { right: 0, total: 0 });
    t.total++;
    if (m.correct) t.right++;
  }
  const s = (u.toefl.sectionStats[section] ??= { points: 0, max: 0 });
  // Essays count as much as five questions, as in the real Writing raw score.
  s.points += o.points;
  s.max += o.max;
}
