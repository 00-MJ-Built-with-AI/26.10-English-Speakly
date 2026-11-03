import { useState } from 'react';
import { hasFirebase } from '../../config.ts';
import { aiTask, speechToken } from '../../lib/api.ts';
import { href } from '../../lib/router.ts';
import { useApp } from '../../lib/store.tsx';
import { Icon } from '../components/Icon.tsx';

type State = 'idle' | 'running' | 'ok' | 'fail' | 'skip';

interface Check {
  id: string;
  title: string;
  state: State;
  detail: string;
}

const VERCEL_ENV = 'Vercel → your project → Settings → Environment Variables, then redeploy (Deployments → ⋯ → Redeploy).';

/** Checks every real service once and says what to fix: server, AI, speech, sign-in and sync, microphone. */
export function GoLive() {
  const { repo, account, engine, user, update } = useApp();
  const [checks, setChecks] = useState<Check[]>([]);
  const [running, setRunning] = useState(false);

  const set = (c: Check) => setChecks((xs) => [...xs.filter((x) => x.id !== c.id), c]);

  async function run() {
    setRunning(true);
    setChecks([]);
    // 1. Server functions
    let status: { speech: boolean; tutor: boolean; auth: boolean; model: string } | null = null;
    set({ id: 'server', title: 'Server functions', state: 'running', detail: '' });
    try {
      const r = await fetch('/api/status', { cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      status = await r.json();
      set({ id: 'server', title: 'Server functions', state: 'ok', detail: 'The /api functions answer.' });
    } catch (e) {
      set({
        id: 'server',
        title: 'Server functions',
        state: 'fail',
        detail: `Not reachable (${e instanceof Error ? e.message : e}). If the site asks for a Vercel login, turn off Deployment Protection (Vercel → Settings → Deployment Protection) or use the production domain.`,
      });
    }

    // 2. Claude
    set({ id: 'ai', title: 'AI tutor (Anthropic)', state: 'running', detail: '' });
    if (!status?.tutor) {
      set({ id: 'ai', title: 'AI tutor (Anthropic)', state: 'fail', detail: `No key on the server. Add ANTHROPIC_API_KEY in ${VERCEL_ENV}` });
    } else {
      const t0 = performance.now();
      try {
        const r = await aiTask('define', { phrase: 'break the ice', level: 'B2' });
        set({ id: 'ai', title: 'AI tutor (Anthropic)', state: 'ok', detail: `A real call worked in ${((performance.now() - t0) / 1000).toFixed(1)} s with ${status.model}: “${r.example}”` });
      } catch (e) {
        const m = e instanceof Error ? e.message : String(e);
        set({
          id: 'ai',
          title: 'AI tutor (Anthropic)',
          state: 'fail',
          detail: `The key is set but the call failed: ${m}. ${/401|auth|key/i.test(m) ? 'Check the key is correct and active.' : /credit|billing|429|rate/i.test(m) ? 'Check your Anthropic credits and limits.' : /cap|limit/i.test(m) ? 'Your daily spending limit in Settings was reached.' : ''}`,
        });
      }
    }

    // 3. Azure speech
    set({ id: 'speech', title: 'Speech (Azure voices and pronunciation)', state: 'running', detail: '' });
    if (!status?.speech) {
      set({ id: 'speech', title: 'Speech (Azure voices and pronunciation)', state: 'fail', detail: `Not set up: add AZURE_SPEECH_KEY and AZURE_SPEECH_REGION in ${VERCEL_ENV} Until then voices are your browser's and pronunciation scores are estimates.` });
    } else {
      try {
        const tok = await speechToken();
        set({
          id: 'speech',
          title: 'Speech (Azure voices and pronunciation)',
          state: engine.kind === 'azure' ? 'ok' : 'fail',
          detail: engine.kind === 'azure' ? `Token works (region ${tok.region}). Press "Hear a test voice" below to check the sound.` : 'The token works, but the app is using the browser engine. Reload the page.',
        });
      } catch (e) {
        set({ id: 'speech', title: 'Speech (Azure voices and pronunciation)', state: 'fail', detail: `Token failed: ${e instanceof Error ? e.message : e}. Check the key and that the region matches your Azure Speech resource.` });
      }
    }

    // 4. Sign-in and sync
    set({ id: 'sync', title: 'Google sign-in and sync', state: 'running', detail: '' });
    if (!hasFirebase) {
      set({ id: 'sync', title: 'Google sign-in and sync', state: 'fail', detail: `Firebase isn't configured, so progress stays on this device. Add the VITE_FIREBASE_* values and FIREBASE_PROJECT_ID in ${VERCEL_ENV}` });
    } else if (!account || repo.kind !== 'cloud') {
      set({ id: 'sync', title: 'Google sign-in and sync', state: 'fail', detail: 'Firebase is set up but you are not signed in on this device. Sign in with Google from the menu.' });
    } else {
      try {
        const doc = await repo.loadUser();
        if (!doc) throw new Error('no progress document found');
        set({ id: 'sync', title: 'Google sign-in and sync', state: 'ok', detail: `Signed in as ${account.email ?? account.name}; your progress loads from the cloud.` });
      } catch (e) {
        set({ id: 'sync', title: 'Google sign-in and sync', state: 'fail', detail: `Signed in, but reading your progress failed: ${e instanceof Error ? e.message : e}. Check the Firestore rules from SETUP.md.` });
      }
    }

    // 5. Microphone
    set({ id: 'mic', title: 'Microphone', state: 'running', detail: '' });
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      const label = s.getAudioTracks()[0]?.label;
      s.getTracks().forEach((t) => t.stop());
      set({ id: 'mic', title: 'Microphone', state: 'ok', detail: `Allowed${label ? `: ${label}` : ''}. Run the full mic check for noise and echo.` });
    } catch (e) {
      set({ id: 'mic', title: 'Microphone', state: 'fail', detail: `Not available (${e instanceof Error ? e.name : e}). Allow the microphone for this site in the browser's address bar, or connect one.` });
    }

    // 6. Spending limit
    set({
      id: 'cap',
      title: 'Daily spending limit',
      state: user.settings.dailyCapUsd > 0 ? 'ok' : 'skip',
      detail: user.settings.dailyCapUsd > 0 ? `$${user.settings.dailyCapUsd.toFixed(2)} a day; at the limit the AI tutor pauses.` : 'No limit set. Consider one in Settings.',
    });
    update((u) => (u.goLiveAt = Date.now()));
    setRunning(false);
  }

  const order = ['server', 'ai', 'speech', 'sync', 'mic', 'cap'];
  const sorted = [...checks].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  const fails = checks.filter((c) => c.state === 'fail').length;
  return (
    <div className="stack">
      <h1>Go-live check</h1>
      <p className="muted">Checks that the real services work: the server, the AI (one small real call, a fraction of a cent), Azure speech, sign-in and sync, and your microphone.</p>
      <button className="btn primary big" onClick={run} disabled={running} style={{ alignSelf: 'flex-start' }}>
        <Icon name="check" /> {running ? 'Checking…' : checks.length ? 'Check again' : 'Run the check'}
      </button>
      {sorted.length > 0 && (
        <div className="card stack">
          {sorted.map((c) => (
            <div key={c.id} className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
              <span className={`chip ${c.state === 'ok' ? 'good' : c.state === 'fail' ? 'bad' : ''}`} style={{ minWidth: 30, justifyContent: 'center' }}>
                {c.state === 'ok' ? '✓' : c.state === 'fail' ? '✗' : c.state === 'running' ? '…' : '–'}
              </span>
              <span>
                <b>{c.title}</b>
                <div className="small muted">{c.detail}</div>
              </span>
            </div>
          ))}
          {!running && <div className={`banner ${fails ? '' : 'info'}`}>{fails ? `${fails} thing${fails === 1 ? '' : 's'} to fix. After changing Vercel variables, redeploy and run the check again.` : 'Everything is live.'}</div>}
        </div>
      )}
      {checks.some((c) => c.id === 'speech' && c.state === 'ok') && <VoiceTest />}
      <div className="row">
        <a className="btn" href={href('/mic-check')}>
          Full microphone check
        </a>
        <a className="btn ghost" href={href('/settings')}>
          Settings
        </a>
      </div>
    </div>
  );
}

function VoiceTest() {
  const { engine, user } = useApp();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="btn"
      disabled={busy}
      style={{ alignSelf: 'flex-start' }}
      onClick={async () => {
        setBusy(true);
        await engine.speak('Hi! If you can hear me clearly, Azure voices are working.', { voice: user.settings.voice, rate: 1 }).catch(() => {});
        setBusy(false);
      }}
    >
      <Icon name="volume" size={16} /> Hear a test voice
    </button>
  );
}
