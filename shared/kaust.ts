/** Shapes for the KAUST application coach and grad-school English practice. */
import { z } from 'zod';

export interface ApplicantProfile {
  program: string;
  interests: string;
  cv: string;
}

const Part = z.object({ present: z.boolean(), comment: z.string().describe('One sentence') });

export const SopReview = z.object({
  score: z.number().describe('1-5: how convincing this statement is for a competitive graduate program'),
  summary: z.string().describe('2-3 sentences'),
  parts: z.object({
    motivation: Part.describe('Why this field: a specific origin, not a cliche'),
    background: Part.describe('Relevant preparation with concrete results'),
    research: Part.describe('Research experience and what the applicant actually did'),
    fit: Part.describe('Why this program and specific faculty or labs'),
    goals: Part.describe('Clear goals for the degree and after'),
  }),
  strengths: z.array(z.string()),
  issues: z.array(z.string()).describe('Most important first, 3-6'),
  edits: z.array(z.object({ original: z.string(), better: z.string(), why: z.string() })).describe('Up to 8 sentence-level edits, quoting the original exactly'),
});
export type SopReview = z.infer<typeof SopReview>;
export interface SopReviewInput {
  text: string;
  profile: ApplicantProfile;
}

export const FacultyEmail = z.object({
  subject: z.string(),
  body: z.string().describe('150-220 words'),
  notes: z.array(z.string()).describe('2-4 notes: what to check, personalize or never claim'),
});
export type FacultyEmail = z.infer<typeof FacultyEmail>;
export interface FacultyEmailInput {
  professor: string;
  area: string;
  /** A paper or project of theirs the applicant read. */
  work?: string;
  profile: ApplicantProfile;
  /** The applicant's own draft to improve instead of writing from scratch. */
  draft?: string;
}

export const PitchFeedback = z.object({
  score: z.number().describe('1-5 as a 2-minute research pitch to a mixed academic audience'),
  parts: z.object({ problem: z.boolean(), approach: z.boolean(), results: z.boolean(), impact: z.boolean() }),
  feedback: z.string().describe('2-3 sentences on clarity, pace and structure'),
  tips: z.array(z.string()),
  improved: z.string().describe('A tighter version of the same pitch, about 220-260 words, spoken style'),
  questions: z.array(z.string()).describe('Exactly 3 questions an audience would ask after this pitch, from easy to hard'),
});
export type PitchFeedback = z.infer<typeof PitchFeedback>;
export interface PitchInput {
  transcript: string;
  seconds: number;
  profile: ApplicantProfile;
}

export const QaFeedback = z.object({
  score: z.number().describe('1-5'),
  feedback: z.string().describe('2 sentences: did it answer the question directly, was it clear and honest'),
  better: z.string().describe('A strong spoken answer in the same direction, 60-100 words'),
});
export type QaFeedback = z.infer<typeof QaFeedback>;
export interface QaInput {
  pitch: string;
  question: string;
  transcript: string;
}

export const RecBrief = z.object({
  email: z.string().describe('A short, polite email asking for (or thanking for) the letter, with the brief attached; 90-150 words'),
  highlights: z.array(z.string()).describe('3-5 things the recommender could speak to, each tied to something concrete they saw'),
  facts: z.array(z.string()).describe('Dates, courses, projects, results and links the recommender may want to cite, only from what the applicant gave'),
});
export type RecBrief = z.infer<typeof RecBrief>;
export interface RecBriefInput {
  recommender: { name: string; relation: string; together: string; deadline: string; status: string };
  profile: ApplicantProfile;
}
