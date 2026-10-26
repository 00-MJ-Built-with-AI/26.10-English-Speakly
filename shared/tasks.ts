/**
 * The AI tasks the app asks the server for: inputs, and the exact shape of each answer.
 * Shared by the browser (types, offline stand-ins) and the server (prompts, structured output).
 */
import { z } from 'zod';

export const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export type Level = (typeof LEVELS)[number];

const cefr = z.enum(LEVELS);
const score = z.number().describe('0-100');

export type ChatRole = 'tutor' | 'learner';
export interface ChatLine {
  role: ChatRole;
  text: string;
}

export interface Scenario {
  title: string;
  setting: string;
  aiRole: string;
  userRole: string;
  userGoal: string;
}

export type CorrectionStyle = 'light' | 'every' | 'end';

export type ChatKind = 'free' | 'roleplay' | 'unit' | 'interview' | 'debate' | 'phone' | 'job' | 'smalltalk';

/** What the tutor remembers about the learner between sessions. */
export interface TutorMemory {
  facts: string[];
  topics: string[];
  /** Phrases the learner is learning; the tutor makes chances to use them. */
  phrases: string[];
  /** Corrected forms of mistakes the learner often makes. */
  mistakes: string[];
}

export interface ChatInput {
  level: Level;
  kind: ChatKind;
  topic?: string;
  scenario?: Scenario;
  targets?: { grammar?: string; functions?: string[]; vocab?: string[] };
  goals: string[];
  correction: CorrectionStyle;
  history: ChatLine[];
  memory?: TutorMemory;
  debate?: { motion: string; side: 'for' | 'against' };
  /** Job interview: the job ad and the learner's CV. */
  job?: { ad: string; cv: string };
}

// ---- check: one thing the learner said ----
export const ErrorItem = z.object({
  original: z.string().describe('The exact words the learner said that were wrong or unnatural'),
  corrected: z.string().describe('A natural, correct version'),
  explanation: z.string().describe('One short sentence, plain English'),
  kind: z.enum(['grammar', 'vocabulary', 'naturalness']),
});
export type ErrorItem = z.infer<typeof ErrorItem>;

export const CheckResult = z.object({
  errors: z.array(ErrorItem),
  grammarScore: score,
  vocabularyScore: score,
  cefr,
});
export type CheckResult = z.infer<typeof CheckResult>;
export interface CheckInput {
  level: Level;
  utterance: string;
  context?: string;
}

// ---- report: a whole conversation ----
export const ReportResult = z.object({
  summary: z.string().describe('2-3 sentences, encouraging but honest'),
  grammar: score,
  vocabulary: score,
  taskAchievement: score,
  cefr,
  strengths: z.array(z.string()),
  corrections: z.array(
    z.object({ said: z.string(), better: z.string(), why: z.string(), kind: z.enum(['grammar', 'vocabulary', 'naturalness']) }),
  ),
  betterPhrases: z.array(z.object({ instead: z.string(), try: z.string() })),
  pronunciationTips: z.array(z.string()),
  nextFocus: z.array(z.string()).describe('2-3 concrete things to practise next'),
  learnerFacts: z
    .array(z.string())
    .describe('New, lasting facts the learner shared about their life, work, plans or preferences, short third-person notes like "Works as a product manager in Dubai". Empty if none.'),
});
export type ReportResult = z.infer<typeof ReportResult>;
export interface ReportInput {
  level: Level;
  title: string;
  kind?: ChatKind;
  turns: (ChatLine & { errors?: ErrorItem[] })[];
  pronunciation?: { score: number; weakWords: string[]; weakSounds: string[] };
  fluency?: { wordsPerMinute: number; avgStartDelayMs: number; longPauses: number };
}

// ---- grade: a short spoken answer to a drill prompt ----
export const GradeResult = z.object({
  correct: z.boolean().describe('Meaning and the target structure are right; small slips allowed at the given level'),
  usedTarget: z.boolean(),
  corrected: z.string().describe('The best version of what the learner tried to say'),
  feedback: z.string().describe('One or two short sentences'),
  grammarScore: score,
  vocabularyScore: score,
});
export type GradeResult = z.infer<typeof GradeResult>;
export interface GradeInput {
  level: Level;
  instruction: string;
  prompt: string;
  example: string;
  grammarFocus: string;
  transcript: string;
}

// ---- task: an open spoken answer (test-outs) ----
export const TaskResult = z.object({
  achieved: z.boolean().describe('The learner did what the can-do statements describe, at this level'),
  grammarScore: score,
  vocabularyScore: score,
  coherenceScore: score,
  cefr,
  feedback: z.string(),
  corrections: z.array(ErrorItem),
});
export type TaskResult = z.infer<typeof TaskResult>;
export interface TaskInput {
  level: Level;
  question: string;
  canDo: string[];
  transcript: string;
  seconds: number;
}

// ---- toefl: one "Take an Interview" answer ----
export const ToeflResult = z.object({
  band: z.number().describe('1 to 6 in steps of 0.5, new TOEFL iBT speaking scale'),
  delivery: z.string().describe('Fluency, pace, intelligibility'),
  languageUse: z.string().describe('Grammar and vocabulary range and accuracy'),
  topicDevelopment: z.string().describe('How fully and coherently the question was answered'),
  tip: z.string(),
  corrections: z.array(ErrorItem),
});
export type ToeflResult = z.infer<typeof ToeflResult>;
export interface ToeflInput {
  question: string;
  transcript: string;
  seconds: number;
  pronunciation?: number;
  fluency?: number;
}

// ---- generate: fresh practice material ----
export const GenShadow = z.object({ sentences: z.array(z.string()) });
export const GenFast = z.object({
  items: z.array(z.object({ instruction: z.string(), prompt: z.string(), example: z.string() })),
});
export const GenReadAloud = z.object({ title: z.string(), text: z.string() });
export const GenToeflRepeat = z.object({ topic: z.string(), sentences: z.array(z.string()) });
export const GenToeflInterview = z.object({ topic: z.string(), intro: z.string(), questions: z.array(z.string()) });
export const GenRetell = z.object({
  title: z.string(),
  text: z.string().describe('What the speaker says, as natural spoken American English'),
  keyPoints: z.array(z.string()).describe('3-5 main points a good retelling must include'),
});

export type GenerateKind = 'shadow' | 'fast' | 'readaloud' | 'toefl-repeat' | 'toefl-interview' | 'retell';
export interface GenerateInput {
  kind: GenerateKind;
  level: Level;
  topic?: string;
  focus?: string;
  count?: number;
}
export interface GenerateOutputs {
  shadow: z.infer<typeof GenShadow>;
  fast: z.infer<typeof GenFast>;
  readaloud: z.infer<typeof GenReadAloud>;
  'toefl-repeat': z.infer<typeof GenToeflRepeat>;
  'toefl-interview': z.infer<typeof GenToeflInterview>;
  retell: z.infer<typeof GenRetell>;
}

// ---- retell: listen, then retell in your own words ----
export const RetellResult = z.object({
  covered: z.array(z.boolean()).describe('For each key point in order: did the retelling include it (paraphrase is fine)?'),
  contentScore: score,
  languageScore: score,
  feedback: z.string().describe('2-3 sentences on content and language'),
  betterRetell: z.string().describe('A model retelling at the learner level plus one, about the same length as theirs'),
  corrections: z.array(ErrorItem),
});
export type RetellResult = z.infer<typeof RetellResult>;
export interface RetellInput {
  level: Level;
  text: string;
  keyPoints: string[];
  transcript: string;
}

// ---- weekly: the weekly summary ----
export const WeeklyResult = z.object({
  headline: z.string(),
  body: z.string().describe('A short paragraph about the week'),
  focus: z.array(z.string()).describe('2-3 things to focus on next week'),
});
export type WeeklyResult = z.infer<typeof WeeklyResult>;
export interface WeeklyInput {
  level: Level;
  minutes: number;
  activeDays: number;
  skills: Record<string, { now: number; change: number }>;
  topMistakes: string[];
  weakSounds: string[];
}

// ---- phrases (journal, say-it-better, vocabulary bank) ----
export const Phrase = z.object({
  phrase: z.string().describe('A natural, reusable English phrase or collocation'),
  meaning: z.string().describe('Short, simple explanation'),
  example: z.string().describe('One natural example sentence using it'),
});
export type Phrase = z.infer<typeof Phrase>;

// ---- journal: a 1-2 minute spoken diary entry ----
export const JournalResult = z.object({
  feedback: z.string().describe('2-3 sentences: what was good and the single most useful thing to improve'),
  corrections: z.array(ErrorItem),
  polished: z.string().describe('The same content as a natural spoken version, about one level higher, same meaning, same length'),
  phrases: z.array(Phrase).describe('2-4 useful phrases for talking about this topic'),
  grammarScore: score,
  vocabularyScore: score,
  cefr,
});
export type JournalResult = z.infer<typeof JournalResult>;
export interface JournalInput {
  level: Level;
  prompt: string;
  transcript: string;
  seconds: number;
}

// ---- better: say what you mean in Arabic or rough English, get natural English ----
export const BetterResult = z.object({
  understood: z.string().describe('What the learner means, in one plain English sentence'),
  versions: z.array(
    z.object({
      text: z.string(),
      style: z.enum(['everyday', 'professional', 'concise']),
      note: z.string().describe('When to use it, in a few words'),
    }),
  ),
  phrases: z.array(Phrase).describe('1-3 key phrases worth learning from these versions'),
});
export type BetterResult = z.infer<typeof BetterResult>;
export interface BetterInput {
  level: Level;
  text: string;
  language: 'ar' | 'en';
  situation?: string;
}

// ---- define: fill in a phrase the learner adds by hand ----
export const DefineResult = z.object({ meaning: z.string(), example: z.string() });
export type DefineResult = z.infer<typeof DefineResult>;
export interface DefineInput {
  phrase: string;
  level: Level;
}

export interface TaskMap {
  check: [CheckInput, CheckResult];
  report: [ReportInput, ReportResult];
  grade: [GradeInput, GradeResult];
  task: [TaskInput, TaskResult];
  toefl: [ToeflInput, ToeflResult];
  generate: [GenerateInput, GenerateOutputs[GenerateKind]];
  weekly: [WeeklyInput, WeeklyResult];
  journal: [JournalInput, JournalResult];
  better: [BetterInput, BetterResult];
  define: [DefineInput, DefineResult];
  retell: [RetellInput, RetellResult];
}
export type TaskName = keyof TaskMap;
