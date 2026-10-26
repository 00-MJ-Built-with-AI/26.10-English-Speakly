/**
 * Voice pitch (intonation) from raw audio: frame-by-frame autocorrelation, then a contour in
 * semitones relative to the speaker's own median so a man and a woman can be compared.
 */
export interface PitchFrame {
  t: number;
  hz: number | null;
}

export function pitchTrack(samples: Float32Array, sampleRate: number, opts: { minHz?: number; maxHz?: number; hopMs?: number } = {}): PitchFrame[] {
  const minHz = opts.minHz ?? 70;
  const maxHz = opts.maxHz ?? 450;
  const hop = Math.round((sampleRate * (opts.hopMs ?? 10)) / 1000);
  const win = Math.round(sampleRate * 0.04);
  const minLag = Math.floor(sampleRate / maxHz);
  const maxLag = Math.min(win - 1, Math.ceil(sampleRate / minHz));
  let peak = 0;
  for (let i = 0; i < samples.length; i++) peak = Math.max(peak, Math.abs(samples[i]));
  const gate = peak * 0.06;
  const out: PitchFrame[] = [];
  for (let start = 0; start + win < samples.length; start += hop) {
    let energy = 0;
    for (let i = 0; i < win; i++) energy += samples[start + i] ** 2;
    const rms = Math.sqrt(energy / win);
    const t = (start + win / 2) / sampleRate;
    if (rms < gate || energy === 0) {
      out.push({ t, hz: null });
      continue;
    }
    const corr = (lag: number) => {
      let num = 0;
      let e1 = 0;
      let e2 = 0;
      for (let i = 0; i + lag < win; i++) {
        const a = samples[start + i];
        const b = samples[start + i + lag];
        num += a * b;
        e1 += a * a;
        e2 += b * b;
      }
      return num / Math.sqrt(e1 * e2 || 1);
    };
    let bestLag = -1;
    let best = 0;
    for (let lag = minLag; lag <= maxLag; lag++) {
      const r = corr(lag);
      if (r > best) {
        best = r;
        bestLag = lag;
      }
    }
    // Avoid octave errors: if half the period fits almost as well, the pitch is double.
    const half = Math.round(bestLag / 2);
    if (bestLag > 0 && half >= minLag && corr(half) > best * 0.9) bestLag = half;
    out.push({ t, hz: best > 0.55 && bestLag > 0 ? sampleRate / bestLag : null });
  }
  return out;
}

export interface Contour {
  /** Normalised time 0-1 and semitones from the speaker's median (null = no voice). */
  points: { x: number; st: number | null }[];
  /** Spread between low and high pitch, semitones (10th-90th percentile). */
  range: number;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};

export function toContour(track: PitchFrame[]): Contour {
  const voiced = track.filter((f) => f.hz != null);
  if (voiced.length < 3) return { points: [], range: 0 };
  const first = track.indexOf(voiced[0]);
  const last = track.lastIndexOf(voiced[voiced.length - 1]);
  const span = track.slice(first, last + 1);
  const ref = median(voiced.map((f) => f.hz!));
  const raw = span.map((f) => (f.hz == null ? null : 12 * Math.log2(f.hz / ref)));
  // Median-of-3 smoothing removes single-frame jumps.
  const st = raw.map((v, i) => {
    if (v == null) return null;
    const near = [raw[i - 1], v, raw[i + 1]].filter((x): x is number => x != null);
    return median(near);
  });
  const t0 = span[0].t;
  const t1 = span[span.length - 1].t || t0 + 1;
  const vals = st.filter((x): x is number => x != null).sort((a, b) => a - b);
  const range = vals.length ? vals[Math.floor(vals.length * 0.9)] - vals[Math.floor(vals.length * 0.1)] : 0;
  return { points: span.map((f, i) => ({ x: (f.t - t0) / (t1 - t0 || 1), st: st[i] })), range: Math.round(range * 10) / 10 };
}

/** Contour sampled at n evenly spaced points, filling unvoiced gaps by interpolation. */
export function resample(c: Contour, n = 50): number[] {
  const pts = c.points.filter((p) => p.st != null) as { x: number; st: number }[];
  if (!pts.length) return [];
  const out: number[] = [];
  let j = 0;
  for (let k = 0; k < n; k++) {
    const x = k / (n - 1);
    while (j < pts.length - 2 && pts[j + 1].x < x) j++;
    const a = pts[j];
    const b = pts[Math.min(j + 1, pts.length - 1)];
    const f = b.x === a.x ? 0 : Math.max(0, Math.min(1, (x - a.x) / (b.x - a.x)));
    out.push(a.st + (b.st - a.st) * f);
  }
  return out;
}

/** How closely two melodies rise and fall together, 0-100. */
export function melodyMatch(a: Contour, b: Contour): number | null {
  const x = resample(a);
  const y = resample(b);
  if (x.length < 5 || y.length < 5) return null;
  const mx = x.reduce((s, v) => s + v, 0) / x.length;
  const my = y.reduce((s, v) => s + v, 0) / y.length;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < x.length; i++) {
    num += (x[i] - mx) * (y[i] - my);
    dx += (x[i] - mx) ** 2;
    dy += (y[i] - my) ** 2;
  }
  if (!dx || !dy) return 0;
  return Math.round(Math.max(0, num / Math.sqrt(dx * dy)) * 100);
}
