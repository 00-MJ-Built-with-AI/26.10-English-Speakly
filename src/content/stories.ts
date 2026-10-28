/** Word pools for the story builder: one noun, one verb and one adjective per story. */
export const STORY_WORDS = {
  noun: [
    'umbrella', 'elevator', 'passport', 'laptop', 'neighbor', 'cake', 'airport', 'key', 'meeting', 'dog', 'train', 'wallet', 'phone', 'boss', 'storm', 'restaurant', 'bicycle',
    'letter', 'hotel', 'camera', 'mistake', 'gift', 'island', 'interview', 'coffee', 'mountain', 'printer', 'stranger', 'suitcase', 'deadline', 'wedding', 'museum', 'taxi', 'password',
  ],
  verb: [
    'forget', 'discover', 'borrow', 'lose', 'promise', 'escape', 'complain', 'celebrate', 'apologize', 'break', 'hide', 'follow', 'repair', 'cancel', 'surprise', 'refuse', 'deliver',
    'recognize', 'invite', 'argue', 'explain', 'steal', 'rescue', 'whisper', 'replace', 'negotiate',
  ],
  adjective: [
    'strange', 'nervous', 'expensive', 'tiny', 'embarrassing', 'brilliant', 'noisy', 'mysterious', 'exhausted', 'generous', 'awkward', 'ancient', 'furious', 'lucky', 'empty',
    'enormous', 'polite', 'frozen', 'delicious', 'confusing', 'unexpected', 'proud',
  ],
};

export function drawWords(rand: () => number = Math.random): string[] {
  const pick = (xs: string[]) => xs[Math.floor(rand() * xs.length)];
  return [pick(STORY_WORDS.noun), pick(STORY_WORDS.verb), pick(STORY_WORDS.adjective)];
}

/** Was the word used in any common form (forgets, forgetting, forgot, nervously...)? */
export function usedWord(word: string, transcript: string): boolean {
  const t = ` ${transcript.toLowerCase().replace(/[^a-z' ]/g, ' ')} `;
  const stem = word.toLowerCase().replace(/e$/, '');
  // The last letter may double before an ending: forget -> forgetting.
  const re = new RegExp(`\\b${stem}${stem.slice(-1)}?(e|es|s|ed|d|ing|ies|ied|er|est|ly|ily)?\\b`);
  return re.test(t) || IRREGULAR[word]?.some((f) => t.includes(` ${f} `)) === true;
}

/** Past forms that don't share the stem. */
const IRREGULAR: Record<string, string[]> = {
  forget: ['forgot', 'forgotten'],
  lose: ['lost'],
  break: ['broke', 'broken'],
  hide: ['hid', 'hidden'],
  steal: ['stole', 'stolen'],
  promise: ['promised'],
};
