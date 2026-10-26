/** Decodes a recording to mono samples at about 16 kHz (enough for pitch, and fast). */
export async function decodeMono(blob: Blob): Promise<{ samples: Float32Array; sampleRate: number }> {
  const ctx = new AudioContext();
  try {
    const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
    const ch = buf.getChannelData(0);
    const factor = Math.max(1, Math.floor(buf.sampleRate / 16000));
    const out = new Float32Array(Math.floor(ch.length / factor));
    for (let i = 0; i < out.length; i++) {
      let s = 0;
      for (let k = 0; k < factor; k++) s += ch[i * factor + k];
      out[i] = s / factor;
    }
    return { samples: out, sampleRate: buf.sampleRate / factor };
  } finally {
    ctx.close().catch(() => {});
  }
}
