/** Microphone and room check: is the setup good enough for fair pronunciation scores? */
export interface MicCheckResult {
  at: number;
  /** Background level while silent, dBFS. */
  noiseDb: number;
  /** Speaking level, dBFS (loud part of speech). */
  speechDb: number;
  /** How much the mic level rose while the tutor's voice played (echo / speakers). */
  echoRiseDb: number | null;
  /** Share of the test sentence recognised correctly, 0-1. */
  recognized: number | null;
  issues: { level: 'bad' | 'warn'; text: string }[];
  ok: boolean;
}

export function dbfs(rms: number): number {
  return rms > 0 ? Math.max(-100, 20 * Math.log10(rms)) : -100;
}

/** Robust "loud part" of a series of levels. */
export function percentile(xs: number[], p: number): number {
  if (!xs.length) return -100;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
}

export function micVerdict(noiseDb: number, speechDb: number, echoRiseDb: number | null, recognized: number | null): Omit<MicCheckResult, 'at'> {
  const issues: MicCheckResult['issues'] = [];
  if (noiseDb > -30) issues.push({ level: 'bad', text: 'The room is very noisy. Move somewhere quieter, or close windows and turn off fans.' });
  else if (noiseDb > -42) issues.push({ level: 'warn', text: 'There is some background noise. A quieter place will give fairer scores.' });
  if (speechDb < -42) issues.push({ level: 'bad', text: 'Your voice is very quiet. Speak up or move the microphone closer (a headset mic is best).' });
  else if (speechDb - noiseDb < 15) issues.push({ level: 'warn', text: 'Your voice is not much louder than the background. Move closer to the microphone.' });
  if (speechDb > -3) issues.push({ level: 'warn', text: 'Your voice is so loud it may distort. Move the microphone a little away.' });
  if (echoRiseDb != null && echoRiseDb > 12)
    issues.push({ level: 'warn', text: "Your microphone hears the tutor's voice from your speakers. Use headphones so the tutor doesn't hear itself." });
  if (recognized != null && recognized < 0.6) issues.push({ level: 'bad', text: 'The test sentence was hard to recognise. Check the microphone, then try again.' });
  else if (recognized != null && recognized < 0.85) issues.push({ level: 'warn', text: 'Some words of the test sentence were missed. Speak clearly and a little slower for the check.' });
  return { noiseDb: Math.round(noiseDb), speechDb: Math.round(speechDb), echoRiseDb: echoRiseDb == null ? null : Math.round(echoRiseDb), recognized, issues, ok: !issues.some((i) => i.level === 'bad') };
}
