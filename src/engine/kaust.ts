/** KAUST application tracker: default documents and the reminders shown on Today. */
import type { KaustData } from '../lib/types.ts';

/** A general checklist; the program's own page is the authority, so custom items can be added. */
export const DEFAULT_DOCS = [
  { id: 'form', label: 'Online application form completed' },
  { id: 'transcripts', label: 'Transcripts from every university' },
  { id: 'degree', label: 'Degree certificate (or expected graduation letter)' },
  { id: 'sop', label: 'Statement of purpose final version' },
  { id: 'cv', label: 'CV / resume' },
  { id: 'letters', label: 'Recommendation letters requested' },
  { id: 'toefl', label: 'TOEFL score sent to KAUST (institution code 4107)' },
  { id: 'id', label: 'Passport or national ID copy' },
  { id: 'professors', label: 'Contacted professors of interest (optional)' },
];

export interface Reminder {
  title: string;
  desc: string;
  days: number;
}

/** Calendar days from today to the date (0 = today, negative = past), in local time. */
function days(date: string, now: number): number {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return Math.round((Date.parse(`${date}T00:00:00`) - today.getTime()) / 86_400_000);
}

/** Deadlines and recommendation letters due within `within` days (overdue ones included), soonest first. */
export function kaustReminders(k: KaustData | undefined, now = Date.now(), within = 14): Reminder[] {
  if (!k) return [];
  const out: Reminder[] = [];
  for (const d of k.deadlines) {
    if (d.done || !d.date) continue;
    const n = days(d.date, now);
    if (n <= within) out.push({ title: d.label, desc: n < 0 ? `Overdue by ${-n} day${n === -1 ? '' : 's'}` : n === 0 ? 'Due today' : `Due in ${n} day${n === 1 ? '' : 's'} (${d.date})`, days: n });
  }
  for (const r of k.recommenders) {
    if (r.status === 'submitted' || !r.deadline) continue;
    const n = days(r.deadline, now);
    if (n <= within) out.push({ title: `Letter from ${r.name}`, desc: `${r.status === 'not-asked' ? 'Not asked yet' : r.status === 'asked' ? 'Waiting for an answer' : 'Agreed, not submitted'} · due ${n < 0 ? `${-n} days ago` : `in ${n} day${n === 1 ? '' : 's'}`}`, days: n });
  }
  return out.sort((a, b) => a.days - b.days);
}
