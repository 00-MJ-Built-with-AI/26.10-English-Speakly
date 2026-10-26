/**
 * Stand-ins for the AI tutor when no Anthropic key is set (local test mode). They keep every
 * screen usable and are clearly simpler than the real tutor; the UI shows a "test mode" badge.
 */
import type { ChatInput, ErrorItem, GenerateOutputs, TaskMap, TaskName } from '../../shared/tasks.ts';
import { countWords, wordAccuracy, words } from '../engine/text.ts';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const QUESTIONS = [
  'Nice to meet you! What do you do for work?',
  'Interesting. What does a normal workday look like for you?',
  'What was the most difficult part of your week?',
  'If you could change one thing about your job, what would it be?',
  'How do you usually prepare for an important meeting?',
  'Tell me about a project you are proud of.',
  'What are your plans for the weekend?',
];

export async function offlineChat(input: ChatInput, onText: (p: string) => void, signal?: AbortSignal): Promise<string> {
  const learnerTurns = input.history.filter((h) => h.role === 'learner').length;
  let reply: string;
  if (input.kind === 'roleplay' && input.scenario && learnerTurns === 0) {
    reply = `(Test mode) Let's begin. I'm ${input.scenario.aiRole}. ${input.scenario.setting}. Over to you!`;
  } else if (learnerTurns >= 8 && input.kind === 'roleplay') {
    reply = 'Thanks, that sounds good. End of role-play.';
  } else {
    reply = (learnerTurns === 0 ? 'Hi! I am your practice tutor in test mode. ' : 'I see. ') + QUESTIONS[learnerTurns % QUESTIONS.length];
  }
  let out = '';
  for (const piece of reply.match(/\S+\s*/g) ?? []) {
    if (signal?.aborted) break;
    await sleep(25);
    out += piece;
    onText(piece);
  }
  return out;
}

/** A few very common error patterns, so test mode shows how corrections look. */
const PATTERNS: [RegExp, (m: RegExpMatchArray) => string, string][] = [
  [/\bi am agree\b/i, () => 'I agree', '"Agree" is a verb; no "am".'],
  [/\b(he|she|it) (go|do|have|work|like|want)\b/i, (m) => `${m[1]} ${m[2] === 'have' ? 'has' : m[2] === 'do' ? 'does' : m[2] === 'go' ? 'goes' : m[2] + 's'}`, 'He/she/it takes -s in the present simple.'],
  [/\bpeople is\b/i, () => 'people are', '"People" is plural.'],
  [/\bdiscuss about\b/i, () => 'discuss', '"Discuss" takes no "about".'],
  [/\bmore (better|easier|faster)\b/i, (m) => m[1], 'Do not use "more" with -er comparatives.'],
  [/\byesterday i go\b/i, () => 'yesterday I went', 'Use the past simple for yesterday.'],
];

function findErrors(text: string): ErrorItem[] {
  const out: ErrorItem[] = [];
  for (const [re, fix, why] of PATTERNS) {
    const m = text.match(re);
    if (m) out.push({ original: m[0], corrected: fix(m), explanation: why, kind: 'grammar' });
  }
  return out;
}

function levelScore(text: string): number {
  const w = words(text);
  if (!w.length) return 0;
  const long = w.filter((x) => x.length >= 7).length / w.length;
  return Math.max(20, Math.min(85, 35 + Math.min(w.length, 60) * 0.4 + long * 60));
}

const cefrOf = (s: number) => (s <= 30 ? 'A1' : s <= 40 ? 'A2' : s <= 50 ? 'B1' : s <= 60 ? 'B2' : s <= 70 ? 'C1' : 'C2') as 'A1';

const GEN: GenerateOutputs = {
  shadow: {
    sentences: [
      'Could you send me the file before the meeting?',
      "I'll look into it and get back to you this afternoon.",
      'We finished the first part of the project last week.',
      'I think we should focus on the most urgent issues first.',
      'Let me share my screen so everyone can see the numbers.',
      "That's a good point, but I see it a little differently.",
    ],
  },
  fast: {
    items: [
      { instruction: 'Answer in the past simple.', prompt: 'What did you do last weekend?', example: 'I visited my family and watched a movie.' },
      { instruction: 'Make it more polite.', prompt: 'Send me the report.', example: 'Could you send me the report, please?' },
      { instruction: 'Make it a question.', prompt: 'You finished the task.', example: 'Have you finished the task?' },
      { instruction: 'Answer with "I have been ... for ...".', prompt: 'How long have you worked here?', example: 'I have been working here for two years.' },
    ],
  },
  readaloud: {
    title: 'A busy Monday',
    text: 'Every Monday, our team starts the week with a short meeting. We talk about what we finished last week and what we plan to do next. Sometimes there are problems, and we try to solve them together. After the meeting, I check my email, answer a few questions, and start working on my most important task.',
  },
  'toefl-repeat': {
    topic: 'Library orientation',
    sentences: [
      'Welcome to the main library.',
      'Please show your student card at the desk.',
      'Group study rooms are on the second floor.',
      'You can borrow up to ten books at one time.',
      'Laptops are available for students who need them for class.',
      'If a book is missing, a librarian can order it from another campus.',
      'Remember that the quiet zone on the third floor closes one hour before the rest of the building.',
    ],
  },
  retell: {
    title: 'Team update',
    text: "Quick update from the product team. We launched the new mobile app on Monday, and so far about four thousand people have downloaded it. The biggest complaint is that the login is slow, so the engineers are fixing that this week. Also, the marketing campaign is moving from March to April because the videos aren't ready yet. If you have feedback on the app, please send it to Sara by Friday.",
    keyPoints: ['The new mobile app launched on Monday', 'About 4,000 downloads so far', 'Main complaint: slow login, being fixed this week', 'Marketing campaign moved from March to April', 'Send feedback to Sara by Friday'],
  },
  'toefl-interview': {
    topic: 'Studying online',
    intro: 'A university is researching how students feel about online classes.',
    questions: [
      'Have you ever taken a class online? Tell me about it.',
      'Do you think online classes are as effective as classes in a classroom? Why?',
      'What could teachers do to make online classes more engaging?',
      'How do you think university education will change in the next twenty years?',
    ],
  },
};

export async function offlineTask<K extends TaskName>(task: K, input: TaskMap[K][0]): Promise<TaskMap[K][1]> {
  await sleep(300);
  const i = input as never as Record<string, unknown>;
  switch (task) {
    case 'check': {
      const u = String(i.utterance ?? '');
      const s = levelScore(u);
      const errs = findErrors(u);
      return { errors: errs, grammarScore: Math.max(20, s - errs.length * 12), vocabularyScore: s, cefr: cefrOf(s) } as TaskMap[K][1];
    }
    case 'grade': {
      const t = String(i.transcript ?? '');
      const sim = wordAccuracy(String(i.example ?? ''), t);
      const errs = findErrors(t);
      const ok = countWords(t) >= 3 && errs.length === 0 && sim > 0.35;
      return {
        correct: ok,
        usedTarget: sim > 0.35,
        corrected: errs.length ? errs.reduce((acc, e) => acc.replace(e.original, e.corrected), t) : String(i.example),
        feedback: ok ? '(Test mode) Looks right.' : `(Test mode) Compare with: "${String(i.example)}"`,
        grammarScore: ok ? 75 : 45,
        vocabularyScore: levelScore(t),
      } as TaskMap[K][1];
    }
    case 'task': {
      const t = String(i.transcript ?? '');
      const s = levelScore(t);
      return {
        achieved: countWords(t) >= 12,
        grammarScore: s,
        vocabularyScore: s,
        coherenceScore: Math.min(90, 30 + countWords(t)),
        cefr: cefrOf(s),
        feedback: '(Test mode) Real feedback appears once the AI tutor key is added.',
        corrections: findErrors(t),
      } as TaskMap[K][1];
    }
    case 'toefl': {
      const t = String(i.transcript ?? '');
      const n = countWords(t);
      const band = Math.max(1, Math.min(6, Math.round((1 + n / 18 + ((i.fluency as number) ?? 50) / 50) * 2) / 2));
      return {
        band,
        delivery: '(Test mode) Estimated from length and fluency only.',
        languageUse: '(Test mode)',
        topicDevelopment: `${n} words in ${Math.round(Number(i.seconds))} s.`,
        tip: 'Aim for 80-110 words: answer, give a reason, add an example.',
        corrections: findErrors(t),
      } as TaskMap[K][1];
    }
    case 'generate':
      return GEN[(i.kind as keyof GenerateOutputs) ?? 'shadow'] as TaskMap[K][1];
    case 'report': {
      const turns = (i.turns as { role: string; text: string; errors?: ErrorItem[] }[]) ?? [];
      const said = turns.filter((t) => t.role === 'learner');
      const all = said.flatMap((t) => t.errors ?? []);
      const s = levelScore(said.map((t) => t.text).join(' '));
      return {
        summary: `(Test mode) You took ${said.length} turns. Add the AI key for a real report.`,
        grammar: Math.max(20, s - all.length * 5),
        vocabulary: s,
        taskAchievement: Math.min(90, 30 + said.length * 8),
        cefr: cefrOf(s),
        strengths: said.length ? ['You kept the conversation going.'] : [],
        corrections: all.map((e) => ({ said: e.original, better: e.corrected, why: e.explanation, kind: e.kind })),
        betterPhrases: [],
        pronunciationTips: [],
        nextFocus: ['Answer with two or three sentences each time.'],
        learnerFacts: [],
      } as TaskMap[K][1];
    }
    case 'journal': {
      const t = String(i.transcript ?? '');
      const s = levelScore(t);
      return {
        feedback: `(Test mode) You spoke ${countWords(t)} words. Real feedback appears once the AI tutor key is added.`,
        corrections: findErrors(t),
        polished: findErrors(t).reduce((acc, e) => acc.replace(e.original, e.corrected), t),
        phrases: [{ phrase: 'to be honest', meaning: 'used before saying what you really think', example: "To be honest, I didn't enjoy it much." }],
        grammarScore: s,
        vocabularyScore: s,
        cefr: cefrOf(s),
      } as TaskMap[K][1];
    }
    case 'better': {
      const t = String(i.text ?? '');
      return {
        understood: i.language === 'ar' ? '(Test mode) Arabic needs the AI key to translate.' : t,
        versions: [
          { text: t || 'Could you give me a bit more time on this?', style: 'everyday', note: '(Test mode)' },
          { text: 'Would it be possible to have a little more time on this?', style: 'professional', note: '(Test mode) example' },
          { text: 'I need more time.', style: 'concise', note: '(Test mode) example' },
        ],
        phrases: [{ phrase: 'would it be possible to', meaning: 'a polite way to ask for something', example: 'Would it be possible to move the meeting?' }],
      } as TaskMap[K][1];
    }
    case 'retell': {
      const t = String(i.transcript ?? '');
      const points = (i.keyPoints as string[]) ?? [];
      const covered = points.map((p) => wordAccuracy(p, t) > 0.3);
      const s = levelScore(t);
      return {
        covered,
        contentScore: points.length ? Math.round((covered.filter(Boolean).length / points.length) * 100) : 0,
        languageScore: s,
        feedback: '(Test mode) Key points are matched by shared words only. Add the AI key for real feedback.',
        betterRetell: String(i.text ?? ''),
        corrections: findErrors(t),
      } as TaskMap[K][1];
    }
    case 'define':
      return { meaning: '(Test mode) Add the AI key to get meanings automatically.', example: String(i.phrase ?? '') } as TaskMap[K][1];
    case 'weekly':
      return {
        headline: '(Test mode) Your week',
        body: `You practised ${Math.round(Number(i.minutes))} minutes on ${String(i.activeDays)} days.`,
        focus: ['Keep the streak going.'],
      } as TaskMap[K][1];
  }
  throw new Error(`Unknown task ${task}`);
}
