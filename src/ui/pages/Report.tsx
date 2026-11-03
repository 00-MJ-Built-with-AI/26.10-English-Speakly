import { useEffect, useState } from 'react';
import { SOUNDS } from '../../content/sounds.ts';
import { UNITS } from '../../content/units.ts';
import { confirmedLevel, levelProgress, unitState } from '../../engine/path.ts';
import { bestStreak, streak } from '../../engine/progress.ts';
import { cefrOf, LEVEL_NAMES, overallSpeaking, toeflBandOf } from '../../engine/scoring.ts';
import { useApp } from '../../lib/store.tsx';
import { SKILLS, type Attempt, type Checkup } from '../../lib/types.ts';
import { LEVELS } from '../../../shared/tasks.ts';
import { Icon } from '../components/Icon.tsx';
import { ScoreRing, SKILL_COLORS, SKILL_LABELS } from '../components/ScoreRing.tsx';
import { readiness } from '../../engine/toeflExtras.ts';
import { analyzeBands, gapSummary, weakTypes } from '../../engine/toeflPlan.ts';
import { SECTION_LABELS, SECTIONS, type Section } from '../../engine/toeflScale.ts';

const KIND_NAMES: Partial<Record<Attempt['kind'], string>> = {
  tutor: 'Conversations',
  roleplay: 'Role-plays',
  debate: 'Debates',
  phone: 'Phone calls',
  interview: 'Mock interviews',
  journal: 'Journal entries',
  toefl: 'TOEFL practice',
  testout: 'Unit checks',
  shadow: 'Shadowing',
  sounds: 'Sound drills',
};

/** A one-page progress report to save as PDF and share. */
export function Report() {
  const { user, account, repo } = useApp();
  const [recent, setRecent] = useState<Attempt[]>([]);
  const [checkup, setCheckup] = useState<Checkup | null>(null);
  useEffect(() => {
    repo.list<Attempt>('attempts', { since: Date.now() - 30 * 86_400_000 }).then(setRecent);
    repo.list<Checkup>('checkups', { limit: 1 }).then((c) => setCheckup(c[0] ?? null));
  }, [repo]);

  const overall = overallSpeaking(user);
  const band = user.toeflBand ?? (overall != null ? toeflBandOf(overall) : null);
  const minutes30 = Math.round(recent.reduce((a, x) => a + x.seconds, 0) / 60);
  const totalMin = Math.round(Object.values(user.daily).reduce((a, b) => a + b, 0) / 60);
  const done = UNITS.filter((u) => unitState(user, u.id).status === 'done').length;
  const byKind = Object.entries(
    recent.reduce<Record<string, number>>((m, a) => {
      if (KIND_NAMES[a.kind]) m[KIND_NAMES[a.kind]!] = (m[KIND_NAMES[a.kind]!] ?? 0) + 1;
      return m;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);
  const sounds = checkup ? SOUNDS.filter((s) => checkup.sounds[s.id] != null).sort((a, b) => checkup.sounds[b.id] - checkup.sounds[a.id]) : [];
  const name = user.name || account?.name || 'Learner';

  return (
    <div className="stack report">
      <div className="row no-print">
        <button className="btn primary" onClick={() => window.print()}>
          <Icon name="book" /> Save as PDF / print
        </button>
        <span className="small muted">In the print dialog, choose "Save as PDF".</span>
      </div>

      <div className="card stack">
        <div className="spread">
          <div>
            <h1 style={{ marginBottom: 2 }}>English speaking report</h1>
            <div className="muted">
              {name} · {new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="small muted">Overall speaking</div>
            <div style={{ fontSize: '2rem', fontWeight: 800 }}>
              {overall ?? '–'} {overall != null && <span style={{ fontSize: '1rem' }}>{cefrOf(overall)}</span>}
            </div>
          </div>
        </div>
        <div className="grid grid-4">
          {SKILLS.map((k) => (
            <ScoreRing key={k} value={user.skills[k]} color={SKILL_COLORS[k]} label={SKILL_LABELS[k]} size={90} />
          ))}
        </div>
        <div className="grid grid-3">
          <div>
            <div className="small muted">TOEFL iBT speaking (estimate)</div>
            <b>{band != null ? `${band.toFixed(1)} / 6` : 'not measured'}</b>
          </div>
          <div>
            <div className="small muted">Confirmed level</div>
            <b>{confirmedLevel(user) ? `${confirmedLevel(user)} ${LEVEL_NAMES[confirmedLevel(user)!]}` : 'in progress'}</b>
          </div>
          <div>
            <div className="small muted">Units completed</div>
            <b>
              {done} of {UNITS.length}
            </b>
          </div>
        </div>
        {user.baseline?.speaking != null && overall != null && (
          <div className="soft small">
            Speaking was <b>{user.baseline.speaking}</b> ({cefrOf(user.baseline.speaking)}) on {user.baseline.test || 'an earlier test'}
            {user.baseline.date ? ` in ${user.baseline.date}` : ''}; now <b>{overall}</b> ({cefrOf(overall)}), {overall - user.baseline.speaking >= 0 ? '+' : ''}
            {overall - user.baseline.speaking}.
          </div>
        )}
      </div>

      <div className="grid grid-2">
        <div className="card stack">
          <h3 style={{ margin: 0 }}>Practice</h3>
          <div className="small">
            Last 30 days: <b>{minutes30} minutes</b> · all time: <b>{totalMin} minutes</b>
          </div>
          <div className="small">
            Current streak <b>{streak(user)}</b> days · best <b>{bestStreak(user)}</b>
          </div>
          {byKind.slice(0, 6).map(([k, n]) => (
            <div key={k} className="spread small">
              <span>{k}</span>
              <b>{n}</b>
            </div>
          ))}
        </div>
        <div className="card stack">
          <h3 style={{ margin: 0 }}>Path by level</h3>
          {LEVELS.map((l) => {
            const p = levelProgress(user, l);
            return (
              <div key={l}>
                <div className="spread small">
                  <b>
                    {l} {LEVEL_NAMES[l]}
                  </b>
                  <span>
                    {p.done}/{p.total}
                  </span>
                </div>
                <div className="bar">
                  <span style={{ width: `${(p.done / p.total) * 100}%`, background: p.done === p.total ? 'var(--good)' : undefined }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <ToeflReport recent={recent} />

      {sounds.length > 0 && checkup && (
        <div className="card stack">
          <h3 style={{ margin: 0 }}>Pronunciation check-up ({new Date(checkup.at).toLocaleDateString()})</h3>
          <div className="grid grid-2 small">
            <div>
              <div className="muted">Strongest sounds</div>
              {sounds.slice(0, 4).map((s) => (
                <div key={s.id} className="spread">
                  <span>{s.title}</span>
                  <b>{checkup.sounds[s.id]}</b>
                </div>
              ))}
            </div>
            <div>
              <div className="muted">Working on</div>
              {sounds
                .slice(-4)
                .reverse()
                .map((s) => (
                  <div key={s.id} className="spread">
                    <span>{s.title}</span>
                    <b>{checkup.sounds[s.id]}</b>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
      <p className="small faint">
        Scores are estimates from Speakly's speech analysis (Azure pronunciation assessment) and AI-graded speaking tasks, on a 0-100 scale with CEFR bands. They are not an official test result.
      </p>
    </div>
  );
}

const VERDICT_TEXT = { ready: 'Ready to book', close: 'Close to the goal', 'not-yet': 'Not ready yet', 'need-data': 'Not enough data yet' } as const;

/** TOEFL bands per skill against the goal, readiness, and what to work on. */
function ToeflReport({ recent }: { recent: Attempt[] }) {
  const { user } = useApp();
  const t = user.toefl;
  const r = readiness(t, user.toeflBand, t.target, t.minimum);
  if (r.verdict === 'need-data' && !t.scores.length && !t.log.length) return null;
  const official = t.scores.find((x) => x.source === 'official');
  const bands = Object.fromEntries(SECTIONS.map((s) => [s, r.skills.find((x) => x.section === s)?.band ?? 4])) as Record<Section, number>;
  const weak = weakTypes(t.typeStats).slice(0, 3);
  const toeflMin = Math.round(recent.filter((a) => a.kind === 'toefl').reduce((a, x) => a + x.seconds, 0) / 60);
  const typing = t.typing.length ? Math.round(t.typing.slice(-5).reduce((a, b) => a + b, 0) / Math.min(5, t.typing.length)) : null;
  return (
    <div className="card stack" style={{ breakInside: 'avoid' }}>
      <div className="spread">
        <h3 style={{ margin: 0 }}>TOEFL iBT</h3>
        <span className="small muted">
          Goal band {t.target.toFixed(1)} (minimum {t.minimum.toFixed(1)}) for KAUST
        </span>
      </div>
      <table className="small" style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr className="muted">
            <th style={{ textAlign: 'left' }}>Skill</th>
            <th>Estimate</th>
            <th>Likely range</th>
            <th>Last official</th>
            <th>To target</th>
          </tr>
        </thead>
        <tbody>
          {r.skills.map((s) => (
            <tr key={s.section} style={{ borderTop: '1px solid var(--line)' }}>
              <td>{SECTION_LABELS[s.section]}</td>
              <td style={{ textAlign: 'center' }}>
                <b>{s.band?.toFixed(1) ?? '–'}</b>
              </td>
              <td style={{ textAlign: 'center' }}>{s.lo != null ? `${s.lo.toFixed(1)}-${s.hi!.toFixed(1)}` : '–'}</td>
              <td style={{ textAlign: 'center' }}>{official ? official.bands[s.section].toFixed(1) : '–'}</td>
              <td style={{ textAlign: 'center' }}>{s.band == null ? '–' : s.band >= t.target ? '✓' : `+${(t.target - s.band).toFixed(1)}`}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="small">
        <b>{VERDICT_TEXT[r.verdict]}.</b> {r.verdict !== 'need-data' && gapSummary(analyzeBands(bands, t.target, t.minimum))}
      </div>
      <div className="grid grid-3 small">
        <div>
          <div className="muted">Official result</div>
          <b>{official ? `${official.overall.toFixed(1)} on ${official.date}` : 'none yet'}</b>
        </div>
        <div>
          <div className="muted">TOEFL practice, last 30 days</div>
          <b>{toeflMin} minutes</b>
        </div>
        <div>
          <div className="muted">Typing speed</div>
          <b>{typing != null ? `${typing} wpm` : '–'}</b>
        </div>
      </div>
      {weak.length > 0 && (
        <div className="small">
          <span className="muted">Weakest question types:</span> {weak.map((w) => `${w} (${Math.round((t.typeStats[w].right / t.typeStats[w].total) * 100)}%)`).join(', ')}
        </div>
      )}
      <div className="small faint">
        Estimates from AI-written practice items, mocks and section tests{Object.keys(t.calibration).length ? ', calibrated against the official result' : ''}; not an official score.
      </div>
    </div>
  );
}
