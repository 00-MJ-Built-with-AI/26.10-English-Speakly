import type { ChatKind, CorrectionStyle, ErrorItem, Level } from '../../shared/tasks.ts';
import type { HesitationStats } from '../engine/hesitation.ts';
import { DEFAULT_VOICE } from '../speech/voices.ts';
import type { MicCheckResult } from '../engine/audiocheck.ts';
import type { Section, ToeflScore } from '../engine/toeflScale.ts';
import type { WordsData } from '../engine/words.ts';

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
  /** Last time the go-live check ran. */
  goLiveAt?: number;
  /** The 5,000-word course: which words are known or in review. */
  words?: WordsData;
  /** KAUST application coach: profile, professors of interest, statement drafts. */
  kaust?: KaustData;
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
  toefl: ToeflData;
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
    toefl: emptyToefl(),
  };
}

export interface ToeflData {
  /** Goal band on the 1-6 scale, for the overall score and every section. */
  target: number;
  /** Lowest acceptable band (1-6). */
  minimum: number;
  /** Official results (from score report photos) and full mock estimates, newest first. */
  scores: ToeflScore[];
  /** Practice accuracy by question type (Reading and Listening) and task (Writing). */
  typeStats: Record<string, { right: number; total: number }>;
  /** Practice points by section, for estimates: share of points earned. */
  sectionStats: Partial<Record<Section, { points: number; max: number }>>;
  /** Recent typing speeds (words per minute). */
  typing: number[];
  /** A full mock between its written part and the speaking part. */
  pendingMock?: { at: number; scores30: Partial<Record<Section, number>>; speakingBand?: number };
  /** Recent practice results (newest last, capped), for the per-skill band estimate. */
  log: { at: number; section: Section; kind: string; points: number; max: number }[];
  /** Results of single-section tests (newest last). */
  sectionTests: { at: number; section: Section; band: number; score30?: number }[];
  /** Academic vocabulary in spaced repetition: box 0-5 and when it is due again. */
  vocab: Record<string, { meaning: string; sentence: string; box: number; due: number }>;
  /** Mistakes from scored writing, drilled until fixed twice. */
  writeErrors: { at: number; kind: string; original: string; corrected: string; explanation: string; fixed: number }[];
  /** Practice audio speed and voice for Listening (the real test is 1x, one voice per speaker). */
  listenRate: number;
  /** 'varied' picks different voices for each practice set. */
  listenVoices: 'standard' | 'varied';
  /** Missed questions that come back until answered right twice. */
  review: ReviewItem[];
  /** Show short Arabic explanations for missed items. */
  arabic: boolean;
  /** Accuracy per question type per week (key: Monday, YYYY-MM-DD). */
  typeWeeks: Record<string, Record<string, { right: number; total: number }>>;
  /** Exam-day checklist ticks. */
  checklist: Record<string, boolean>;
  /** Today's plan items ticked off (reset each day). */
  planChecks: { date: string; done: string[] };
  /** Phoneme accuracy per sound drill from TOEFL speaking answers (running sum and count). */
  sounds: Record<string, { sum: number; n: number }>;
  /** Recent start delays (ms) in 15-second quick answers. */
  quick: number[];
  /** Per-skill shift learned from official results (official minus estimate). */
  calibration: Partial<Record<Section, number>>;
  /** What was predicted vs the official result, for the scores page. */
  calibrationLog: { at: number; section: Section; predicted: number; official: number }[];
}

export interface ReviewItem {
  id: string;
  at: number;
  kind: string;
  /** The passage or transcript, shortened. */
  context?: string;
  question: { question: string; options: string[]; answer: number; type: string; explanation: string };
  /** Correct reviews so far (2 = learned, removed). */
  box: number;
  due: number;
}

export function emptyToefl(): ToeflData {
  return { target: 5.5, minimum: 5, scores: [], typeStats: {}, sectionStats: {}, typing: [], log: [], sectionTests: [], vocab: {}, writeErrors: [], listenRate: 1, listenVoices: 'standard', review: [], arabic: false, typeWeeks: {}, checklist: {}, planChecks: { date: '', done: [] }, sounds: {}, quick: [], calibration: {}, calibrationLog: [] };
}

/** The goal used to be on the 0-120 scale; it is now a 1-6 band. */
function migrateToefl(t: Partial<ToeflData> | undefined): ToeflData {
  const out = { ...emptyToefl(), ...t };
  if (out.target > 6) out.target = 5.5;
  if (out.minimum > 6) out.minimum = 5;
  return out;
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
    toefl: migrateToefl(u.toefl),
    kaust: u.kaust ? { ...emptyKaust(), ...u.kaust } : undefined,
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

export interface KaustData {
  program: string;
  interests: string;
  cv: string;
  professors: { id: string; name: string; area: string; notes: string }[];
  /** Statement of purpose versions with their review score (newest last). */
  sops: { at: number; text: string; score: number | null }[];
  /** Last research pitch transcript, for audience Q&A. */
  pitch?: string;
  /** Application tracker: deadlines the learner enters (YYYY-MM-DD). */
  deadlines: { id: string; label: string; date: string; done: boolean }[];
  /** Document checklist ticks, by id; custom documents are added to `customDocs`. */
  docs: Record<string, boolean>;
  customDocs: { id: string; label: string }[];
  recommenders: Recommender[];
}

export interface Recommender {
  id: string;
  name: string;
  /** e.g. "thesis supervisor", "course instructor (Signals and Systems)". */
  relation: string;
  /** What you did with them: projects, courses, results they can speak to. */
  together: string;
  deadline: string;
  status: 'not-asked' | 'asked' | 'agreed' | 'submitted';
}

export const emptyKaust = (): KaustData => ({ program: '', interests: '', cv: '', professors: [], sops: [], deadlines: [], docs: {}, customDocs: [], recommenders: [] });
