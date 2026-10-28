import { SOUNDS } from '../content/sounds.ts';
import type { Attempt, FocusItem, Mistake, Skill, UserDoc } from '../lib/types.ts';
import { combineHesitation } from './hesitation.ts';
import { dateKey } from './progress.ts';
import { LEARNED_BOX } from './srs.ts';

/** The Monday that starts the week containing `now`, as YYYY-MM-DD. */
export function mondayKey(now = Date.now()): string {
  const d = new Date(now);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return dateKey(d.getTime());
}

const SKILL_FOCUS: Record<Skill, { label: string; to: string }> = {
  pronunciation: { label: 'Pronunciation: shadow every day', to: '/practice/shadow' },
  fluency: { label: 'Fluency: start fast, keep going', to: '/practice/fast' },
  grammar: { label: 'Grammar in speech: fix your mistakes', to: '/review' },
  vocabulary: { label: 'Vocabulary: use your phrases', to: '/vocab' },
};

/**
 * The two areas that need the most work right now, from sound scores, hesitation in the last two
 * weeks, the weakest skill and the size of the mistake bank.
 */
export function computeFocus(user: UserDoc, attempts: Attempt[], mistakes: Mistake[], now = Date.now()): FocusItem[] {
  const c: (FocusItem & { severity: number })[] = [];

  const weak = SOUNDS.filter((s) => user.sounds[s.id] != null && user.sounds[s.id] < 75).sort((a, b) => user.sounds[a.id] - user.sounds[b.id])[0];
  if (weak) {
    const v = Math.round(user.sounds[weak.id]);
    c.push({ kind: 'sound', label: `Sound: ${weak.title}`, why: `Your score is ${v}/100.`, to: `/practice/sounds/${weak.id}`, severity: 75 - v });
  }

  const recent = attempts.filter((a) => a.hesitation && a.at > now - 14 * 86_400_000).map((a) => a.hesitation!);
  const h = combineHesitation(recent);
  if (h && (h.perMinute > 3 || h.startDelayMs > 2500)) {
    c.push({
      kind: 'hesitation',
      label: 'Fewer pauses and fillers',
      why: `${h.perMinute} hesitations a minute; you start after ${(h.startDelayMs / 1000).toFixed(1)} s on average.`,
      to: '/practice/fillers',
      severity: h.perMinute * 5 + Math.max(0, h.startDelayMs - 2000) / 200,
    });
  }

  const skills = (Object.entries(user.skills) as [Skill, number | null][]).filter((e): e is [Skill, number] => e[1] != null);
  if (skills.length >= 2) {
    const avg = skills.reduce((a, [, v]) => a + v, 0) / skills.length;
    const [name, v] = [...skills].sort((a, b) => a[1] - b[1])[0];
    if (avg - v >= 5) c.push({ kind: 'skill', ...SKILL_FOCUS[name], why: `${name[0].toUpperCase()}${name.slice(1)} is ${v}, below your average of ${Math.round(avg)}.`, severity: avg - v });
  }

  const open = mistakes.filter((m) => m.kind !== 'pronunciation' && m.box < LEARNED_BOX).length;
  if (open >= 10) c.push({ kind: 'mistakes', label: 'Clear your mistake bank', why: `${open} corrections still to fix.`, to: '/review', severity: open / 2 });

  const picked = c.sort((a, b) => b.severity - a.severity).slice(0, 2).map(({ severity: _s, ...rest }) => rest);
  if (picked.length) return picked;
  return [{ kind: 'skill', label: 'Talk more: one conversation a day', why: 'No weak spot stands out yet. More speaking gives more data.', to: '/tutor' }];
}
