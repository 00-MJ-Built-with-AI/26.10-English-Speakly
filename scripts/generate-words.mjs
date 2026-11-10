/**
 * Writes the word cards for public/words/pack-NN.json with the Message Batches API (half price).
 *
 *   node scripts/generate-words.mjs          shows what is missing and the estimated cost
 *   node scripts/generate-words.mjs --go     submits the batch, waits, and saves the packs
 *
 * Needs ANTHROPIC_API_KEY in .env.local. Safe to stop and run again: finished cards are kept in
 * scripts/.words-state.json and a batch already submitted is picked up instead of paid for twice.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'public', 'words');
const stateFile = path.join(root, 'scripts', '.words-state.json');
const PACK = 100;
const CHUNK = 20;
const MODEL = process.env.WORDS_MODEL || 'claude-opus-5-5';
const go = process.argv.includes('--go');

const envFile = path.join(root, '.env.local');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

const SYSTEM = `You write vocabulary cards for an Arabic-speaking adult learning the most used English words, in order of frequency. For each word in the list, write one card.

paragraph: 2-3 natural sentences, everyday American English simple enough for an intermediate reader, showing the most common meaning. Mark every use of the word, including inflected forms, with double asterisks: **word**. Vary the people, places and topics; keep them neutral and pleasant. Show how a function word really works rather than talking about it.
pos: noun, verb, adjective, adverb, preposition, conjunction, pronoun, determiner, number or interjection (the main use).
academic: true only if the word is typical of university textbooks and research writing rather than everyday talk.
english: the most common meaning in simple English, one short line. Do not use the word itself.
arabic: the best Modern Standard Arabic translation of that meaning, one or two words, the term an Arab learner would expect.
arabicDesc: one short sentence in Modern Standard Arabic that describes the meaning.
other: other common meanings or uses that are really different, at most 3, often none: each with meaning (short English), example (a short sentence) and arabic (a short translation). Leave out rare meanings.

Example of one card:
{"word":"place","pos":"noun","academic":false,"paragraph":"We looked for a quiet **place** to sleep near the station. The hotel was full, but the owner told us about another **place** down the road.","english":"a particular area or building where something happens","arabic":"مكان","arabicDesc":"الموضع الذي يوجد فيه شخص أو شيء أو يحدث فيه أمر ما","other":[{"meaning":"to put something somewhere (verb)","example":"Place the box on the table.","arabic":"يضع"}]}

Return the cards in the same order as the list, with word exactly as given.`;

const schema = {
  type: 'object',
  additionalProperties: false,
  required: ['cards'],
  properties: {
    cards: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['word', 'pos', 'academic', 'paragraph', 'english', 'arabic', 'arabicDesc', 'other'],
        properties: {
          word: { type: 'string' },
          pos: { type: 'string' },
          academic: { type: 'boolean' },
          paragraph: { type: 'string' },
          english: { type: 'string' },
          arabic: { type: 'string' },
          arabicDesc: { type: 'string' },
          other: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['meaning', 'example', 'arabic'],
              properties: { meaning: { type: 'string' }, example: { type: 'string' }, arabic: { type: 'string' } },
            },
          },
        },
      },
    },
  },
};

const words = JSON.parse(fs.readFileSync(path.join(dir, 'list.json'), 'utf8'));
const state = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf8')) : { cards: {} };
const save = () => fs.writeFileSync(stateFile, JSON.stringify(state));
const packFile = (n) => path.join(dir, `pack-${String(n).padStart(2, '0')}.json`);
const packDone = (n) => fs.existsSync(packFile(n));

const ARABIC = /[؀-ۿ]/;
const valid = (c, word) => c.word.toLowerCase() === word && c.paragraph.includes('**') && ARABIC.test(c.arabic) && ARABIC.test(c.arabicDesc) && c.english.length > 0;

/** Saves every pack whose 100 cards are all written, and the list of ready packs. */
function writePacks() {
  for (let n = 1; n <= words.length / PACK; n++) {
    if (packDone(n)) continue;
    const list = words.slice((n - 1) * PACK, n * PACK);
    if (list.every((w) => state.cards[w])) fs.writeFileSync(packFile(n), JSON.stringify(list.map((w) => state.cards[w])));
  }
  const ready = [];
  for (let n = 1; n <= words.length / PACK; n++) if (packDone(n)) ready.push(n);
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(ready));
  return ready;
}

writePacks();
const missing = words.filter((w, i) => !packDone(Math.ceil((i + 1) / PACK)) && !state.cards[w]);

if (!go) {
  // About 230 output tokens a card including thinking; batch prices are half the list price.
  const prices = { 'claude-opus-5-5': [2, 10], 'claude-sonnet-5-5': [1, 5] }[MODEL] ?? [2, 10];
  const out = (missing.length * 230) / 1e6;
  const inp = (Math.ceil(missing.length / CHUNK) * 1300) / 1e6;
  console.log(`${words.length - missing.length} of ${words.length} words written; ${missing.length} to go.`);
  console.log(`${Math.ceil(missing.length / CHUNK)} requests with ${MODEL}, estimated cost about $${(out * prices[1] + inp * prices[0]).toFixed(0)}.`);
  console.log('Run again with --go to write them.');
  process.exit(0);
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('ANTHROPIC_API_KEY is not set. Add it to .env.local and run this again.');
  process.exit(1);
}

const client = new Anthropic();

if (!state.batchId) {
  if (!missing.length) {
    console.log('Every word is already written.');
    process.exit(0);
  }
  state.groups = {};
  const requests = [];
  for (let i = 0; i < missing.length; i += CHUNK) {
    const id = `w${i}`;
    const group = missing.slice(i, i + CHUNK);
    state.groups[id] = group;
    requests.push({
      custom_id: id,
      params: {
        model: MODEL,
        max_tokens: 16000,
        output_config: { effort: 'low', format: { type: 'json_schema', schema } },
        system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: `Words: ${group.join(', ')}` }],
      },
    });
  }
  const batch = await client.messages.batches.create({ requests });
  state.batchId = batch.id;
  save();
  console.log(`Submitted batch ${batch.id} with ${requests.length} requests.`);
}

for (;;) {
  const batch = await client.messages.batches.retrieve(state.batchId);
  if (batch.processing_status === 'ended') break;
  console.log(`Processing: ${batch.request_counts.processing} requests left...`);
  await new Promise((r) => setTimeout(r, 60_000));
}

let good = 0;
const problems = [];
for await (const r of await client.messages.batches.results(state.batchId)) {
  const group = state.groups[r.custom_id] ?? [];
  if (r.result.type !== 'succeeded') {
    problems.push(`${r.custom_id}: ${r.result.type}`);
    continue;
  }
  const msg = r.result.message;
  if (msg.stop_reason !== 'end_turn') {
    problems.push(`${r.custom_id}: stopped with ${msg.stop_reason}`);
    continue;
  }
  const text = msg.content.find((b) => b.type === 'text')?.text ?? '';
  let cards = [];
  try {
    cards = JSON.parse(text).cards;
  } catch {
    problems.push(`${r.custom_id}: could not read the JSON`);
    continue;
  }
  for (const word of group) {
    const c = cards.find((x) => x.word.toLowerCase() === word);
    if (c && valid(c, word)) {
      state.cards[word] = { ...c, word };
      good++;
    } else problems.push(`${word}: missing or invalid card`);
  }
}
delete state.batchId;
delete state.groups;
save();
const ready = writePacks();
console.log(`Wrote ${good} cards. ${ready.length} of ${words.length / PACK} packs are ready.`);
if (problems.length) console.log(`${problems.length} problems (run again to retry them):\n${problems.slice(0, 30).join('\n')}`);
