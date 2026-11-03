import type { GenKind, ToeflGenInput, WritingInput } from '../../shared/toefl.js';

/** System prompt for writing TOEFL-style practice: original items in the 2026 formats. */
export const TOEFL_ITEM_SYSTEM = `You write original practice material for the new TOEFL iBT (2026 format) for a learner whose first language is Arabic and who is preparing to study at a graduate university (KAUST). Match the real task formats, lengths and difficulty closely, but never copy or paraphrase real ETS test items. Use American English. Multiple-choice questions have exactly 4 options, one clearly correct answer, and plausible distractors (wrong because of a specific detail, not because they are silly). Vary the position of the correct answer.`;

const LEVEL: Record<ToeflGenInput['difficulty'], string> = {
  easier: 'Difficulty: like the lower module (roughly CEFR B1): clear, common vocabulary.',
  standard: 'Difficulty: medium (roughly CEFR B2).',
  harder: 'Difficulty: like the upper module (roughly CEFR C1): denser texts, academic vocabulary, more inference.',
};

const TASK: Record<GenKind, string> = {
  complete:
    'Task "Complete the Words" (Reading): write one academic paragraph (70-100 words) on a university topic. Choose 10 words, in order of appearance, from the second sentence onward, each at least 4 letters, whose second half the test taker must type. Prefer a mix of content and function words, like the real C-test style.',
  daily:
    'Task "Read in Daily Life" (Reading): one short everyday text (an email, notice, menu, schedule, text message or social media post) of 40-120 words, with 3 questions (details, purpose, inference).',
  academic:
    'Task "Read an Academic Passage" (Reading): one passage of about 200 words from an introductory university subject (life sciences, history, business, social science, earth science), with 5 questions: main idea, detail, inference, vocabulary in context, and the purpose or organization of a sentence or paragraph.',
  response:
    'Task "Listen and Choose a Response" (Listening): 6 items. Each is one thing a person says in daily or campus life (a question, request or remark of up to about 15 words) and 4 written replies; exactly one is a natural, appropriate reply. Distractors repeat words from the prompt or answer a different question.',
  conversation:
    'Task "Listen to a Conversation" (Listening): a natural conversation of 8-12 short lines between a woman and a man (students, a student and staff, or friends) about campus or daily life, with 3 questions (main topic, detail, what someone will probably do next or what they imply).',
  announcement:
    'Task "Listen to an Announcement" (Listening): a campus or classroom announcement of 80-140 words by a named speaker role, with 3 questions (purpose, detail, what listeners should do).',
  talk:
    'Task "Listen to an Academic Talk" (Listening): a short lecture of 200-250 words as a professor would say it (spoken style, with an example), with 4 questions: main idea, detail, why the professor mentions something, and an inference or the professor\'s attitude.',
  build:
    'Task "Build a Sentence" (Writing): 6 items. Each has a short thing someone says (context) and a correct reply sentence of 7-14 words. Split the reply into 5-8 chunks (single words or short phrases) in the correct order. Use structures that test word order: questions, indirect questions, relative clauses, passive voice, phrasal verbs, adverbs.',
  email:
    'Task "Write an Email" (Writing): a realistic academic or campus situation where the learner must write an email (to a professor, an office, a classmate or a club) and exactly 3 things the email must do (e.g. explain a problem, ask for something, suggest a solution). The real test allows about 7 minutes.',
  discussion:
    'Task "Write for an Academic Discussion" (Writing): a university course, a professor post that asks an open question (60-90 words), and exactly 2 student posts with different views (40-70 words each, with first names). The learner must contribute their own view in about 100+ words in about 10 minutes.',
};

export function toeflGenPrompt(i: ToeflGenInput): string {
  const focus = i.focusType && !['build', 'email', 'discussion', 'complete'].includes(i.kind) ? ` Include at least two "${i.focusType}" questions; the learner needs practice with that type.` : '';
  const topic = i.topic ? ` Topic: ${i.topic}.` : '';
  return `${TASK[i.kind]} ${LEVEL[i.difficulty]}${topic}${focus}`;
}

export function writingPrompt(i: WritingInput): string {
  const rubric =
    i.task === 'email'
      ? 'Score like the TOEFL "Write an Email" rubric (0-5): 5 = all three required points done fully and clearly, appropriate tone and register for the reader, well organized, varied and accurate language with few errors; 4 = all points but some are thin or there are noticeable errors; 3 = a point is missing or unclear, or errors sometimes blur meaning; 2 or below = mostly incomplete, inappropriate or hard to understand.'
      : 'Score like the TOEFL "Write for an Academic Discussion" rubric (0-5): 5 = a relevant, well-elaborated contribution that adds to the discussion (not just repeating the students), clear explanations and examples, varied syntax and precise vocabulary, almost no errors; 4 = relevant and well developed with a few errors or lapses; 3 = mostly relevant but partly underdeveloped, or errors are noticeable; 2 or below = limited development, off-topic or many errors.';
  return `${rubric}\n\nTask: ${JSON.stringify(i.prompt)}\nThe learner had about ${i.minutes} minutes and typed (no spellcheck, as on the real test):\n"""\n${i.text}\n"""\n\nWord count matters only as development: short answers cannot score high. Give the score in steps of 0.5.`;
}
