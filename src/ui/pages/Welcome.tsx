import { useState } from 'react';
import { go } from '../../lib/router.ts';
import { useApp } from '../../lib/store.tsx';
import { BaselineForm } from '../components/Baseline.tsx';
import { Icon } from '../components/Icon.tsx';
import { MicCheck } from '../components/MicCheck.tsx';

const STEPS = ['Welcome', 'Goals', 'Earlier scores', 'Microphone', 'Start'];

/** First-run setup: name, goals, earlier scores, microphone check, then the level test. */
export function Welcome() {
  const { user, update, account } = useApp();
  const [step, setStep] = useState(0);
  const s = user.settings;
  const next = () => setStep((x) => Math.min(STEPS.length - 1, x + 1));
  const finish = (to: string) => {
    update((u) => (u.onboarded = true));
    go(to);
  };

  return (
    <div className="stack" style={{ maxWidth: 640, margin: '0 auto' }}>
      <div className="row small muted">
        {STEPS.map((t, i) => (
          <span key={t} className={`chip ${i === step ? 'brand' : i < step ? 'good' : ''}`}>
            {i + 1}. {t}
          </span>
        ))}
      </div>

      {step === 0 && (
        <div className="card stack">
          <h1>Welcome to Speakly</h1>
          <p>
            Speakly is built for speaking: real pronunciation scores, a tutor you talk to, and a path from A1 to C2 that skips what you already know. Five short steps and you're ready.
          </p>
          <label className="field">
            <span>What should the tutor call you?</span>
            <input type="text" value={user.name || account?.name?.split(' ')[0] || ''} onChange={(e) => update((u) => (u.name = e.target.value))} />
          </label>
          <button className="btn primary big" onClick={next} style={{ alignSelf: 'flex-start' }}>
            Next <Icon name="next" />
          </button>
        </div>
      )}

      {step === 1 && (
        <div className="card stack">
          <h2>Your goals</h2>
          <label className="field">
            <span>Daily practice: {s.dailyGoalMinutes} minutes</span>
            <input type="range" min={10} max={60} step={5} value={s.dailyGoalMinutes} onChange={(e) => update((u) => (u.settings.dailyGoalMinutes = Number(e.target.value)))} />
          </label>
          <div className="grid grid-2">
            <label className="field">
              <span>TOEFL exam date (optional)</span>
              <input type="date" value={s.examDate ?? ''} onChange={(e) => update((u) => (u.settings.examDate = e.target.value || undefined))} />
            </label>
            <label className="field">
              <span>Target speaking band (optional)</span>
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
          <button className="btn primary big" onClick={next} style={{ alignSelf: 'flex-start' }}>
            Next <Icon name="next" />
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="card stack">
          <h2>Earlier test scores</h2>
          <p className="muted">If you have scores from an earlier English test (for example EF SET), add them so you can see how far you've come. You can skip this.</p>
          <BaselineForm onSaved={next} />
          <button className="btn ghost" onClick={next} style={{ alignSelf: 'flex-start' }}>
            Skip
          </button>
        </div>
      )}

      {step === 3 && (
        <div className="card stack">
          <h2>Microphone check</h2>
          <p className="muted">About 20 seconds. A bad microphone or a noisy room makes pronunciation scores unfair, so it's worth checking once. Headphones work best.</p>
          <MicCheck />
          <button className="btn" onClick={next} style={{ alignSelf: 'flex-start' }}>
            {user.micCheck ? 'Next' : 'Skip for now'} <Icon name="next" size={16} />
          </button>
        </div>
      )}

      {step === 4 && (
        <div className="card stack">
          <h2>Ready</h2>
          <p>
            Start with the <b>fast-track level test</b>: one short block per level. Every level you pass is marked done, so you begin exactly where you need practice.
          </p>
          <div className="row">
            <button className="btn primary big" onClick={() => finish('/placement')}>
              <Icon name="target" /> Take the level test
            </button>
            <button className="btn" onClick={() => finish('/today')}>
              Go to Today
            </button>
          </div>
        </div>
      )}

      {step < 4 && (
        <button className="btn ghost small" onClick={() => finish('/today')} style={{ alignSelf: 'center' }}>
          Skip setup
        </button>
      )}
    </div>
  );
}
