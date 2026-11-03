import type { ArabicInput, ExplainInput, GenKind, NotesFeedbackInput, PlanCheckInput, SpeakCompareInput, ToeflGenInput, WritingInput } from '../../shared/toefl.js';

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
  paraphrase:
    'Paraphrase drill (Reading skill): 5 items. Each is one academic sentence (18-35 words) and 4 rewordings. Exactly one keeps the full meaning; the others change a cause and effect, a degree (some/all, may/will), the time, or leave out an essential part. Use different words and structures from the original in all options.',
  vocab:
    'Academic vocabulary drill: 8 words from the Academic Word List or common in university texts (for example: significant, derive, allocate, hypothesis, subsequent, inherent, comprise, notion), each in a new academic sentence, with its meaning in that context and 4 short meanings to choose from.',
  spelling:
    'Word-ending spelling drill for Complete the Words: 8 sentences, each with one word replaced by ____ and its root word as a hint. The answer needs a change of form: -tion/-sion, -ment, -ness, -ity, -ly, -ous/-ive/-al, plural -ies/-es, past -ed with doubling or y->i, third person -s, comparative. Mix them. One short rule each.',
  dictation:
    'Dictation drill (Listening): 6 sentences of 8-20 words as people say them on campus or in a lecture, with reduced forms and linking that are hard to catch (going to, want to, have to, linked consonants), numbers or names in some. Each sentence must make sense on its own.',
  notes:
    'Note-taking drill (Listening): a lecture of 280-340 words in spoken style (with signposting like "First," "The key point is," "For example") on an introductory university topic, 4-6 key points a good note-taker would write, and 4 questions answerable from good notes (main idea, two details, one relationship such as cause or contrast).',
  implied:
    'Implied meaning drill (Listening): 5 short exchanges (2-4 lines) between a woman and a man on campus where the meaning is indirect: a polite refusal, sarcasm, doubt, a hint, a hedge, an idiom. Each with a question about what someone means, implies or feels, 4 options and an explanation that names the clue.',
  interview:
    'Speaking "Take an Interview" set with model answers: a topic, a one-sentence intro, 4 questions getting harder (personal experience, then opinion, then a broader social or academic issue), and for each a band 5.5-6 model spoken answer of 80-110 words with a direct answer, a reason, a concrete example and a short wrap-up, in natural spoken English (contractions, signposting).',
  tone:
    'Email tone drill (Writing): 6 items. Each names a reader (a professor, an academic advisor, a university office, a club president, a classmate the learner does not know well) and one sentence that is too casual, too direct or too demanding for that reader (slang, "Hey", "I need you to", "ASAP", missing please, texting abbreviations), plus a better version in the right register and a one-line tip.',
  longRepeat:
    'Speaking "Listen and Repeat" long-sentence set: a campus setting and 6 sentences of 12-20 words each (getting longer), with clauses and phrases that are natural to say, as a guide or staff member would say them.',
};

export function toeflGenPrompt(i: ToeflGenInput): string {
  const focus = i.focusType && !['build', 'email', 'discussion', 'complete'].includes(i.kind) ? ` Include at least two "${i.focusType}" questions; the learner needs practice with that type.` : '';
  const topic = i.topic ? ` Topic: ${i.topic}.` : '';
  return `${TASK[i.kind]} ${LEVEL[i.difficulty]}${topic}${focus}`;
}

const LETTER = ['A', 'B', 'C', 'D'];

export function explainPrompt(i: ExplainInput): string {
  const opts = i.options.map((o, k) => `${LETTER[k]}. ${o}`).join('\n');
  const history = (i.history ?? []).map((h) => `Learner: ${h.q}\nYou: ${h.a}`).join('\n');
  const ask = i.followUp
    ? `The learner now asks: "${i.followUp}". Answer that, briefly.`
    : `Explain why ${i.picked == null ? 'the learner had no answer' : `${LETTER[i.picked]} (the learner's choice) is wrong`} and why ${LETTER[i.correct]} is right. Point to the exact words in the text that decide it, and name the trap if there is one.`;
  return `A TOEFL practice question for an Arabic-speaking learner.${i.context ? `\nText or transcript:\n---\n${i.context.slice(0, 2500)}\n---` : ''}\nQuestion: ${i.question}\n${opts}\nCorrect: ${LETTER[i.correct]}.${history ? `\n\nEarlier in this chat:\n${history}` : ''}\n\n${ask} ${i.arabic ? 'Also give the explanation in short, simple Modern Standard Arabic in "arabic".' : 'Set "arabic" to null.'}`;
}

export function arabicPrompt(i: ArabicInput): string {
  return `Translate each English explanation from a TOEFL practice app into short, simple Modern Standard Arabic for a learner. Keep English words that are being explained (quote them in English). Return exactly ${i.texts.length} items in the same order:\n${i.texts.map((t, k) => `${k + 1}. ${t}`).join('\n')}`;
}

export function notesFeedbackPrompt(i: NotesFeedbackInput): string {
  return `TOEFL note-taking practice. Lecture: "${i.title}". Key points a good note-taker would write:\n${i.keyPoints.map((p, k) => `${k + 1}. ${p}`).join('\n')}\n\nThe learner's notes (typed while listening once):\n---\n${i.notes || '(empty)'}\n---\n\nFor each key point, say whether the notes capture it in any form (abbreviations, symbols and partial words count). Then say what was missed and give 2-3 tips that fit these notes (abbreviations, structure, what to skip).`;
}

export function planCheckPrompt(i: PlanCheckInput): string {
  return `TOEFL "Academic Discussion" task: ${JSON.stringify(i.prompt)}\nIn 60 seconds the learner planned their post:\nView: ${i.view}\nReason: ${i.reason}\nExample: ${i.example}\n\nJudge the plan, not the language: is the view a clear answer to the professor's question, is the reason relevant and new (not just repeating the two students), is the example concrete and does it support the reason? Score 1-5 for how well a post from this plan could score, and give a stronger plan in note form going in the same direction.`;
}

export function speakComparePrompt(i: SpeakCompareInput): string {
  return `TOEFL "Take an Interview" answer (45 seconds; the learner spoke for ${Math.round(i.seconds)} s). Question: "${i.question}"\nTranscript of the learner's spoken answer: "${i.transcript}"\n\nMark which structure parts are really there (a direct answer to the question, a reason, a concrete example, a wrap-up). Then rewrite the learner's own answer at band 5.5: keep their ideas and examples, fix the language, and add whatever part is missing. It will be read aloud, so write natural speech.`;
}

export function writingPrompt(i: WritingInput): string {
  const rubric =
    i.task === 'email'
      ? 'Score like the TOEFL "Write an Email" rubric (0-5): 5 = all three required points done fully and clearly, appropriate tone and register for the reader, well organized, varied and accurate language with few errors; 4 = all points but some are thin or there are noticeable errors; 3 = a point is missing or unclear, or errors sometimes blur meaning; 2 or below = mostly incomplete, inappropriate or hard to understand.'
      : 'Score like the TOEFL "Write for an Academic Discussion" rubric (0-5): 5 = a relevant, well-elaborated contribution that adds to the discussion (not just repeating the students), clear explanations and examples, varied syntax and precise vocabulary, almost no errors; 4 = relevant and well developed with a few errors or lapses; 3 = mostly relevant but partly underdeveloped, or errors are noticeable; 2 or below = limited development, off-topic or many errors.';
  return `${rubric}\n\nTask: ${JSON.stringify(i.prompt)}\nThe learner had about ${i.minutes} minutes and typed (no spellcheck, as on the real test):\n"""\n${i.text}\n"""\n\nWord count matters only as development: short answers cannot score high. Give the score in steps of 0.5.`;
}
