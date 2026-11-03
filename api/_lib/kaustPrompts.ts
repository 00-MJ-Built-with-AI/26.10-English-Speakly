import type { ApplicantProfile, FacultyEmailInput, PitchInput, QaInput, SopReviewInput } from '../../shared/kaust.js';

export const KAUST_SYSTEM = `You coach an Arabic-speaking applicant to KAUST (King Abdullah University of Science and Technology, a graduate research university in Saudi Arabia) on academic English and their application. Be honest and specific, like a strong faculty mentor. Never invent facts about the applicant: use only what they gave you, and mark anything they must fill in with [brackets]. Do not invent facts about KAUST faculty or labs either; if a detail is needed, ask the applicant to check it.`;

const profile = (p: ApplicantProfile) => `Applicant: program "${p.program || 'not given'}"; research interests: ${p.interests || 'not given'}.${p.cv ? `\nCV:\n---\n${p.cv.slice(0, 3000)}\n---` : ''}`;

export function sopPrompt(i: SopReviewInput): string {
  return `${profile(i.profile)}\n\nTheir statement of purpose draft:\n---\n${i.text.slice(0, 12000)}\n---\n\nReview it as an admissions committee member would. Check each part (motivation, background, research experience, fit with the program and faculty, goals), list strengths and the most important issues, and give up to 8 sentence-level edits quoting their exact words. Focus on substance and clarity, then language (grammar, word choice, tone). Do not rewrite the whole statement.`;
}

export function facultyEmailPrompt(i: FacultyEmailInput): string {
  const task = i.draft
    ? `Improve their own draft below (keep their facts and voice; fix structure, tone and language):\n---\n${i.draft.slice(0, 4000)}\n---`
    : 'Write the email for them.';
  return `${profile(i.profile)}\n\nThey want to email Professor ${i.professor} at KAUST (research area: ${i.area})${i.work ? `, whose work they read: ${i.work}` : ''}, to ask about supervision / joining the lab. ${task}\nA good email: a specific subject line; who they are in one sentence; one or two concrete points of fit (their experience linked to the professor's work, without flattery); a clear, polite question (open positions, fit for the program, a short call); CV attached; 150-220 words. Use [brackets] for anything they must check or fill in.`;
}

export function pitchPrompt(i: PitchInput): string {
  return `${profile(i.profile)}\n\nThey gave a spoken research pitch (aim: 2 minutes for a mixed academic audience) and spoke for ${Math.round(i.seconds)} seconds. Transcript:\n"${i.transcript}"\n\nCheck the structure (problem, approach, results so far, impact), clarity for non-specialists, and pace. Write a tighter spoken version of the same pitch and three audience questions from easy to hard.`;
}

export function qaPrompt(i: QaInput): string {
  return `After this research pitch:\n"${i.pitch.slice(0, 3000)}"\nan audience member asked: "${i.question}". The applicant answered (speech transcript): "${i.transcript}". Judge the answer: did it answer the question directly first, was it clear, honest about limits, and not too long? Give a strong spoken answer in the same direction (60-100 words), using only facts from the pitch or marked [to check].`;
}
