import type { ChatKind, CorrectionStyle, ErrorItem, Level } from '../../shared/tasks.ts';
import type { HesitationStats } from '../engine/hesitation.ts';
import { DEFAULT_VOICE } from '../speech/voices.ts';
import type { MicCheckResult } from '../engine/audiocheck.ts';

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
  /** Browser voice name used when Azure isn't connected. */
  browserVoice?: string;
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
  /** Let the tutor remember facts, topics and phrases between sessions. */
  tutorMemory: boolean;
  /** Daily spending limit in US dollars for the AI tutor and Azure (0 = no limit). */
  dailyCapUsd: number;
  /** Estimated prices, editable: Azure speech recognition per hour, voices per million characters. */
  rates: { sttPerHour: number; ttsPerMillion: number; hdTtsPerMillion: number };
  theme: 'system' | 'light' | 'dark';
  /** Arabic dialect for "Say it better" (Azure locale). */
  arabicLocale: string;
}

export const DEFAULT_SETTINGS: Settings = {
  voice: DEFAULT_VOICE,
  speechRate: 1,
  turnPause: 1.6,
  liveTranscript: true,
  correction: 'light',
  dailyGoalMinutes: 25,
  keepRecordings: true,
  handsFree: true,
  showGamification: true,
  tutorMemory: true,
  dailyCapUsd: 1,
  rates: { sttPerHour: 1, ttsPerMillion: 15, hdTtsPerMillion: 30 },
  theme: 'system',
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
  /** What the tutor remembers: short facts about the learner and recent topics. */
  memory: { facts: string[]; topics: string[] };
  /** Saved job ad and CV for interview practice. */
  interviewPrep?: { ad: string; cv: string };
  micCheck?: MicCheckResult;
  /** Estimated spending by local date. */
  usage: Record<string, UsageDay>;
  /** First-run setup finished. */
  onboarded: boolean;
  /** Earlier official test scores (e.g. EF SET), for comparison. */
  baseline?: Baseline;
  weeklyFocus?: WeeklyFocus;
  /** Best result per tongue twister id. */
  twisters: Record<string, { accuracy: number; wpm: number }>;
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
    memory: { facts: [], topics: [] },
    usage: {},
    onboarded: false,
    twisters: {},
  };
}

/** Fills in fields added after a user document was first saved. */
export function migrateUser(u: UserDoc): UserDoc {
  return {
    ...emptyUser(u.name),
    ...u,
    xp: u.xp ?? 0,
    achievements: u.achievements ?? {},
    counts: u.counts ?? {},
    memory: u.memory ?? { facts: [], topics: [] },
    usage: u.usage ?? {},
    onboarded: u.onboarded ?? false,
    twisters: u.twisters ?? {},
    // The first default voice was the standard Ava; move to the more natural HD Ava.
    settings: { ...DEFAULT_SETTINGS, ...u.settings, rates: { ...DEFAULT_SETTINGS.rates, ...u.settings?.rates }, voice: u.settings?.voice === 'en-US-AvaMultilingualNeural' ? DEFAULT_VOICE : (u.settings?.voice ?? DEFAULT_VOICE) },
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
  | 'mytext'
  | 'debate'
  | 'phone'
  | 'retell'
  | 'checkup'
  | 'car'
  | 'interview'
  | 'smalltalk'
  | 'idiom'
  | 'numbers'
  | 'opinion'
  | 'story'
  | 'twister';

export interface UsageDay {
  /** Estimated dollars spent on the AI tutor. */
  ai: number;
  /** Estimated dollars spent on Azure speech (recognition + voices). */
  speech: number;
  aiCalls: number;
  sttSec: number;
  ttsChars: number;
}

export interface Baseline {
  test: string;
  date: string;
  reading?: number;
  listening?: number;
  writing?: number;
  speaking?: number;
}

export interface FocusItem {
  kind: 'sound' | 'hesitation' | 'skill' | 'mistakes';
  label: string;
  why: string;
  to: string;
}

export interface WeeklyFocus {
  /** Monday of the week, YYYY-MM-DD. */
  week: string;
  items: FocusItem[];
}

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
  kind: ChatKind;
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

/** One monthly accent check-up: scores per sound set plus overall. */
export interface Checkup {
  id?: string;
  at: number;
  pron: number;
  accuracy: number;
  fluency: number;
  prosody: number | null;
  sounds: Record<string, number>;
  audioPath?: string;
}

export type Collection = 'attempts' | 'mistakes' | 'recordings' | 'sessions' | 'vocab' | 'journal' | 'texts' | 'checkups';
