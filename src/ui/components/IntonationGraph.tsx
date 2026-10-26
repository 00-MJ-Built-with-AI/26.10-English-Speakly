import { useEffect, useState } from 'react';
import { melodyMatch, pitchTrack, toContour, type Contour } from '../../engine/pitch.ts';
import { useApp } from '../../lib/store.tsx';
import { decodeMono } from '../../speech/audio.ts';

async function contourOf(blob: Blob): Promise<Contour> {
  const { samples, sampleRate } = await decodeMono(blob);
  return toContour(pitchTrack(samples, sampleRate));
}

/** Your pitch line next to the model's: shows a flat or unusual melody at a glance. */
export function IntonationGraph({ text, userAudio }: { text: string; userAudio?: Blob }) {
  const { engine, user } = useApp();
  const [model, setModel] = useState<Contour | null>(null);
  const [mine, setMine] = useState<Contour | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let alive = true;
    setState('loading');
    (async () => {
      try {
        const m = await engine.modelAudio(text, { voice: user.settings.voice, rate: 1 });
        const [mc, uc] = await Promise.all([m ? contourOf(m) : null, userAudio ? contourOf(userAudio) : null]);
        if (!alive) return;
        setModel(mc);
        setMine(uc);
        setState('ready');
      } catch (e) {
        console.error(e);
        if (alive) setState('error');
      }
    })();
    return () => {
      alive = false;
    };
  }, [engine, text, userAudio, user.settings.voice]);

  if (state === 'loading') return <div className="small muted">Drawing the melody…</div>;
  if (state === 'error') return <div className="small muted">The melody could not be drawn for this recording.</div>;
  if (!model && !mine) return null;

  const all = [...(model?.points ?? []), ...(mine?.points ?? [])].map((p) => p.st).filter((v): v is number => v != null);
  const lo = Math.min(-6, ...all);
  const hi = Math.max(6, ...all);
  const W = 600;
  const H = 150;
  const x = (v: number) => 12 + v * (W - 24);
  const y = (v: number) => 10 + ((hi - v) / (hi - lo)) * (H - 20);
  const path = (c: Contour) => {
    let d = '';
    let pen = false;
    for (const p of c.points) {
      if (p.st == null) {
        pen = false;
        continue;
      }
      d += `${pen ? 'L' : 'M'}${x(p.x).toFixed(1)},${y(p.st).toFixed(1)} `;
      pen = true;
    }
    return d;
  };
  const match = model && mine ? melodyMatch(model, mine) : null;
  const flat = model && mine && mine.range < model.range * 0.6;

  return (
    <div className="soft stack">
      <div className="spread">
        <b className="small">Melody (intonation)</b>
        {match != null && <span className={`chip ${match >= 70 ? 'good' : match >= 45 ? 'ok' : 'bad'}`}>Match {match}%</span>}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }} role="img" aria-label="Pitch of the model voice and of your voice over the sentence">
        <line x1={12} x2={W - 12} y1={y(0)} y2={y(0)} stroke="var(--line)" strokeDasharray="4 4" />
        {model && <path d={path(model)} fill="none" stroke="var(--brand)" strokeWidth="3" strokeLinecap="round" opacity="0.55" />}
        {mine && <path d={path(mine)} fill="none" stroke="var(--flu)" strokeWidth="3" strokeLinecap="round" />}
      </svg>
      <div className="row small">
        {model && <span style={{ color: 'var(--brand)' }}>— native model</span>}
        {mine && <span style={{ color: 'var(--flu)' }}>— you</span>}
      </div>
      {flat && <div className="small">Your voice moves less than the model's ({mine!.range} vs {model!.range} semitones). Let it rise and fall more on stressed words.</div>}
      {match != null && match < 45 && !flat && <div className="small">Your melody goes in a different direction. Listen for where the model rises and falls, then copy it.</div>}
      {!model && <div className="small muted">The model line needs Azure voices; showing your melody only.</div>}
    </div>
  );
}
