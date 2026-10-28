import { useEffect, useState } from 'react';
import { browserVoices } from '../../speech/browser.ts';
import { AZURE_VOICES } from '../../speech/voices.ts';
import { BUILT_AT } from '../../config.ts';
import { useApp } from '../../lib/store.tsx';
import { emptyUser, type CorrectionStyle, type Settings } from '../../lib/types.ts';
import { Icon } from '../components/Icon.tsx';
import { useSpeak } from '../components/speaking.tsx';
import { SpendingCard } from '../components/Spending.tsx';
import { BaselineForm } from '../components/Baseline.tsx';
import { href } from '../../lib/router.ts';

/** English voices the browser offers, most natural first (used until Azure is connected). */
function useBrowserVoices(active: boolean) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  useEffect(() => {
    if (active) browserVoices().then(setVoices);
  }, [active]);
  return voices;
}

export function SettingsPage() {
  const { user, update, status, repo, account, signOut, engine } = useApp();
  const { speak } = useSpeak();
  const browserVoiceList = useBrowserVoices(engine.kind !== 'azure');
  const [exporting, setExporting] = useState(false);
  const s = user.settings;
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => update((u) => (u.settings[k] = v));

  async function exportData() {
    setExporting(true);
    try {
      const [attempts, mistakes, sessions, recordings] = await Promise.all([
        repo.list('attempts'),
        repo.list('mistakes'),
        repo.list('sessions'),
        repo.list('recordings'),
      ]);
      const blob = new Blob([JSON.stringify({ user, attempts, mistakes, sessions, recordings }, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `speakly-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
    } finally {
      setExporting(false);
    }
  }

  const ok = (v: boolean) => <span className={`chip ${v ? 'good' : 'ok'}`}>{v ? 'Connected' : 'Not set up'}</span>;

  return (
    <div className="stack">
      <h1>Settings</h1>

      <div className="card">
        <h3>Voice and listening</h3>
        <label className="field">
          <span>Tutor voice</span>
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            {engine.kind === 'azure' ? (
              <select value={s.voice} onChange={(e) => set('voice', e.target.value)}>
                <optgroup label="Most natural (HD)">
                  {AZURE_VOICES.filter((v) => v.hd).map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Standard">
                  {AZURE_VOICES.filter((v) => !v.hd).map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label}
                    </option>
                  ))}
                </optgroup>
              </select>
            ) : (
              <select value={s.browserVoice ?? ''} onChange={(e) => update((u) => (u.settings.browserVoice = e.target.value || undefined))}>
                <option value="">Most natural available</option>
                {browserVoiceList.map((v) => (
                  <option key={v.name} value={v.name}>
                    {v.name}
                  </option>
                ))}
              </select>
            )}
            <button className="btn small" onClick={() => speak("Hi! I'm your Speakly tutor. Let's practise speaking together.")}>
              <Icon name="volume" size={16} /> Test
            </button>
          </div>
          {engine.kind === 'azure' ? (
            <div className="small muted">HD voices sound the most human. If your Azure region doesn't offer them, the app switches to the standard voice automatically.</div>
          ) : (
            <div className="small muted">
              You're hearing your browser's own voice until Azure Speech is connected. For a much better free voice now, open Speakly in Microsoft Edge and pick one marked "Online (Natural)".
            </div>
          )}
        </label>
        <label className="field" style={{ marginTop: 12 }}>
          <span>Speaking speed: {s.speechRate.toFixed(2)}×</span>
          <input type="range" min={0.7} max={1.2} step={0.05} value={s.speechRate} onChange={(e) => set('speechRate', Number(e.target.value))} />
        </label>
        <label className="field" style={{ marginTop: 12 }}>
          <span>Pause before the tutor replies: {s.turnPause.toFixed(1)} s</span>
          <input type="range" min={0.8} max={4} step={0.1} value={s.turnPause} onChange={(e) => set('turnPause', Number(e.target.value))} />
          <div className="small muted">Longer gives you time to think mid-sentence; shorter feels more like a real conversation.</div>
        </label>
        <div className="toggle">
          <span>Hands-free conversations</span>
          <input type="checkbox" checked={s.handsFree} onChange={(e) => set('handsFree', e.target.checked)} />
        </div>
        <div className="toggle">
          <span>Live transcript in conversations</span>
          <input type="checkbox" checked={s.liveTranscript} onChange={(e) => set('liveTranscript', e.target.checked)} />
        </div>
        <label className="field">
          <span>Tutor corrections</span>
          <select value={s.correction} onChange={(e) => set('correction', e.target.value as CorrectionStyle)}>
            <option value="light">Light in chat, full report after</option>
            <option value="every">Correct every turn</option>
            <option value="end">Only at the end</option>
          </select>
        </label>
      </div>

      <SpendingCard />

      <div className="card stack">
        <div className="spread">
          <div>
            <h3 style={{ margin: 0 }}>Microphone</h3>
            <div className="small muted">
              {user.micCheck
                ? `Last check ${new Date(user.micCheck.at).toLocaleDateString()}: ${user.micCheck.ok ? (user.micCheck.issues.length ? 'usable, with tips' : 'all good') : 'needs fixing'}.`
                : 'Not checked yet. A noisy room or a bad mic makes scores unfair.'}
            </div>
          </div>
          <a className="btn small" href={href('/mic-check')}>
            <Icon name="mic" size={16} /> Check microphone
          </a>
        </div>
      </div>

      <div className="card stack">
        <h3 style={{ margin: 0 }}>Earlier test scores</h3>
        <div className="small muted">Scores from an earlier English test, to compare with your progress here.</div>
        <BaselineForm />
      </div>

      <div className="card stack">
        <div className="toggle" style={{ paddingTop: 0 }}>
          <span>
            <h3 style={{ margin: 0 }}>Tutor memory</h3>
            <div className="small muted">The tutor remembers facts you mention, recent topics, and the phrases and mistakes you're working on, so conversations don't start from zero.</div>
          </span>
          <input type="checkbox" checked={s.tutorMemory} onChange={(e) => set('tutorMemory', e.target.checked)} />
        </div>
        {user.memory.facts.length > 0 ? (
          <>
            {user.memory.facts.map((f) => (
              <div key={f} className="spread small" style={{ borderBottom: '1px solid var(--line)', padding: '4px 0' }}>
                <span>{f}</span>
                <button className="btn ghost small" aria-label="Forget this" onClick={() => update((u) => (u.memory.facts = u.memory.facts.filter((x) => x !== f)))}>
                  <Icon name="x" size={14} />
                </button>
              </div>
            ))}
            <button className="btn small danger" style={{ alignSelf: 'flex-start' }} onClick={() => confirm('Forget everything the tutor remembers?') && update((u) => (u.memory = { facts: [], topics: [] }))}>
              Forget everything
            </button>
          </>
        ) : (
          <div className="small faint">Nothing remembered yet. Facts appear here after conversations.</div>
        )}
      </div>

      <div className="card">
        <h3>Goals and data</h3>
        <label className="field">
          <span>Your name</span>
          <input type="text" value={user.name} onChange={(e) => update((u) => (u.name = e.target.value))} />
        </label>
        <label className="field" style={{ marginTop: 12 }}>
          <span>Daily goal: {s.dailyGoalMinutes} minutes</span>
          <input type="range" min={10} max={60} step={5} value={s.dailyGoalMinutes} onChange={(e) => set('dailyGoalMinutes', Number(e.target.value))} />
        </label>
        <div className="grid grid-2" style={{ marginTop: 12 }}>
          <label className="field">
            <span>TOEFL exam date</span>
            <input type="date" value={s.examDate ?? ''} onChange={(e) => update((u) => (u.settings.examDate = e.target.value || undefined))} />
          </label>
          <label className="field">
            <span>Target speaking band</span>
            <select value={s.targetBand ?? ''} onChange={(e) => update((u) => (u.settings.targetBand = e.target.value ? Number(e.target.value) : undefined))}>
              <option value="">Not set</option>
              {[3, 3.5, 4, 4.5, 5, 5.5, 6].map((b) => (
                <option key={b} value={b}>
                  {b.toFixed(1)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="field" style={{ marginTop: 12 }}>
          <span>Appearance</span>
          <select value={s.theme} onChange={(e) => set('theme', e.target.value as typeof s.theme)}>
            <option value="system">Follow my system</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
        <div className="toggle">
          <span>Show XP and badges</span>
          <input type="checkbox" checked={s.showGamification} onChange={(e) => set('showGamification', e.target.checked)} />
        </div>
        <div className="toggle">
          <span>Keep my recordings</span>
          <input type="checkbox" checked={s.keepRecordings} onChange={(e) => set('keepRecordings', e.target.checked)} />
        </div>
        <div className="row">
          <button className="btn small" onClick={exportData} disabled={exporting}>
            Export my data
          </button>
          <button
            className="btn small danger"
            onClick={() => {
              if (confirm('Reset your path, skills and streak? Your recordings and mistake bank stay.')) {
                update((u) => {
                  const fresh = emptyUser(u.name);
                  Object.assign(u, { ...fresh, settings: u.settings, createdAt: u.createdAt });
                });
              }
            }}
          >
            Reset progress
          </button>
        </div>
      </div>

      <div className="card">
        <h3>Connections</h3>
        <div className="spread" style={{ padding: '6px 0' }}>
          <span>
            <b>Account and sync</b>
            <div className="small muted">{repo.kind === 'cloud' ? `Signed in as ${account?.email ?? account?.name}` : 'Firebase not configured: progress is saved in this browser only.'}</div>
          </span>
          {ok(repo.kind === 'cloud')}
        </div>
        <div className="spread" style={{ padding: '6px 0' }}>
          <span>
            <b>Pronunciation scoring and voice</b>
            <div className="small muted">Azure AI Speech</div>
          </span>
          {ok(status.speech)}
        </div>
        <div className="spread" style={{ padding: '6px 0' }}>
          <span>
            <b>AI tutor</b>
            <div className="small muted">Anthropic Claude{status.model ? ` (${status.model})` : ''}</div>
          </span>
          {ok(status.tutor)}
        </div>
        {(!status.speech || !status.tutor || repo.kind === 'local') && <p className="small muted">The setup guide (SETUP.md in the project) walks through each one.</p>}
        {signOut && (
          <button className="btn small" onClick={signOut}>
            Sign out
          </button>
        )}
      </div>
      <p className="small faint">Version {new Date(BUILT_AT).toLocaleString()}</p>
    </div>
  );
}
