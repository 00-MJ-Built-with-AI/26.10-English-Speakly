import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import type { z } from 'zod';
import {
  CheckResult,
  GenFast,
  GenReadAloud,
  GenShadow,
  GenToeflInterview,
  GenToeflRepeat,
  GradeResult,
  ReportResult,
  TaskResult,
  ToeflResult,
  WeeklyResult,
  type ChatInput,
  type CheckInput,
  type GenerateInput,
  type GradeInput,
  type ReportInput,
  type TaskInput,
  type ToeflInput,
  type WeeklyInput,
} from '../shared/tasks.ts';
import { errorResponse, HttpError, requireUser } from './_lib/auth.ts';
import { chatSystem, generatePrompt, TASK_SYSTEM } from './_lib/prompts.ts';

const MODEL = process.env.TUTOR_MODEL || 'claude-opus-5-5';
/** Anthropic picks a fallback model if a request is declined by a safety classifier. */
const FALLBACK = (): { betas: Anthropic.Beta.AnthropicBeta[]; fallbacks: 'default' } => ({
  betas: ['server-side-fallback-2026-07-01'],
  fallbacks: 'default',
});

let client: Anthropic | undefined;
function anthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) throw new HttpError(503, 'The AI tutor is not set up yet (ANTHROPIC_API_KEY).');
  client ??= new Anthropic();
  return client;
}

/** One tutor turn, streamed as plain text so the voice can start on the first sentence. */
function chat(input: ChatInput): Response {
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: 'user', content: '(The learner is ready. Begin.)' }];
  for (const line of input.history) {
    messages.push({ role: line.role === 'tutor' ? 'assistant' : 'user', content: line.text || '(silence)' });
  }
  if (messages[messages.length - 1].role === 'assistant') messages.push({ role: 'user', content: '(The learner says nothing. Continue.)' });

  const stream = anthropic().beta.messages.stream({
    model: MODEL,
    max_tokens: 2048,
    system: chatSystem(input),
    cache_control: { type: 'ephemeral' },
    output_config: { effort: 'low' },
    messages,
    ...FALLBACK(),
  });

  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        const final = await stream.finalMessage();
        if (final.stop_reason === 'refusal') controller.enqueue(encoder.encode(" Let's talk about something else. What did you do today?"));
      } catch (err) {
        console.error(err);
        controller.enqueue(encoder.encode('\n[[error]]'));
      }
      controller.close();
    },
    cancel() {
      stream.abort();
    },
  });
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
}

async function structured<S extends z.ZodType>(schema: S, prompt: string, effort: 'low' | 'medium'): Promise<z.infer<S>> {
  const res = await anthropic().beta.messages.parse({
    model: MODEL,
    max_tokens: 8000,
    system: TASK_SYSTEM,
    output_config: { effort, format: betaZodOutputFormat(schema) },
    messages: [{ role: 'user', content: prompt }],
    ...FALLBACK(),
  });
  if (res.stop_reason === 'refusal' || !res.parsed_output) throw new HttpError(502, 'The tutor could not grade this one. Try again.');
  return res.parsed_output as z.infer<S>;
}

const json = (v: unknown) => JSON.stringify(v, null, 1);

const TASKS: Record<string, (input: never) => Promise<unknown>> = {
  check: (i: CheckInput) =>
    structured(
      CheckResult,
      `Learner level ${i.level}. ${i.context ? `The tutor had just said: "${i.context}". ` : ''}The learner said (speech transcript): "${i.utterance}"\n\nList the real errors (grammar, wrong word, or clearly unnatural phrasing a native speaker would not use). Skip trivial things and anything that is fine in casual speech. If it is all fine, return no errors. Also score grammar and vocabulary for this utterance and estimate its CEFR level.`,
      'low',
    ),
  report: (i: ReportInput) =>
    structured(
      ReportResult,
      `Write the end-of-conversation report for this speaking session "${i.title}" (learner level ${i.level}).\n\nTranscript (with errors already spotted per turn):\n${json(i.turns)}\n\n${i.pronunciation ? `Pronunciation data from the speech engine: ${json(i.pronunciation)}\n` : ''}${i.fluency ? `Fluency data: ${json(i.fluency)}\n` : ''}\nGive scores for this session only. Corrections: the most useful 3-8, each with what they said and a better spoken version. betterPhrases: 2-4 more natural or more advanced ways to say things they said. pronunciationTips: from the pronunciation data, specific tips for Arabic speakers (empty if no data).`,
      'medium',
    ),
  grade: (i: GradeInput) =>
    structured(
      GradeResult,
      `Speaking drill at level ${i.level}. Grammar focus: ${i.grammarFocus}.\nInstruction: ${i.instruction}\nPrompt: "${i.prompt}"\nExample good answer: "${i.example}"\nLearner said: "${i.transcript}"\n\nOther correct answers are fine; it does not have to match the example. Mark correct only if the meaning fits the prompt and the target structure is used correctly.`,
      'low',
    ),
  task: (i: TaskInput) =>
    structured(
      TaskResult,
      `Level check at CEFR ${i.level}. The learner answered this question by voice for ${Math.round(i.seconds)} seconds.\nQuestion: "${i.question}"\nCan-do statements for this unit: ${json(i.canDo)}\nTranscript: "${i.transcript}"\n\nachieved = they clearly did what the can-do statements describe at ${i.level} or above (a short but relevant and mostly accurate answer is enough at A1-A2).`,
      'medium',
    ),
  toefl: (i: ToeflInput) =>
    structured(
      ToeflResult,
      `Score this new-format TOEFL iBT "Take an Interview" answer (45 seconds allowed) on the 1-6 band scale (1 ~ A1, 2 ~ A2, 3 ~ B1, 4 ~ B2, 5 ~ C1, 6 ~ C2; half bands allowed).\nQuestion: "${i.question}"\nSpoke for ${Math.round(i.seconds)} s. Transcript: "${i.transcript}"\n${i.pronunciation != null ? `Machine pronunciation score ${Math.round(i.pronunciation)}/100, fluency ${Math.round(i.fluency ?? 0)}/100.\n` : ''}Weigh delivery (fluency, intelligibility) heavily, as the real AI scoring does, plus language use and topic development.`,
      'medium',
    ),
  generate: (i: GenerateInput) => {
    const schema = { shadow: GenShadow, fast: GenFast, readaloud: GenReadAloud, 'toefl-repeat': GenToeflRepeat, 'toefl-interview': GenToeflInterview }[i.kind];
    if (!schema) throw new HttpError(400, 'Unknown kind');
    return structured(schema as z.ZodType, generatePrompt(i), 'low');
  },
  weekly: (i: WeeklyInput) =>
    structured(WeeklyResult, `Write this learner's weekly speaking report from these numbers:\n${json(i)}\nBe specific, warm and brief.`, 'low'),
};

export async function POST(request: Request): Promise<Response> {
  try {
    await requireUser(request);
    const { task, input } = (await request.json()) as { task: string; input: unknown };
    if (task === 'chat') return chat(input as ChatInput);
    const run = TASKS[task];
    if (!run) throw new HttpError(400, `Unknown task ${task}`);
    return Response.json(await run(input as never), { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return Response.json({ error: 'The tutor is busy. Try again in a moment.' }, { status: 429 });
    if (err instanceof Anthropic.AuthenticationError) return Response.json({ error: 'The Anthropic API key was rejected.' }, { status: 503 });
    if (err instanceof Anthropic.APIError) return Response.json({ error: `AI service error (${err.status}).` }, { status: 502 });
    return errorResponse(err);
  }
}
