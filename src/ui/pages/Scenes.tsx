import { useState } from 'react';
import { DEBATE_MOTIONS, PHONE_SCENARIOS, SMALLTALK_SCENARIOS, type ExtraScenario } from '../../content/scenarios.ts';
import { workingLevel } from '../../engine/path.ts';
import { levelIndex } from '../../engine/scoring.ts';
import { go, href } from '../../lib/router.ts';
import { useApp } from '../../lib/store.tsx';
import { Icon } from '../components/Icon.tsx';

function ScenarioList({ items, kind }: { items: ExtraScenario[]; kind: 'phone' | 'smalltalk' }) {
  return (
    <div className="grid grid-2">
      {items.map((x) => (
        <a key={x.id} className="list-item" href={href(`/tutor?kind=${kind}&sc=${x.id}`)} style={{ marginTop: 0 }}>
          <span className="icon-tile">
            <Icon name={kind === 'phone' ? 'chat' : 'users'} />
          </span>
          <span className="grow">
            <div className="row">
              <b>{x.scenario.title}</b>
              <span className="chip">{x.level}</span>
            </div>
            <div className="small muted">Goal: {x.scenario.userGoal}.</div>
          </span>
        </a>
      ))}
    </div>
  );
}

export function PhoneCalls() {
  return (
    <div className="stack">
      <h1>Phone calls</h1>
      <p className="muted">Calls are hard: no faces, no gestures, and details like names and numbers. The line sounds like a real phone and the other person speaks a little faster.</p>
      <ScenarioList items={PHONE_SCENARIOS} kind="phone" />
    </div>
  );
}

export function SmallTalk() {
  return (
    <div className="stack">
      <h1>Small talk and networking</h1>
      <p className="muted">Short, friendly conversations: starting, keeping them going with follow-up questions, and ending them politely. Each one shows useful phrases before you start.</p>
      <ScenarioList items={SMALLTALK_SCENARIOS} kind="smalltalk" />
    </div>
  );
}

/** Pick a motion and a side; the tutor argues the other side. */
export function Debate() {
  const { user } = useApp();
  const level = workingLevel(user);
  const near = DEBATE_MOTIONS.filter((m) => Math.abs(levelIndex(m.level) - levelIndex(level)) <= 1);
  const [motion, setMotion] = useState(near[0]?.motion ?? DEBATE_MOTIONS[0].motion);
  const [own, setOwn] = useState('');
  const [side, setSide] = useState<'for' | 'against'>('for');
  const chosen = own.trim() || motion;
  return (
    <div className="stack">
      <h1>Debate</h1>
      <p className="muted">Defend a position while the tutor argues the opposite and pushes back. Great for meetings and TOEFL opinion questions.</p>
      <div className="card stack">
        <div className="section-title">Motion</div>
        {(near.length ? near : DEBATE_MOTIONS).map((m) => (
          <label key={m.motion} className="row" style={{ cursor: 'pointer' }}>
            <input type="radio" name="motion" checked={!own && motion === m.motion} onChange={() => (setOwn(''), setMotion(m.motion))} />
            <span>{m.motion}</span>
            <span className="chip">{m.level}</span>
          </label>
        ))}
        <input type="text" placeholder="Or write your own motion…" value={own} onChange={(e) => setOwn(e.target.value)} />
        <div className="section-title">Your side</div>
        <div className="row">
          <button className={`btn ${side === 'for' ? 'primary' : ''}`} onClick={() => setSide('for')}>
            For
          </button>
          <button className={`btn ${side === 'against' ? 'primary' : ''}`} onClick={() => setSide('against')}>
            Against
          </button>
        </div>
        <button className="btn primary big" onClick={() => go(`/tutor?kind=debate&topic=${encodeURIComponent(chosen)}&side=${side}`)} disabled={!chosen}>
          <Icon name="mic" /> Debate {side === 'for' ? 'for' : 'against'}
        </button>
      </div>
    </div>
  );
}

/** Job ad + CV, saved to your account, for a realistic mock interview. */
export function InterviewPrep() {
  const { user, update } = useApp();
  const [ad, setAd] = useState(user.interviewPrep?.ad ?? '');
  const [cv, setCv] = useState(user.interviewPrep?.cv ?? '');
  const ready = ad.trim().length > 40 && cv.trim().length > 40;
  return (
    <div className="stack">
      <h1>Interview from your CV</h1>
      <p className="muted">Paste a real job ad and your CV. The tutor interviews you for that exact role, follows up on vague answers, and gives a report on each answer at the end.</p>
      <div className="card stack">
        <label className="field">
          <span>Job ad</span>
          <textarea rows={8} value={ad} onChange={(e) => setAd(e.target.value)} placeholder="Paste the job title, responsibilities and requirements…" />
        </label>
        <label className="field">
          <span>Your CV</span>
          <textarea rows={8} value={cv} onChange={(e) => setCv(e.target.value)} placeholder="Paste your CV as text (experience, skills, education)…" />
        </label>
        <p className="small faint">Saved to your account so you can practise again. The AI tutor sees them during the interview.</p>
        <div className="row">
          <button
            className="btn primary big"
            disabled={!ready}
            onClick={() => {
              update((u) => (u.interviewPrep = { ad: ad.trim(), cv: cv.trim() }));
              go('/tutor?kind=job');
            }}
          >
            <Icon name="mic" /> Start the interview
          </button>
          {user.interviewPrep && (
            <button
              className="btn ghost danger"
              onClick={() => {
                update((u) => delete u.interviewPrep);
                setAd('');
                setCv('');
              }}
            >
              Clear saved ad and CV
            </button>
          )}
        </div>
        {!ready && <div className="small muted">Add both the job ad and your CV to start.</div>}
      </div>
    </div>
  );
}
