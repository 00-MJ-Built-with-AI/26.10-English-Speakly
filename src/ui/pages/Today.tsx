import { useEffect, useState } from 'react';
import { soundById, SOUNDS } from '../../content/sounds.ts';
import { UNITS } from '../../content/units.ts';
import { currentUnit, unitState } from '../../engine/path.ts';
import { minutesToday, streak } from '../../engine/progress.ts';
import { overallSpeaking, toeflBandOf } from '../../engine/scoring.ts';
import { LEARNED_BOX, startOfDay } from '../../engine/srs.ts';
import { href } from '../../lib/router.ts';
import { useApp } from '../../lib/store.tsx';
import { SKILLS, type Attempt, type Mistake, type UnitPart } from '../../lib/types.ts';
import { Icon } from '../components/Icon.tsx';
import { ScoreRing, SKILL_COLORS, SKILL_LABELS } from '../components/ScoreRing.tsx';

interface PlanItem {
  to: string;
  icon: string;
  title: string;
  desc: string;
  minutes: number;
  done: boolean;
}

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export function Today() {
  const { user, repo, status, account } = useApp();
  const [due, setDue] = useState(0);
  const [today, setToday] = useState<Attempt[]>([]);
  useEffect(() => {
    repo.list<Mistake>('mistakes', { dueBefore: Date.now() }).then((m) => setDue(m.filter((x) => x.box < LEARNED_BOX).length));
    repo.list<Attempt>('attempts', { since: startOfDay(Date.now()) }).then(setToday);
  }, [repo]);

  const unit = currentUnit(user);
  const st = unit ? unitState(user, unit.id) : null;
  const didToday = (kinds: Attempt['kind'][], unitId?: string) => today.some((a) => kinds.includes(a.kind) && (!unitId || a.unitId === unitId));

  const plan: PlanItem[] = [];
  if (due > 0) plan.push({ to: '/review', icon: 'repeat', title: `Review ${Math.min(due, 15)} mistakes`, desc: 'Say your past mistakes correctly', minutes: 5, done: didToday(['review']) });
  if (unit && st) {
    if (!st.checked) {
      plan.push({ to: `/unit/${unit.id}/check`, icon: 'target', title: `Unit check: ${unit.title}`, desc: `${unit.level} · test out if you already know it`, minutes: 4, done: false });
    } else {
      const missing = (['pronunciation', 'grammar', 'task'] as UnitPart[]).find((p) => !st.parts[p].passed && !st.parts[p].practiced);
      const lesson =
        missing === 'pronunciation'
          ? { to: `/practice/shadow?unit=${unit.id}`, title: 'Shadowing', icon: 'ear' }
          : missing === 'grammar'
            ? { to: `/grammar/${unit.id}`, title: `Grammar: ${unit.grammar.name}`, icon: 'bolt' }
            : missing === 'task'
              ? { to: `/tutor?kind=unit&unit=${unit.id}`, title: `Role-play: ${unit.roleplay.title}`, icon: 'users' }
              : { to: `/unit/${unit.id}/check`, title: `Check again: ${unit.title}`, icon: 'target' };
      plan.push({ ...lesson, desc: `${unit.level} · ${unit.title}`, minutes: 8, done: didToday(['shadow', 'fast', 'roleplay', 'testout', 'lesson'], unit.id) });
    }
  }
  const measured = SOUNDS.filter((s) => user.sounds[s.id] != null).sort((a, b) => user.sounds[a.id] - user.sounds[b.id]);
  const focus = measured.length && user.sounds[measured[0].id] < 80 ? measured[0] : soundById(unit?.sounds[0] ?? 'th-voiceless')!;
  plan.push({ to: `/practice/sounds/${focus.id}`, icon: 'wave', title: `Sound focus: ${focus.title}`, desc: user.sounds[focus.id] != null ? `Your score: ${Math.round(user.sounds[focus.id])}` : 'Arabic-speaker trouble spot', minutes: 4, done: didToday(['sounds']) });
  const dow = new Date().getDay();
  if (dow === 3 || dow === 6) plan.push({ to: '/toefl/interview', icon: 'trophy', title: 'TOEFL: Take an Interview', desc: '4 questions, 45 seconds each', minutes: 6, done: didToday(['toefl']) });
  else if (dow % 2 === 0 && unit) plan.push({ to: `/tutor?kind=roleplay&unit=${unit.id}`, icon: 'users', title: `Role-play: ${unit.roleplay.title}`, desc: 'Real situation with the tutor', minutes: 8, done: didToday(['roleplay']) });
  else plan.push({ to: '/tutor', icon: 'chat', title: 'Conversation with your tutor', desc: 'Hands-free, any topic', minutes: 8, done: didToday(['tutor']) });
  plan.push({ to: '/practice/fast', icon: 'bolt', title: 'Speak fast warm-up', desc: 'Start talking within 3 seconds', minutes: 3, done: didToday(['fast']) });

  const mins = minutesToday(user);
  const goal = user.settings.dailyGoalMinutes;
  const s = streak(user);
  const overall = overallSpeaking(user);
  const done = UNITS.filter((u) => unitState(user, u.id).status === 'done').length;
  const name = user.name || account?.name?.split(' ')[0] || '';

  return (
    <div className="stack">
      <div className="spread">
        <div>
          <h1>
            {greeting()}
            {name ? `, ${name}` : ''}
          </h1>
          <p className="muted" style={{ margin: 0 }}>
            {unit ? `Working on ${unit.level}: ${unit.title}` : 'All units complete. Keep your speaking sharp.'}
          </p>
        </div>
        <div className="row">
          <span className="chip" title="Days in a row">
            <Icon name="flame" size={16} /> {s} day{s === 1 ? '' : 's'}
          </span>
          <span className="chip">{done}/{UNITS.length} units</span>
        </div>
      </div>

      {(!status.speech || !status.tutor || repo.kind === 'local') && (
        <a className="banner" href={href('/settings')}>
          Test mode: {[repo.kind === 'local' && 'progress is saved on this device only', !status.speech && 'pronunciation scores are estimates', !status.tutor && 'the tutor is a simple stand-in'].filter(Boolean).join('; ')}. See Settings to connect everything.
        </a>
      )}

      <div className="card">
        <div className="spread">
          <h2 style={{ margin: 0 }}>Today's plan</h2>
          <span className="small muted">
            {mins} / {goal} min
          </span>
        </div>
        <div className="bar" style={{ margin: '10px 0 14px' }}>
          <span style={{ width: `${Math.min(100, (mins / goal) * 100)}%`, background: mins >= goal ? 'var(--good)' : undefined }} />
        </div>
        {plan.map((p) => (
          <a key={p.to + p.title} className="list-item" href={href(p.to)}>
            <span className="icon-tile" style={p.done ? { background: 'var(--good-soft)', color: 'var(--good)' } : undefined}>
              <Icon name={p.done ? 'check' : p.icon} />
            </span>
            <span className="grow">
              <b style={p.done ? { textDecoration: 'line-through', color: 'var(--muted)' } : undefined}>{p.title}</b>
              <div className="small muted">{p.desc}</div>
            </span>
            <span className="small faint">{p.minutes} min</span>
          </a>
        ))}
      </div>

      <div className="card">
        <div className="spread">
          <h2 style={{ margin: 0 }}>Your speaking</h2>
          <a href={href('/progress')} className="small">
            Details →
          </a>
        </div>
        <div className="grid grid-4" style={{ marginTop: 14 }}>
          {SKILLS.map((k) => (
            <ScoreRing key={k} value={user.skills[k]} color={SKILL_COLORS[k]} label={SKILL_LABELS[k]} size={84} />
          ))}
        </div>
        {overall != null && (
          <p className="small muted" style={{ marginTop: 12, marginBottom: 0 }}>
            Overall speaking {overall} · estimated TOEFL speaking band {(user.toeflBand ?? toeflBandOf(overall)).toFixed(1)} / 6
          </p>
        )}
      </div>
    </div>
  );
}
