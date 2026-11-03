/** Strategy lessons for each TOEFL 2026 question type (written for this app). */
import type { Section } from '../engine/toeflScale.ts';

export interface Lesson {
  id: string;
  section: Section;
  title: string;
  /** What the task or question type measures. */
  tests: string;
  steps: string[];
  traps: string[];
  /** A short worked example: the item and how to think it through. */
  example: { item: string; thinking: string };
  practice: string;
}

export const LESSONS: Lesson[] = [
  // Reading
  {
    id: 'complete-words',
    section: 'reading',
    title: 'Complete the Words',
    tests: 'Grammar and spelling in context: you see the first half of a word and type the rest.',
    steps: [
      'Read the whole paragraph once before typing, so you know the topic.',
      'For each gap, decide the part of speech first: noun, verb, adjective or adverb? Singular or plural? Past or present?',
      'Then choose the word that fits the meaning and the letters you see.',
      'Type the exact ending: -tion, -ment, -ness, -ly, -ed, -ies. One wrong letter is a wrong answer.',
    ],
    traps: ['Missing a plural -s or past -ed when the grammar needs it.', 'Short function words (the, with, their) are gaps too, and easy to rush.', 'Spellcheck is off on the test: practise without it.'],
    example: { item: 'Reefs are bui__ by tiny animals…', thinking: '"are ___ by" is passive, so a past participle: built. The letters "bui" fit "built".' },
    practice: '/toefl/reading/practice?task=complete',
  },
  {
    id: 'daily-life',
    section: 'reading',
    title: 'Read in Daily Life',
    tests: 'Understanding short everyday texts: notices, emails, schedules, posts.',
    steps: ['Look at the format first (email, notice, menu): it tells you the purpose.', 'Read the questions, then scan the text for the exact part each one asks about.', 'For "why" and "what will happen" questions, look for words like because, so, starting, must, may.'],
    traps: ['Options that use words from the text but change a detail (a date, a place, who does what).', 'Choosing what is true in real life instead of what the text says.'],
    example: { item: 'Notice: "Rooms can be booked online, up to three days in advance." Q: How far ahead can students book?', thinking: '"up to three days" means three days at most. An option saying "a week" reuses the idea of booking but changes the detail.' },
    practice: '/toefl/reading/practice?task=daily',
  },
  {
    id: 'main-idea',
    section: 'reading',
    title: 'Main idea questions',
    tests: 'Whether you see what the whole passage is about, not one part.',
    steps: ['Read the first sentence of each paragraph and the last sentence of the passage.', 'Say the topic in 5-8 words in your head before looking at the options.', 'Pick the option that covers the whole passage.'],
    traps: ['An option that is true but only describes one paragraph.', 'An option that is too broad (about the whole field, not this passage).'],
    example: { item: 'A passage on the printing press: its invention, then several paragraphs of effects.', thinking: '"How Gutenberg built the press" is only the first part. "Effects of the printing press" covers most of it.' },
    practice: '/toefl/reading/practice?task=academic',
  },
  {
    id: 'detail',
    section: 'reading',
    title: 'Detail questions',
    tests: 'Finding a fact that is stated in the text.',
    steps: ['Find a key word from the question (a name, a number, a term) in the text.', 'Read the full sentence around it, and the one after.', 'Match the meaning, not the words: the right answer is usually a paraphrase.'],
    traps: ['The option that copies text words exactly but changes the meaning.', 'Some/all, may/will, often/always: one small word makes an option wrong.'],
    example: { item: 'Text: "Within fifty years, millions of books had been printed." Q: What happened within fifty years?', thinking: '"Millions of books were printed" is the paraphrase. "Everyone learned to read" goes further than the text.' },
    practice: '/toefl/reading/practice?task=academic',
  },
  {
    id: 'inference',
    section: 'reading',
    title: 'Inference questions',
    tests: 'What must be true from the text even though it is not said directly.',
    steps: ['Find the part of the text the question points to.', 'Ask: what does this sentence tell me without saying it?', 'Check each option: can I point to the sentence that proves it? If not, reject it.'],
    traps: ['Options that need outside knowledge or a big jump.', 'Extreme words (never, all, completely) are usually wrong in inference.'],
    example: { item: 'Text: "The change was gradual: many people still could not read." Q: What can be inferred?', thinking: '"The impact took time to reach everyone" follows directly. "Printing ended handwriting immediately" contradicts "gradual".' },
    practice: '/toefl/reading/practice?task=academic',
  },
  {
    id: 'vocabulary',
    section: 'reading',
    title: 'Vocabulary in context',
    tests: 'The meaning of a word in this sentence (often not its most common meaning).',
    steps: ['Cover the word and guess the meaning from the sentence.', 'Put each option into the sentence and reread.', 'Pick the one that keeps the sentence meaning; ignore options that are only related to the topic.'],
    traps: ['The most common meaning of the word may not fit this context.', 'An option that sounds similar (affect/effect, adapt/adopt).'],
    example: { item: '"new ideas could circulate across countries" — circulate means…', thinking: 'Ideas moving across countries: "spread". "Repeat" or "compete" do not fit.' },
    practice: '/toefl/reading/vocab',
  },
  {
    id: 'purpose',
    section: 'reading',
    title: 'Purpose and organization',
    tests: 'Why the writer includes a sentence, example or paragraph, and how parts connect.',
    steps: ['Look at the sentence before and after the part in the question.', 'Name its job: example, contrast, cause, result, definition, support for a claim.', 'Signal words help: for example, however, as a result, in contrast, this means.'],
    traps: ['Options that describe what the sentence says instead of why it is there.'],
    example: { item: 'Why does the author mention the scientific revolution?', thinking: 'It follows "some historians argue": it is an example of a big effect some link to printing.' },
    practice: '/toefl/reading/practice?task=academic',
  },
  {
    id: 'paraphrase',
    section: 'reading',
    title: 'Paraphrasing: the skill behind most questions',
    tests: 'Recognizing the same meaning in different words: the correct answers in Reading and Listening are usually paraphrases.',
    steps: ['Find the core: who does what, and why or with what result.', 'Check the qualifiers: some/most/all, may/will, before/after, because/although.', 'Reject options that change one of these or leave out an essential part.'],
    traps: ['Reversed cause and effect.', 'A missing "not" or a changed degree (a small rise vs a large rise).'],
    example: { item: '"A modest increase may reduce turnover without significantly raising unemployment."', thinking: 'A good paraphrase keeps "small", "could" and both effects. "Economists agree it will" changes the degree and the certainty.' },
    practice: '/toefl/reading/paraphrase',
  },
  // Listening
  {
    id: 'choose-response',
    section: 'listening',
    title: 'Listen and Choose a Response',
    tests: 'Understanding what someone means in one spoken line and picking a natural reply.',
    steps: ['Decide what kind of line it is: a question, a request, an offer, a complaint, news.', 'For questions, note the question word: when, where, why, who, how long.', 'Pick the reply a real person would say, even if it shares no words with the prompt.'],
    traps: ['Replies that repeat words from the prompt (a sound trap).', 'Replies that answer a different question word (where vs when).'],
    example: { item: '"Do you know when the library closes tonight?"', thinking: 'A "when" question: "I think it\'s open until ten" answers it. "It\'s on the second floor" answers "where".' },
    practice: '/toefl/listening/practice?task=response',
  },
  {
    id: 'conversation',
    section: 'listening',
    title: 'Listen to a Conversation',
    tests: 'Following a campus conversation: the problem, the details, and what will happen next.',
    steps: ['In the first two lines, catch why they are talking (a problem, a request, plans).', 'Note decisions and changes of mind: "Actually…", "In that case…", "So I\'ll…".', 'The last lines usually tell you what someone will do next.'],
    traps: ['The first solution mentioned is often rejected later.', 'Tone matters: "Well, I guess…" means doubt.'],
    example: { item: 'Student: "Can I switch lab sections?" Staff: "Thursday is full, but Friday has space."', thinking: 'The likely next step is switching to Friday, not Thursday.' },
    practice: '/toefl/listening/practice?task=conversation',
  },
  {
    id: 'announcement',
    section: 'listening',
    title: 'Listen to an Announcement',
    tests: 'The purpose of a campus announcement and what listeners must do.',
    steps: ['The first sentence usually gives the purpose: a change, an event, a reminder.', 'Write down times, places, deadlines and any "you need to / make sure".', 'Expect a question about what listeners should do.'],
    traps: ['Mixing up two times or places mentioned.'],
    example: { item: '"Due to repairs, the career fair moves to the gym. Bring your student ID."', thinking: 'Purpose: a change of place. Action: bring your ID.' },
    practice: '/toefl/listening/practice?task=announcement',
  },
  {
    id: 'academic-talk',
    section: 'listening',
    title: 'Listen to an Academic Talk',
    tests: 'The main idea of a short lecture, key details, why the professor says something, and their attitude.',
    steps: ['The topic comes early: "Today I want to talk about…".', 'Signposts mark key points: "First", "The key point is", "For example", "So".', 'Note examples and what they illustrate: questions often ask why an example is mentioned.'],
    traps: ['Details from an example offered as the main idea.', 'Missing the professor\'s opinion in words like "surprisingly", "of course", "I\'m not convinced".'],
    example: { item: 'Professor: "Ironically, air conditioners make the outside air even warmer."', thinking: 'Why mention AC? To show human activity adds heat. "Ironically" shows the professor finds it surprising.' },
    practice: '/toefl/listening/practice?task=talk',
  },
  {
    id: 'implied',
    section: 'listening',
    title: 'Implied meaning and attitude',
    tests: 'What speakers mean without saying it: polite refusals, doubt, hints, irony.',
    steps: ['Ask: did they answer directly? If not, what does the indirect answer suggest?', 'Listen to tone and fillers: "Well…", "I suppose", "Sure… if you want".', 'A reason instead of yes/no usually means no.'],
    traps: ['Taking polite words literally ("It\'s… interesting" is rarely praise).'],
    example: { item: '"Are you coming tonight?" — "I have a paper due at nine tomorrow."', thinking: 'A reason, not a yes: he probably won\'t come.' },
    practice: '/toefl/listening/implied',
  },
  {
    id: 'note-taking',
    section: 'listening',
    title: 'Note-taking',
    tests: 'Keeping key points from audio you hear only once.',
    steps: ['Write the topic, then one line per signposted point.', 'Use short forms: b/c (because), → (leads to), ↑ ↓ (increase, decrease), e.g., vs.', 'Write examples in 2-3 words and what they show.', 'Don\'t write full sentences: you\'ll miss the next point.'],
    traps: ['Writing down everything in the first minute and missing the main points later.'],
    example: { item: '"Asphalt absorbs heat during the day and releases it slowly at night."', thinking: 'Note: "asphalt: absorb heat day → release night".' },
    practice: '/toefl/listening/notes',
  },
  // Writing
  {
    id: 'build-sentence',
    section: 'writing',
    title: 'Build a Sentence',
    tests: 'Word order and grammar: putting given pieces into a correct reply.',
    steps: ['Read the context: is the reply a question, an answer, an indirect question?', 'Find the subject and the main verb first, then add objects and phrases.', 'Check special orders: indirect questions keep statement order ("Do you know where the office is?"), adverbs of frequency go before the main verb.'],
    traps: ['Question order inside an indirect question ("where is the office" is wrong there).', 'Leaving a phrase at the end that belongs after the verb.'],
    example: { item: 'Pieces: [the office is] [do you know] [where]', thinking: 'Indirect question: "Do you know where the office is?" — not "where is the office".' },
    practice: '/toefl/writing/practice?task=build',
  },
  {
    id: 'email',
    section: 'writing',
    title: 'Write an Email (7 minutes)',
    tests: 'Doing three required things clearly, with the right tone for the reader.',
    steps: ['Minute 1: number the three points and decide one sentence for each.', 'Greeting and purpose in the first line: "Dear Professor Lin, I\'m writing to ask…".', 'One short paragraph per point, with a detail or reason each.', 'Polite closing: "Thank you for your time. Best regards,". Leave 1 minute to check.'],
    traps: ['Missing one of the three points: that alone lowers the score a lot.', 'Too informal for a professor ("Hey", "gonna").'],
    example: { item: 'Points: explain why you missed the quiz, ask to make it up, suggest a time.', thinking: 'Three short paragraphs, each starting with the point: "I missed… because…", "Would it be possible…", "I am free on…".' },
    practice: '/toefl/writing/practice?task=email',
  },
  {
    id: 'discussion',
    section: 'writing',
    title: 'Academic Discussion (10 minutes)',
    tests: 'Adding your own well-supported view to a class discussion.',
    steps: ['State your view in the first sentence.', 'Refer to one classmate: "I see Sara\'s point about cost, but…".', 'Give one main reason and develop it with a specific example (100-130 words).', 'End with one sentence that connects back to the professor\'s question.'],
    traps: ['Repeating the students\' ideas without adding anything new.', 'Too short: under about 100 words rarely scores high.'],
    example: { item: 'Professor asks: digital or paper textbooks?', thinking: '"I partly agree with Omar…" then a new reason (e.g. long-term cost for students who resell books) with an example.' },
    practice: '/toefl/writing/practice?task=discussion',
  },
  // Speaking
  {
    id: 'listen-repeat',
    section: 'speaking',
    title: 'Listen and Repeat',
    tests: 'Hearing and saying a sentence exactly: accuracy, pronunciation and rhythm.',
    steps: ['Listen for the meaning, not single words: meaning helps you remember.', 'Repeat in chunks with the same stress and pauses you heard.', 'Keep small words: the, a, to, have been. Missing them costs points.', 'Start right away and keep going; don\'t restart mid-sentence.'],
    traps: ['Dropping endings (-s, -ed): common for Arabic speakers.', 'Changing words to synonyms: the task scores exact repetition.'],
    example: { item: '"Students can print up to fifty pages a week for free using their campus ID card."', thinking: 'Chunks: "Students can print / up to fifty pages a week / for free / using their campus ID card."' },
    practice: '/toefl/speaking/long',
  },
  {
    id: 'interview',
    section: 'speaking',
    title: 'Take an Interview (45 seconds)',
    tests: 'Answering right away with a clear, developed answer.',
    steps: ['Answer the question in the first sentence.', 'Give one reason: "The main reason is…".', 'Give a concrete example from your life: "For example, last semester…".', 'Wrap up in one sentence if there is time: "So for me…".'],
    traps: ['Long thinking pauses at the start: start with the answer, think while you give the reason.', 'Two reasons with no example: one developed reason scores better.'],
    example: { item: '"Do you prefer taking notes by hand or on a laptop?"', thinking: '"By hand. The main reason is it makes me summarize. For example, in statistics… So handwriting works better for me."' },
    practice: '/toefl/speaking/coach',
  },
];

export const lessonsFor = (s: Section) => LESSONS.filter((l) => l.section === s);
