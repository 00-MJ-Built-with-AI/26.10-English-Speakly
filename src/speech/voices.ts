/** Tutor voices. HD voices sound the most human; standard ones support exact speed control in SSML. */
export interface VoiceOption {
  id: string;
  label: string;
  hd: boolean;
}

export const AZURE_VOICES: VoiceOption[] = [
  { id: 'en-US-Ava:DragonHDLatestNeural', label: 'Ava (female, warm)', hd: true },
  { id: 'en-US-Andrew:DragonHDLatestNeural', label: 'Andrew (male, warm)', hd: true },
  { id: 'en-US-Emma2:DragonHDLatestNeural', label: 'Emma (female, conversational)', hd: true },
  { id: 'en-US-Andrew2:DragonHDLatestNeural', label: 'Andrew (male, conversational)', hd: true },
  { id: 'en-US-Emma:DragonHDLatestNeural', label: 'Emma (female, bright)', hd: true },
  { id: 'en-US-Brian:DragonHDLatestNeural', label: 'Brian (male, casual)', hd: true },
  { id: 'en-US-Aria:DragonHDLatestNeural', label: 'Aria (female, clear)', hd: true },
  { id: 'en-US-Davis:DragonHDLatestNeural', label: 'Davis (male, calm)', hd: true },
  { id: 'en-US-AvaMultilingualNeural', label: 'Ava (standard)', hd: false },
  { id: 'en-US-AndrewMultilingualNeural', label: 'Andrew (standard)', hd: false },
  { id: 'en-US-EmmaMultilingualNeural', label: 'Emma (standard)', hd: false },
  { id: 'en-US-BrianMultilingualNeural', label: 'Brian (standard)', hd: false },
  { id: 'en-US-JennyNeural', label: 'Jenny (standard)', hd: false },
  { id: 'en-US-GuyNeural', label: 'Guy (standard)', hd: false },
];

export const DEFAULT_VOICE = 'en-US-Ava:DragonHDLatestNeural';

export const isHdVoice = (id: string) => id.includes(':DragonHD');

/** The standard neural voice closest to an HD voice, used if HD isn't available on the Azure resource. */
export function standardVoiceFor(id: string): string {
  if (!isHdVoice(id)) return id;
  const base = id.split(':')[0].replace(/\d+$/, '');
  return ['en-US-Ava', 'en-US-Andrew', 'en-US-Emma', 'en-US-Brian'].includes(base) ? `${base}MultilingualNeural` : `${base}Neural`;
}

/** How natural a browser voice is likely to sound (higher is better). */
export function browserVoiceRank(v: { name: string; lang: string }): number {
  let s = 0;
  if (/natural/i.test(v.name)) s += 100;
  if (/online/i.test(v.name)) s += 40;
  if (/google/i.test(v.name)) s += 30;
  if (/^en-US/i.test(v.lang)) s += 20;
  else if (/^en/i.test(v.lang)) s += 5;
  if (/david|zira|mark|hazel|george|susan/i.test(v.name) && !/natural/i.test(v.name)) s -= 50;
  return s;
}
