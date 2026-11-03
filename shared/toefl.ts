/** Shapes for the full TOEFL section: generated practice items, essay scores, score-report reading. */
import { z } from 'zod';
import { ErrorItem } from './tasks.js';

export const QUESTION_TYPES = ['main-idea', 'detail', 'inference', 'vocabulary', 'purpose', 'organization', 'attitude', 'response'] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const Question = z.object({
  question: z.string(),
  options: z.array(z.string()).describe('Exactly 4 options'),
  answer: z.number().describe('Index 0-3 of the correct option'),
  type: z.enum(QUESTION_TYPES),
  explanation: z.string().describe('One sentence: why the answer is right'),
});
export type Question = z.infer<typeof Question>;

export const GEN = {
  complete: z.object({
    title: z.string(),
    text: z.string().describe('An academic paragraph of 70-100 words'),
    words: z.array(z.string()).describe('10 words from the text (in order of appearance, 4+ letters, from the 2nd sentence on) whose second half will be removed'),
  }),
  daily: z.object({
    format: z.string().describe('e.g. email, notice, menu, social media post, schedule, text message'),
    title: z.string(),
    text: z.string().describe('The everyday text, 40-120 words'),
    questions: z.array(Question),
  }),
  academic: z.object({ title: z.string(), text: z.string().describe('About 180-220 words'), questions: z.array(Question) }),
  response: z.object({
    items: z.array(
      z.object({
        prompt: z.string().describe('One thing a person says (heard, not read)'),
        options: z.array(z.string()).describe('4 written replies'),
        answer: z.number(),
        explanation: z.string(),
      }),
    ),
  }),
  conversation: z.object({
    title: z.string(),
    lines: z.array(z.object({ speaker: z.enum(['woman', 'man']), text: z.string() })).describe('8-12 lines'),
    questions: z.array(Question),
  }),
  announcement: z.object({ title: z.string(), speaker: z.string(), text: z.string().describe('80-140 words'), questions: z.array(Question) }),
  talk: z.object({ title: z.string(), text: z.string().describe('About 200-250 words, as a professor would say it'), questions: z.array(Question) }),
  build: z.object({
    items: z.array(
      z.object({
        context: z.string().describe('What the other person says first'),
        answer: z.string().describe('The correct reply sentence'),
        chunks: z.array(z.string()).describe('The reply split into 5-8 words or short phrases, in the correct order'),
      }),
    ),
  }),
  email: z.object({ situation: z.string(), to: z.string(), points: z.array(z.string()).describe('Exactly 3 things the email must do') }),
  discussion: z.object({
    course: z.string(),
    professor: z.string().describe("The professor's post with a question, 60-90 words"),
    posts: z.array(z.object({ name: z.string(), text: z.string().describe('40-70 words') })).describe('Exactly 2 student posts with different views'),
  }),
  // Skill drills (not test tasks themselves).
  paraphrase: z.object({
    items: z.array(
      z.object({
        sentence: z.string().describe('An academic sentence of 18-35 words'),
        options: z.array(z.string()).describe('4 rewordings; exactly one keeps the full meaning'),
        answer: z.number(),
        explanation: z.string().describe('What the wrong options change or leave out'),
      }),
    ),
  }),
  vocab: z.object({
    items: z.array(
      z.object({
        word: z.string(),
        sentence: z.string().describe('An academic sentence that uses the word exactly as written'),
        meaning: z.string().describe('Short plain-English meaning in this context'),
        options: z.array(z.string()).describe('4 short meanings; one is right'),
        answer: z.number(),
      }),
    ),
  }),
  spelling: z.object({
    items: z.array(
      z.object({
        sentence: z.string().describe('A sentence with the target word replaced by ____'),
        base: z.string().describe('The root word given as a hint, e.g. "develop"'),
        answer: z.string().describe('The exact word that fits, e.g. "development"'),
        rule: z.string().describe('The spelling or grammar point in one short sentence'),
      }),
    ),
  }),
  dictation: z.object({ items: z.array(z.object({ sentence: z.string().describe('8-20 words, natural spoken campus or lecture English') })) }),
  notes: z.object({
    title: z.string(),
    text: z.string().describe('A lecture of 280-340 words, spoken style'),
    keyPoints: z.array(z.string()).describe('4-6 points a good note-taker would write down, in order'),
    questions: z.array(Question),
  }),
  implied: z.object({
    items: z.array(
      z.object({
        lines: z.array(z.object({ speaker: z.enum(['woman', 'man']), text: z.string() })).describe('2-4 short lines'),
        question: z.string().describe('About what a speaker means, implies or feels'),
        options: z.array(z.string()),
        answer: z.number(),
        explanation: z.string(),
      }),
    ),
  }),
  interview: z.object({
    topic: z.string(),
    intro: z.string().describe('One sentence the interviewer says first'),
    questions: z.array(z.string()).describe('Exactly 4, getting harder: personal, then opinion, then a broader issue'),
    models: z.array(z.string()).describe('A band 5.5-6 spoken answer to each question, 80-110 words, natural and structured: answer, reason, example, wrap-up'),
  }),
  longRepeat: z.object({ topic: z.string(), sentences: z.array(z.string()).describe('6 sentences of 12-20 words, campus life') }),
};

export type GenKind = keyof typeof GEN;
export type GenOut<K extends GenKind> = z.infer<(typeof GEN)[K]>;

export interface ToeflGenInput {
  kind: GenKind;
  /** Lower or upper module difficulty, as in the adaptive test. */
  difficulty: 'easier' | 'standard' | 'harder';
  /** A question type to include more of (from the mistake log). */
  focusType?: QuestionType;
  topic?: string;
}

/** "Compare with a band 5.5 answer" and the structure coach, for one interview answer. */
export const SpeakCompare = z.object({
  structure: z.object({ answer: z.boolean(), reason: z.boolean(), example: z.boolean(), wrapUp: z.boolean() }).describe('Which parts are really present'),
  improved: z.string().describe("The learner's own answer rewritten at band 5.5: same ideas, better language and structure, 80-110 words, natural speech"),
  changes: z.array(z.string()).describe('2-4 specific differences that raise the band'),
});
export type SpeakCompare = z.infer<typeof SpeakCompare>;
export interface SpeakCompareInput {
  question: string;
  transcript: string;
  seconds: number;
}

export const WritingScore = z.object({
  score: z.number().describe('0-5 in steps of 0.5, ETS-style rubric'),
  summary: z.string().describe('2 sentences'),
  strengths: z.array(z.string()),
  improvements: z.array(z.string()).describe('2-4 concrete changes that would raise the score'),
  corrections: z.array(ErrorItem),
  model: z.string().describe('A model response that would score 5'),
});
export type WritingScore = z.infer<typeof WritingScore>;
export interface WritingInput {
  task: 'email' | 'discussion';
  prompt: GenOut<'email'> | GenOut<'discussion'>;
  text: string;
  minutes: number;
}

const band = z.number().nullable().describe('1-6 in steps of 0.5, or null if not visible');
const s30 = z.number().nullable().describe('0-30, or null if not shown');
export const ScoreReport = z.object({
  found: z.boolean().describe('Is this a TOEFL iBT score report?'),
  testDate: z.string().nullable().describe('YYYY-MM-DD'),
  overall: band,
  reading: band,
  listening: band,
  writing: band,
  speaking: band,
  total0to120: z.number().nullable().describe('The comparable 0-120 total if shown'),
  reading30: s30,
  listening30: s30,
  writing30: s30,
  speaking30: s30,
  notes: z.string().describe('Anything unclear, in one sentence'),
});
export type ScoreReport = z.infer<typeof ScoreReport>;
export interface ScoreReportInput {
  /** Base64 image data without the data: prefix. */
  image: string;
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp';
}
