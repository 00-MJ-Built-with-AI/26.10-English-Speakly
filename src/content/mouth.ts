/** Mouth positions for the sound drills (simplified side view). */
export type Lips = 'open' | 'closed' | 'lip-teeth' | 'round' | 'spread';
export type Tongue = 'rest' | 'between-teeth' | 'ridge' | 'sh' | 'front-high' | 'front-mid' | 'low-front' | 'central' | 'low-back' | 'back-high' | 'bunched' | 'velar';

export interface MouthShape {
  label: string;
  lips: Lips;
  tongue: Tongue;
  /** Jaw opening, 0 (closed) to 14 (wide). */
  jaw: number;
  voiced: boolean;
  nasal?: boolean;
  /** How the air comes out. */
  air: 'none' | 'puff' | 'flow' | 'hiss';
}

export interface MouthGuide {
  target: MouthShape;
  contrast?: MouthShape;
  steps: string[];
}

export const MOUTH: Record<string, MouthGuide> = {
  'p-b': {
    target: { label: '/p/ pin', lips: 'closed', tongue: 'rest', jaw: 1, voiced: false, air: 'puff' },
    contrast: { label: '/b/ bin', lips: 'closed', tongue: 'rest', jaw: 1, voiced: true, air: 'none' },
    steps: ['Press your lips together.', 'Build up air behind them.', 'For /p/ release it as a small puff with your voice off. /b/ has the voice on and almost no puff.'],
  },
  'f-v': {
    target: { label: '/v/ van', lips: 'lip-teeth', tongue: 'rest', jaw: 2, voiced: true, air: 'flow' },
    contrast: { label: '/f/ fan', lips: 'lip-teeth', tongue: 'rest', jaw: 2, voiced: false, air: 'hiss' },
    steps: ['Rest your top teeth lightly on your lower lip.', 'Push air through the gap.', '/v/ has the voice on: you feel a buzz in your lip. /f/ is just air.'],
  },
  'th-voiceless': {
    target: { label: '/θ/ think', lips: 'open', tongue: 'between-teeth', jaw: 3, voiced: false, air: 'hiss' },
    contrast: { label: '/s/ sink', lips: 'spread', tongue: 'ridge', jaw: 2, voiced: false, air: 'hiss' },
    steps: ['Put the tip of your tongue between your teeth (you can see it in a mirror).', 'Blow air softly over it, voice off.', 'For /s/ the tongue hides behind the teeth instead.'],
  },
  'th-voiced': {
    target: { label: '/ð/ this', lips: 'open', tongue: 'between-teeth', jaw: 3, voiced: true, air: 'flow' },
    contrast: { label: '/d/ day', lips: 'open', tongue: 'ridge', jaw: 3, voiced: true, air: 'none' },
    steps: ['Same tongue as "think": tip between the teeth.', 'Turn your voice on; you feel a buzz on the tongue.', 'Don\'t press the tongue up to the ridge, or it becomes /d/.'],
  },
  'ih-ee': {
    target: { label: '/ɪ/ ship', lips: 'open', tongue: 'front-mid', jaw: 5, voiced: true, air: 'flow' },
    contrast: { label: '/i/ sheep', lips: 'spread', tongue: 'front-high', jaw: 2, voiced: true, air: 'flow' },
    steps: ['/i/: smile, tongue high and tense, a long sound.', '/ɪ/: relax your lips and drop the tongue and jaw a little.', 'Keep /ɪ/ short.'],
  },
  'e-ih': {
    target: { label: '/ɛ/ pen', lips: 'open', tongue: 'front-mid', jaw: 8, voiced: true, air: 'flow' },
    contrast: { label: '/ɪ/ pin', lips: 'open', tongue: 'front-mid', jaw: 4, voiced: true, air: 'flow' },
    steps: ['Start from /ɪ/.', 'Drop your jaw a little more; the tongue goes down with it.', 'Your mouth should feel clearly more open for "pen".'],
  },
  ae: {
    target: { label: '/æ/ cat', lips: 'spread', tongue: 'low-front', jaw: 13, voiced: true, air: 'flow' },
    contrast: { label: '/ʌ/ cut', lips: 'open', tongue: 'central', jaw: 7, voiced: true, air: 'flow' },
    steps: ['Drop your jaw wide open.', 'Spread your lips and keep the tongue low and forward.', '/ʌ/ is shorter and relaxed, with the jaw half open.'],
  },
  'ah-uh-oh': {
    target: { label: '/ɑ/ hot', lips: 'open', tongue: 'low-back', jaw: 14, voiced: true, air: 'flow' },
    contrast: { label: '/oʊ/ note (end)', lips: 'round', tongue: 'back-high', jaw: 5, voiced: true, air: 'flow' },
    steps: ['/ɑ/: open wide, like at the doctor ("ahh"), tongue low and back.', '/oʊ/: start like "o" and finish with rounded lips.', '/ʌ/ ("hut") sits in between: short and relaxed.'],
  },
  oo: {
    target: { label: '/ʊ/ full', lips: 'round', tongue: 'back-high', jaw: 5, voiced: true, air: 'flow' },
    contrast: { label: '/u/ fool', lips: 'round', tongue: 'back-high', jaw: 2, voiced: true, air: 'flow' },
    steps: ['/u/: tight, small round lips, tongue high at the back, long.', '/ʊ/: relax everything a little and keep it short.'],
  },
  r: {
    target: { label: 'American /r/', lips: 'round', tongue: 'bunched', jaw: 4, voiced: true, air: 'flow' },
    contrast: { label: 'Arabic ر (avoid)', lips: 'open', tongue: 'ridge', jaw: 4, voiced: true, air: 'none' },
    steps: ['Pull your tongue back and bunch it up; the tip touches nothing.', 'Round your lips a little.', 'Don\'t tap or roll: that is the Arabic ر.'],
  },
  'ch-sh': {
    target: { label: '/tʃ/ chip (start)', lips: 'round', tongue: 'ridge', jaw: 2, voiced: false, air: 'none' },
    contrast: { label: '/ʃ/ ship', lips: 'round', tongue: 'sh', jaw: 2, voiced: false, air: 'hiss' },
    steps: ['/tʃ/: tongue presses the ridge behind your teeth, like /t/...', '...then releases into /ʃ/.', '/ʃ/: tongue close to the ridge but not touching; a continuous hiss.'],
  },
  ng: {
    target: { label: '/ŋ/ sing', lips: 'open', tongue: 'velar', jaw: 4, voiced: true, nasal: true, air: 'flow' },
    contrast: { label: '/g/ (don\'t add)', lips: 'open', tongue: 'velar', jaw: 4, voiced: true, air: 'puff' },
    steps: ['Raise the back of your tongue to the soft palate.', 'Hum: the air goes out through your nose.', 'End there. Don\'t release the tongue with a /g/ or /k/.'],
  },
};
