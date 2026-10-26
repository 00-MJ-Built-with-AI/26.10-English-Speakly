/** Small sound effects: a beep before listening (car mode) and phone-line noise (call simulator). */
let ctx: AudioContext | undefined;
const audio = () => (ctx ??= new AudioContext());

export function beep(freq = 880, ms = 120): Promise<void> {
  const c = audio();
  c.resume().catch(() => {});
  const o = c.createOscillator();
  const g = c.createGain();
  o.frequency.value = freq;
  const t = c.currentTime;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.15, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + ms / 1000 + 0.02);
  return new Promise((r) => setTimeout(r, ms + 40));
}

let noise: AudioBufferSourceNode | null = null;

/** A faint, band-limited hiss like a phone line. */
export function startLineNoise(): void {
  if (noise) return;
  const c = audio();
  c.resume().catch(() => {});
  const buf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const band = c.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = 1500;
  band.Q.value = 0.7;
  const g = c.createGain();
  g.gain.value = 0.012;
  src.connect(band).connect(g).connect(c.destination);
  src.start();
  noise = src;
}

export function stopLineNoise(): void {
  noise?.stop();
  noise = null;
}

/**
 * Routes an audio element through a telephone-band filter (about 300-3400 Hz) when `on`.
 * The element can only be connected once, so the graph is created on first use and reused.
 */
const graphs = new WeakMap<HTMLAudioElement, { dry: GainNode; wet: GainNode }>();
export function phoneLine(el: HTMLAudioElement, on: boolean): void {
  let g = graphs.get(el);
  if (!g && !on) return;
  const c = audio();
  c.resume().catch(() => {});
  if (!g) {
    const src = c.createMediaElementSource(el);
    const hp = c.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 320;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 3300;
    const dry = c.createGain();
    const wet = c.createGain();
    src.connect(dry).connect(c.destination);
    src.connect(hp).connect(lp).connect(wet).connect(c.destination);
    g = { dry, wet };
    graphs.set(el, g);
  }
  g.dry.gain.value = on ? 0 : 1;
  g.wet.gain.value = on ? 1.5 : 0;
}
