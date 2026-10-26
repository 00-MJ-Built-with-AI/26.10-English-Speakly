import type { CorrectionStyle, ErrorItem, Level } from '../../shared/tasks.ts';
import type { HesitationStats } from '../engine/hesitation.ts';

export type { Level, CorrectionStyle, ErrorItem };

export type Skill = 'pronunciation' | 'fluency' | 'grammar' | 'vocabulary';
export const SKILLS: Skill[] = ['pronunciation', 'fluency', 'grammar', 'vocabulary'];

/** The three parts every unit's check measures. */
export type UnitPart = 'pronunciation' | 'grammar' | 'task';
export const UNIT_PARTS: UnitPart[] = ['pronunciation', 'grammar', 'task'];

export interface PartState {
  passed: boolean;
  best: number;
  /** Lesson for this part done since the last failed check. */
  practiced: boolean;
}

export interface UnitState {
  status: 'locked' | 'open' | 'done';
  checked: boolean;
  parts: Record<UnitPart, PartState>;
  doneAt?: number;
  viaTestOut?: boolean;
}

export interface Settings {
  voice: string;
  speechRate: number;
  /** Seconds of silence before the tutor treats your turn as finished. */
  turnPause: number;
  liveTranscript: boolean;
  correction: CorrectionStyle;
  dailyGoalMinutes: number;
  keepRecordings: boolean;
  handsFree: boolean;
  /** TOEFL exam date, YYYY-MM-DD. */
  examDate?: string;
  /** Target TOEFL speaking band, 1-6. */
  targetBand?: number;
  showGamification: boolean;
  /** Arabic dialect for "Say it better" (Azure locale). */
  arabicLocale: string;
}

export const DEFAULT_SETTINGS: Settings = {
  voice: 'en-US-AvaMultilingualNeural',
  speechRate: 1,
  turnPause: 1.6,
  liveTranscript: true,
  correction: 'light',
  dailyGoalMinutes: 25,
  keepRecordings: true,
  handsFree: true,
  showGamification: true,
  arabicLocale: 'ar-JO',
};

export interface UserDoc {
  version: 1;
  createdAt: number;
  name: string;
  settings: Settings;
  units: Record<string, UnitState>;
  /** Smoothed current skill scores, 0-100. */
  skills: Record<Skill, number | null>;
  /** Per-sound accuracy, smoothed, keyed by sound-set id. */
  sounds: Record<string, number>;
  /** Practice seconds by local date (YYYY-MM-DD). */
  daily: Record<string, number>;
  toeflBand: number | null;
  xp: number;
  /** Achievement id -> time unlocked. */
  achievements: Record<string, number>;
  /** Running totals for achievements (attempts by kind, phrases added, ...). */
  counts: Record<string, number>;
}

export function emptyUser(name = ''): UserDoc {
  return {
    version: 1,
    createdAt: Date.now(),
    name,
    settings: { ...DEFAULT_SETTINGS },
    units: {},
    skills: { pronunciation: null, fluency: null, grammar: null, vocabulary: null },
    sounds: {},
    daily: {},
    toeflBand: null,
    xp: 0,
    achievements: {},
    counts: {},
  };
}

/** Fills in fields added after a user document was first saved. */
export function migrateUser(u: UserDoc): UserDoc {
  return {
    ...emptyUser(u.name),
    ...u,
    settings: { ...DEFAULT_SETTINGS, ...u.settings },
    xp: u.xp ?? 0,
    achievements: u.achievements ?? {},
    counts: u.counts ?? {},
  };
}

/** Something practised and scored; the dashboard history is built from these. */
export interface Attempt {
  id?: string;
  at: number;
  kind: AttemptKind;
  title: string;
  unitId?: string;
  scores: Partial<Record<Skill, number>>;
  seconds: number;
  hesitation?: HesitationStats;
  detail?: unknown;
}

export type AttemptKind =
  | 'shadow'
  | 'readaloud'
  | 'sounds'
  | 'fast'
  | 'tutor'
  | 'roleplay'
  | 'testout'
  | 'toefl'
  | 'review'
  | 'lesson'
  | 'placement'
  | 'journal'
  | 'better'
  | 'vocab'
  | 'fillers'
  | 'mytext';

export interface Mistake {
  id?: string;
  at: number;
  kind: 'grammar' | 'vocabulary' | 'naturalness' | 'pronunciation';
  /** What was said (or the badly pronounced word). */
  said: string;
  /** What to say instead (sentence or word to practise). */
  better: string;
  why: string;
  box: number;
  due: number;
  reps: number;
  lapses: number;
  source: string;
}

export interface Recording {
  id?: string;
  at: number;
  title: string;
  kind: Attempt['kind'];
  path: string;
  seconds: number;
  text?: string;
  score?: number;
}

export interface TutorSession {
  id?: string;
  at: number;
  title: string;
  kind: 'free' | 'roleplay' | 'unit' | 'interview';
  turns: { role: 'tutor' | 'learner'; text: string; errors?: ErrorItem[] }[];
  report?: unknown;
  seconds: number;
}

/** A phrase in the personal vocabulary bank (reviewed like mistakes). */
export interface VocabItem {
  id?: string;
  at: number;
  phrase: string;
  meaning: string;
  example: string;
  source: string;
  box: number;
  due: number;
  reps: number;
  lapses: number;
}

export interface JournalEntry {
  id?: string;
  at: number;
  prompt: string;
  text: string;
  seconds: number;
  feedback: unknown;
  hesitation?: HesitationStats;
  pron?: number;
  audioPath?: string;
}

export interface SavedText {
  id?: string;
  at: number;
  title: string;
  text: string;
}

export type Collection = 'attempts' | 'mistakes' | 'recordings' | 'sessions' | 'vocab' | 'journal' | 'texts';
