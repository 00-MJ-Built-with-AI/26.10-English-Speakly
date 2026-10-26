import { useEffect, useRef, useState } from 'react';
import type { FastPrompt } from '../../content/units.ts';
import { currentUnit } from '../../engine/path.ts';
import { LEARNED_BOX, review } from '../../engine/srs.ts';
import { wordAccuracy } from '../../engine/text.ts';
import { aiTask } from '../../lib/api.ts';
import { useApp } from '../../lib/store.tsx';
import type { Mistake } from '../../lib/types.ts';
import { beep } from '../../speech/fx.ts';
import type { Assessment } from '../../speech/index.ts';
import { Icon } from '../components/Icon.tsx';
import { MicControl, useElapsed, useListen, useSpeak } from '../components/speaking.tsx';

type Item = { kind: 'shadow'; text: string } | { kind: 'fast'; prompt: FastPrompt; focus: string } | { kind: 'fix'; m: Mistake & { id: string } };

class Stopped extends Error {}

/** Hands-free, eyes-free practice: everything is spoken and answered by voice. */
export function Car() {
  const app = useApp();
  const mic = useListen();
  const { speak } = useSpeak();
  const elapsed = useElapsed();
  const [state, setState] = useState<'ready' | 'running' | 'paused' | 'done'>('ready');
  const [line, setLine] = useState('');
  const [step, setStep] = useState({ i: 0, n: 0 });
  const [score, setScore] = useState({ good: 0, total: 0 });
  const stopped = useRef(false);
  const paused = useRef(false);
  const lock = useRef<{ release(): Promise<void> } | null>(null);

  useEffect(
    () => () => {
      stopped.current = true;
      lock.current?.release().catch(() => {});
    },
    [],
  );

  const check = async () => {
    while (paused.current && !stopped.current) await new Promise((r) => setTimeout(r, 300));
    if (stopped.current) throw new Stopped();
  };
  const say = async (text: string) => {
    await check();
    setLine(text);
    await speak(text);
  };
  const hear = async (reference?: string): Promise<Assessment | null> => {
    await check();
    await beep();
    return mic.listen({ reference, maxSeconds: 20, endSilenceMs: 1500, noSpeechMs: 9000 });
  };

  async function buildItems(): Promise<Item[]> {
    const unit = currentUnit(app.user);
    const due = (await app.repo.list<Mistake>('mistakes', { dueBefore: Date.now() })).filter((m) => m.box < LEARNED_BOX && m.kind !== 'pronunciation').slice(0, 3);
    const shadow: Item[] = (unit?.shadow ?? []).slice(0, 4).map((text) => ({ kind: 'shadow', text }));
    const fast: Item[] = (unit?.fast ?? []).slice(0, 3).map((prompt) => ({ kind: 'fast', prompt, focus: unit!.grammar.name }));
    const fix: Item[] = due.map((m) => ({ kind: 'fix', m }));
    const out: Item[] = [];
    while (shadow.length || fast.length || fix.length) {
      for (const list of [shadow, fast, fix]) if (list.length) out.push(list.shift()!);
    }
    return out;
  }

  async function run() {
    stopped.current = false;
    paused.current = false;
    setState('running');
    setScore({ good: 0, total: 0 });
    try {
      lock.current = (await (navigator as Navigator & { wakeLock?: { request(t: 'screen'): Promise<{ release(): Promise<void> }> } }).wakeLock?.request('screen')) ?? null;
    } catch {
      lock.current = null;
    }
    const items = await buildItems();
    const level = currentUnit(app.user)?.level ?? 'B1';
    try {
      await say(`Car mode. ${items.length} quick exercises. After each beep, it's your turn.`);
      for (let i = 0; i < items.length; i++) {
        setStep({ i: i + 1, n: items.length });
        const it = items[i];
        let ok = false;
        if (it.kind === 'shadow') {
          await say(`Repeat after me. ${it.text}`);
          let a = await hear(it.text);
          ok = Boolean(a && (a.engine === 'typed' ? wordAccuracy(it.text, a.text) > 0.8 : a.pron >= 75));
          if (!ok) {
            await say(`Almost. Listen again. ${it.text}`);
            a = await hear(it.text);
            ok = Boolean(a && (a.engine === 'typed' ? wordAccuracy(it.text, a.text) > 0.8 : a.pron >= 70));
          }
          await say(ok ? 'Great.' : "Good effort. We'll practise it again another time.");
        } else if (it.kind === 'fast') {
          await say(`${it.prompt.instruction} ${it.prompt.prompt}`);
          const a = await hear();
          if (a?.text) {
            const g = await aiTask('grade', { level, instruction: it.prompt.instruction, prompt: it.prompt.prompt, example: it.prompt.example, grammarFocus: it.focus, transcript: a.text });
            ok = g.correct;
            if (ok) await say('Correct.');
            else {
              await say(`A better way: ${g.corrected}. Now you say it.`);
              await hear(g.corrected);
              await say('Good.');
            }
          }
        } else {
          await say(`Fix this sentence. ${it.m.said}`);
          const a = await hear();
          ok = Boolean(a && wordAccuracy(it.m.better, a.text) >= 0.8);
          const next = review(it.m, ok);
          await app.repo.update('mistakes', it.m.id, { box: next.box, due: next.due, reps: next.reps, lapses: next.lapses });
          if (ok) await say('Correct.');
          else {
            await say(`The correct version is: ${it.m.better}. Repeat it.`);
            await hear(it.m.better);
            await say('Good.');
          }
        }
        setScore((s) => ({ good: s.good + (ok ? 1 : 0), total: s.total + 1 }));
      }
      await say("That's the end of this session. Well done!");
      setState('done');
    } catch (e) {
      if (!(e instanceof Stopped)) setLine(e instanceof Error ? e.message : String(e));
      setState('done');
    } finally {
      lock.current?.release().catch(() => {});
      lock.current = null;
      await app.logAttempt({ at: Date.now(), kind: 'car', title: 'Car mode', seconds: elapsed(), scores: {} });
    }
  }

  return (
    <div className="stack" style={{ textAlign: 'center' }}>
      <h1>Car mode</h1>
      <p className="muted">Eyes-free practice for your commute: repeat sentences, answer quick prompts, and fix past mistakes, all by voice. Use a phone holder and keep your eyes on the road.</p>
      <div className="card stack" style={{ minHeight: 260, justifyContent: 'center' }}>
        {state === 'ready' && (
          <button className="btn primary big" style={{ fontSize: '1.4rem', padding: '28px' }} onClick={run}>
            <Icon name="play" size={28} /> Start
          </button>
        )}
        {(state === 'running' || state === 'paused') && (
          <>
            <div className="small muted">
              {step.n ? `Exercise ${step.i} of ${step.n}` : 'Getting ready…'} · {score.good}/{score.total} right
            </div>
            <div className="prompt-text">{line}</div>
            {mic.state === 'listening' && <div className="partial">{mic.partial || 'Your turn…'}</div>}
            {mic.state === 'listening' && !mic.canListen && <MicControl {...mic} onStart={() => {}} onStop={mic.stop} onTyped={mic.submitTyped} />}
            <div className="row" style={{ justifyContent: 'center' }}>
              <button
                className="btn big"
                style={{ minWidth: 140, minHeight: 72 }}
                onClick={() => {
                  paused.current = !paused.current;
                  setState(paused.current ? 'paused' : 'running');
                }}
              >
                <Icon name={state === 'paused' ? 'play' : 'pause'} size={28} /> {state === 'paused' ? 'Resume' : 'Pause'}
              </button>
              <button
                className="btn big danger"
                style={{ minWidth: 140, minHeight: 72 }}
                onClick={() => {
                  stopped.current = true;
                  mic.cancel();
                }}
              >
                <Icon name="stop" size={24} /> Stop
              </button>
            </div>
          </>
        )}
        {state === 'done' && (
          <>
            <div className="prompt-text">
              {score.good} of {score.total} right
            </div>
            {line && <div className="small muted">{line}</div>}
            <button className="btn primary big" style={{ alignSelf: 'center' }} onClick={() => setState('ready')}>
              Another session
            </button>
          </>
        )}
      </div>
    </div>
  );
}
