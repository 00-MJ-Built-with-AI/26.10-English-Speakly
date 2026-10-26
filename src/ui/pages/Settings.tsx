import { useState } from 'react';
import { BUILT_AT } from '../../config.ts';
import { useApp } from '../../lib/store.tsx';
import { emptyUser, type CorrectionStyle, type Settings } from '../../lib/types.ts';
import { Icon } from '../components/Icon.tsx';
import { useSpeak } from '../components/speaking.tsx';

const VOICES: [string, string][] = [
  ['en-US-AvaMultilingualNeural', 'Ava (female, warm)'],
  ['en-US-AndrewMultilingualNeural', 'Andrew (male, warm)'],
  ['en-US-EmmaMultilingualNeural', 'Emma (female, bright)'],
  ['en-US-BrianMultilingualNeural', 'Brian (male, casual)'],
  ['en-US-JennyNeural', 'Jenny (female, clear)'],
  ['en-US-GuyNeural', 'Guy (male, newsy)'],
];

export function SettingsPage() {
  const { user, update, status, repo, account, signOut, engine } = useApp();
  const { speak } = useSpeak();
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
            <select value={s.voice} onChange={(e) => set('voice', e.target.value)} disabled={engine.kind !== 'azure'}>
              {VOICES.map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
            <button className="btn small" onClick={() => speak("Hi! I'm your Speakly tutor. Let's practise speaking together.")}>
              <Icon name="volume" size={16} /> Test
            </button>
          </div>
          {engine.kind !== 'azure' && <div className="small muted">Natural voices need Azure Speech. Using your browser's voice for now.</div>}
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
