import type { TutorMemory } from '../../shared/tasks.ts';
import type { Mistake, UserDoc, VocabItem } from '../lib/types.ts';
import { LEARNED_BOX } from './srs.ts';

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();

/** Newest first, no near-duplicates, capped. */
export function mergeNotes(old: string[], added: string[], cap: number): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const s of [...added, ...old]) {
    const k = norm(s);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(s.trim());
    if (out.length >= cap) break;
  }
  return out;
}

export const MAX_FACTS = 30;
export const MAX_TOPICS = 12;

/** Remembers new facts and the topic of a finished conversation. */
export function rememberSession(u: UserDoc, facts: string[], topic: string): void {
  u.memory = {
    facts: mergeNotes(u.memory?.facts ?? [], facts, MAX_FACTS),
    topics: mergeNotes(u.memory?.topics ?? [], topic ? [topic] : [], MAX_TOPICS),
  };
}

/** What the tutor gets at the start of a session. */
export function memoryForTutor(u: UserDoc, vocab: VocabItem[], mistakes: Mistake[]): TutorMemory | undefined {
  if (!u.settings.tutorMemory) return undefined;
  const learning = vocab.filter((v) => v.box > 0 && v.box < LEARNED_BOX).sort((a, b) => a.due - b.due);
  const fresh = vocab.filter((v) => v.box === 0);
  const phrases = [...learning, ...fresh].slice(0, 6).map((v) => v.phrase);
  const recentMistakes = mistakes
    .filter((m) => m.kind !== 'pronunciation' && m.box < LEARNED_BOX)
    .sort((a, b) => b.lapses - a.lapses || b.at - a.at)
    .slice(0, 4)
    .map((m) => m.better);
  const m: TutorMemory = { facts: u.memory?.facts ?? [], topics: (u.memory?.topics ?? []).slice(0, 6), phrases, mistakes: recentMistakes };
  return m.facts.length || m.topics.length || m.phrases.length || m.mistakes.length ? m : undefined;
}
