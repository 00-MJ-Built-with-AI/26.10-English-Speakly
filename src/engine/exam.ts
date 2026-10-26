/** Study plan toward a TOEFL exam date and target speaking band. */
export type ExamPhase = 'none' | 'build' | 'focus' | 'final' | 'past';
export type ToeflFocus = 'repeat' | 'interview' | 'mock';

export interface ExamPlan {
  phase: ExamPhase;
  daysLeft: number | null;
  current: number | null;
  target: number | null;
  /** Bands still to gain (positive = below target). */
  gap: number | null;
  mocksPerWeek: number;
  /** What TOEFL practice today's plan should include, if any. */
  today: ToeflFocus | null;
  advice: string;
}

const DAY = 86_400_000;

export function daysUntil(date: string, now = Date.now()): number {
  const [y, m, d] = date.split('-').map(Number);
  const exam = new Date(y, m - 1, d).getTime();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return Math.round((exam - start.getTime()) / DAY);
}

export function examPlan(examDate: string | undefined, target: number | undefined, current: number | null, now = Date.now()): ExamPlan {
  const dow = new Date(now).getDay();
  const dayNo = Math.floor(now / DAY);
  const gap = target != null && current != null ? Math.round((target - current) * 2) / 2 : null;
  if (!examDate) {
    return { phase: 'none', daysLeft: null, current, target: target ?? null, gap, mocksPerWeek: 0, today: dow === 3 ? 'interview' : dow === 6 ? 'repeat' : null, advice: '' };
  }
  const daysLeft = daysUntil(examDate, now);
  const base = { daysLeft, current, target: target ?? null, gap };
  if (daysLeft < 0) return { ...base, phase: 'past', mocksPerWeek: 0, today: null, advice: 'Your exam date has passed. Set a new date if you are taking it again.' };
  if (daysLeft <= 14) {
    return {
      ...base,
      phase: 'final',
      mocksPerWeek: 3,
      today: daysLeft <= 1 ? 'repeat' : dayNo % 2 === 0 ? 'mock' : 'interview',
      advice: daysLeft <= 1 ? 'Light practice only: a short warm-up, then rest.' : 'Final stretch: a full mock every other day and interview answers in between. Keep sessions short and sharp.',
    };
  }
  if (daysLeft <= 42) {
    return {
      ...base,
      phase: 'focus',
      mocksPerWeek: 1,
      today: dow === 6 ? 'mock' : dayNo % 2 === 0 ? 'interview' : 'repeat',
      advice: 'Exam focus: some TOEFL practice every day and one full mock each weekend.',
    };
  }
  return {
    ...base,
    phase: 'build',
    mocksPerWeek: 0.5,
    today: dow === 6 ? 'mock' : dow === 3 ? 'interview' : dow === 1 ? 'repeat' : null,
    advice: 'Building skills: keep working through your path, with TOEFL tasks a few times a week and a mock every other week.',
  };
}
