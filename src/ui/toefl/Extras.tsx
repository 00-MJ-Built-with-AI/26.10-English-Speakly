import { useEffect, useMemo, useRef, useState } from 'react';
import type { GenOut, PlanCheck } from '../../../shared/toefl.ts';
import { daysUntil } from '../../engine/exam.ts';
import { readiness, reviewNext, todayKey, weekKey, DAY_MS, planToIcs, type Verdict } from '../../engine/toeflExtras.ts';
import { analyzeBands, buildPlan, planOffset, type PlanDay } from '../../engine/toeflPlan.ts';
import { bandHistory, skillBand } from '../../engine/toeflSkill.ts';
import { SECTION_LABELS, SECTIONS, type Section } from '../../engine/toeflScale.ts';
import { aiTask } from '../../lib/api.ts';
import { toeflItem } from '../../ai/toeflBank.ts';
import { href } from '../../lib/router.ts';
import { useApp } from '../../lib/store.tsx';
import type { Attempt } from '../../lib/types.ts';
import { Icon } from '../components/Icon.tsx';
import { PracticeRunner } from './Practice.tsx';
import { recordOutcome } from './record.ts';
import { McqList, WritingTask, type TaskOutcome } from './tasks.tsx';

// ---- Wrong-answer review ----

/** Missed questions come back after a day, then three days; two right answers and they're done. */
export function WrongReview() {
  const { user, update } = useApp();
  const [queue] = useState(() => user.toefl.review.filter((r) => r.due <= Date.now()).map((r) => r.id));
  const [i, setI] = useState(0);
  const [answered, setAnswered] = useState<boolean | null>(null);
  const item = user.toefl.review.find((r) => r.id === queue[i]);
  function done(o: TaskOutcome) {
    const right = o.points === 1;
    setAnswered(right);
    update((u) => {
      const k = u.toefl.review.findIndex((r) => r.id === queue[i]);
      if (k < 0) return;
      const next = reviewNext(u.toefl.review[k], right);
      if (next) u.toefl.review[k] = next;
      else u.toefl.review.splice(k, 1);
      const t = (u.toefl.typeStats[o.marks[0].type] ??= { right: 0, total: 0 });
      t.total++;
      if (right) t.right++;
    });
  }
  const total = user.toefl.review.length;
  if (!queue.length || i >= queue.length || (!item && answered == null)) {
    return (
      <div className="stack">
        <h1>Wrong-answer review</h1>
        <div className="card stack">
          <p style={{ margin: 0 }}>{queue.length ? 'All done for today.' : 'Nothing due today.'}</p>
          <div className="small muted">
            {total} question{total === 1 ? '' : 's'} in review. Every question you miss in practice or a test comes back after a day, then after three days, until you get it right twice.
          </div>
          <a className="btn" href={href('/toefl')} style={{ alignSelf: 'flex-start' }}>
            TOEFL overview
          </a>
        </div>
      </div>
    );
  }
  return (
    <div className="stack">
      <h1>Wrong-answer review</h1>
      <div className="small muted">
        Question {i + 1} of {queue.length}
      </div>
      <div className="card stack" key={queue[i]}>
        {item?.context && (
          <details>
            <summary className="small">Show the text or transcript</summary>
            <p className="small" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
              {item.context}
            </p>
          </details>
        )}
        {item && <McqList questions={[item.question]} mode="practice" onSubmit={done} context={item.context} submitLabel="Check" />}
        {answered != null && (
          <div className="row">
            <span className={`chip ${answered ? 'good' : 'bad'}`}>{answered ? 'Right: it comes back once more, or leaves the list.' : 'Missed again: back tomorrow.'}</span>
            <button className="btn primary" onClick={() => (setI(i + 1), setAnswered(null))}>
              Next <Icon name="next" size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Readiness ----

const VERDICT: Record<Verdict, { label: string; cls: string; text: string }> = {
  ready: { label: 'Ready to book', cls: 'good', text: 'Every skill is at your target, and even a weaker day should clear your minimum.' },
  close: { label: 'Close', cls: 'ok', text: 'Every skill clears your minimum, but not all reach the target yet. Booking now is a risk; a few more weeks on the gaps would make it safer.' },
  'not-yet': { label: 'Not yet', cls: 'bad', text: 'At least one skill is below your minimum. Focus there before booking.' },
  'need-data': { label: 'Need more data', cls: '', text: 'Take a section test for each skill without a band (or the full mock) to get a prediction.' },
};

export function ReadinessCard() {
  const { user } = useApp();
  const t = user.toefl;
  const r = readiness(t, user.toeflBand, t.target, t.minimum);
  const v = VERDICT[r.verdict];
  return (
    <div className="card stack">
      <div className="spread">
        <h3 style={{ margin: 0 }}>Readiness</h3>
        <span className={`chip ${v.cls}`} style={{ fontSize: '1rem' }}>
          {v.label}
        </span>
      </div>
      {r.skills.map((s) => (
        <div key={s.section} className="spread small">
          <span>{SECTION_LABELS[s.section]}</span>
          <span className={s.band == null ? 'muted' : ''}>
            {s.band == null ? 'no data' : `${s.band.toFixed(1)} (likely ${s.lo!.toFixed(1)}-${s.hi!.toFixed(1)})`}
            {s.band != null && s.points < 2 && <span className="muted"> · few results</span>}
          </span>
        </div>
      ))}
      <div className="small muted">{v.text}</div>
    </div>
  );
}

// ---- Today's plan with check-off and calendar export ----

export function todaysPlan(user: ReturnType<typeof useApp>['user']): { plan: PlanDay[]; days: number | null } {
  const t = user.toefl;
  const bands = Object.fromEntries(SECTIONS.map((s) => [s, skillBand(t, s, user.toeflBand)?.band ?? 4])) as Record<Section, number>;
  const gap = analyzeBands(bands, t.target, t.minimum);
  const daysLeft = user.settings.examDate ? daysUntil(user.settings.examDate) : null;
  const days = daysLeft != null && daysLeft > 0 ? daysLeft : null;
  return { plan: buildPlan(gap, days, 50, planOffset()), days };
}

export function TodayPlan() {
  const { user, update } = useApp();
  const t = user.toefl;
  const { plan } = todaysPlan(user);
  const today = plan[0];
  const date = todayKey();
  const done = t.planChecks.date === date ? t.planChecks.done : [];
  const due = t.review.filter((r) => r.due <= Date.now()).length;
  const items = [...(due ? [{ label: `Wrong-answer review (${due} due)`, to: '/toefl/review', minutes: Math.min(10, 1 + Math.ceil(due / 2)) }] : []), ...today.items];
  const [time, setTime] = useState('19:00');
  function toggle(to: string) {
    update((u) => {
      const cur = u.toefl.planChecks.date === date ? u.toefl.planChecks.done : [];
      u.toefl.planChecks = { date, done: cur.includes(to) ? cur.filter((x) => x !== to) : [...cur, to] };
    });
  }
  function download() {
    const [h, m] = time.split(':').map(Number);
    const ics = planToIcs(plan, new Date(), h || 19, m || 0);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
    a.download = 'toefl-plan.ics';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const doneCount = items.filter((i) => done.includes(i.to)).length;
  return (
    <div className="card stack">
      <div className="spread">
        <h3 style={{ margin: 0 }}>Today's TOEFL plan</h3>
        <span className={`chip ${doneCount === items.length ? 'good' : ''}`}>
          {doneCount}/{items.length} done · {items.reduce((a, i) => a + i.minutes, 0)} min
        </span>
      </div>
      {items.map((i) => (
        <div key={i.to} className="list-item" style={{ marginTop: 0 }}>
          <input type="checkbox" checked={done.includes(i.to)} onChange={() => toggle(i.to)} aria-label={`Done: ${i.label}`} />
          <a className="grow" href={href(i.to)} style={done.includes(i.to) ? { textDecoration: 'line-through', color: 'var(--muted)' } : undefined}>
            {i.label}
          </a>
          <span className="small muted">{i.minutes} min</span>
        </div>
      ))}
      <div className="small muted">Weighted to the skills furthest from {t.target.toFixed(1)}. Wednesdays add a section test, Saturdays are a full mock.</div>
      <div className="row small">
        <span className="muted">Add the next {plan.length} days to your calendar at</span>
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} style={{ width: 'auto' }} />
        <button className="btn small" onClick={download}>
          <Icon name="path" size={14} /> Download .ics
        </button>
      </div>
    </div>
  );
}

// ---- Exam-day checklist ----

const CHECKLIST: { group: string; items: { id: string; text: string }[] }[] = [
  {
    group: 'A week before',
    items: [
      { id: 'confirm', text: 'Confirm the date, time and format (test center or Home Edition) in your ETS account.' },
      { id: 'id', text: 'Check your ID is valid and your name matches your ETS registration exactly.' },
      { id: 'rules', text: "Read ETS's current test-day rules for your format (they change; check ets.org/toefl)." },
      { id: 'mock-time', text: 'Take a full mock at the same time of day as your test.' },
      { id: 'kaust', text: 'Plan to send your scores to KAUST (KAUST lists code 4107 on its admissions page).' },
    ],
  },
  {
    group: 'Home Edition only',
    items: [
      { id: 'syscheck', text: "Run ETS's official equipment check on the exact computer and network you will use." },
      { id: 'room', text: 'Private, quiet room with the door closed; nobody can come in during the test.' },
      { id: 'desk', text: 'Clear desk: no papers, books, phones or second screens; check which note-taking materials ETS currently allows.' },
      { id: 'tech', text: 'Plug in power, close other apps, turn off notifications and updates, use headphones only if ETS allows them.' },
    ],
  },
  {
    group: 'Test center only',
    items: [
      { id: 'route', text: "Know the route and the arrival time ETS asks for; plan to be early." },
      { id: 'locker', text: 'Expect to leave your phone and bag outside the test room.' },
    ],
  },
  {
    group: 'The day before',
    items: [
      { id: 'light', text: 'Light review only: Listen and Repeat, the phrase bank, a few vocabulary cards. No full mock.' },
      { id: 'ready', text: 'Put your ID where you will see it; prepare water and a snack for the break.' },
      { id: 'sleep', text: 'Sleep at your normal time.' },
    ],
  },
  {
    group: 'Test day',
    items: [
      { id: 'warm', text: 'Warm up your voice for 10 minutes: read aloud, then answer two interview questions out loud.' },
      { id: 'type', text: 'Type one short practice email to warm up your fingers (no spellcheck!).' },
      { id: 'early', text: 'Arrive or log in early.' },
      { id: 'after', text: 'After the test: add your score report on the Scores page to get your next plan.' },
    ],
  },
];

export function ExamDay() {
  const { user, update } = useApp();
  const c = user.toefl.checklist;
  const daysLeft = user.settings.examDate ? daysUntil(user.settings.examDate) : null;
  const all = CHECKLIST.flatMap((g) => g.items);
  const done = all.filter((i) => c[i.id]).length;
  return (
    <div className="stack">
      <h1>Exam day</h1>
      <div className="card spread">
        <span>
          {daysLeft == null ? (
            <>
              No exam date yet. <a href={href('/toefl')}>Set it on the overview</a> (My exam).
            </>
          ) : daysLeft > 0 ? (
            <>
              <b style={{ fontSize: '1.6rem' }}>{daysLeft}</b> day{daysLeft === 1 ? '' : 's'} to go ({user.settings.examDate})
            </>
          ) : daysLeft === 0 ? (
            <b>Today is the day. Good luck!</b>
          ) : (
            <>The exam date has passed. Add your score on the Scores page.</>
          )}
        </span>
        <span className="chip">
          {done}/{all.length} ready
        </span>
      </div>
      {CHECKLIST.map((g) => (
        <div key={g.group} className="card stack">
          <h3 style={{ margin: 0 }}>{g.group}</h3>
          {g.items.map((i) => (
            <label key={i.id} className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
              <input type="checkbox" checked={Boolean(c[i.id])} onChange={(e) => update((u) => (u.toefl.checklist[i.id] = e.target.checked))} style={{ marginTop: 4 }} />
              <span style={c[i.id] ? { textDecoration: 'line-through', color: 'var(--muted)' } : undefined}>{i.text}</span>
            </label>
          ))}
        </div>
      ))}
      <a className="small" href="https://www.ets.org/toefl" target="_blank" rel="noreferrer">
        ETS TOEFL site ↗
      </a>
    </div>
  );
}

// ---- Weekly report ----

const SPEAKING_TASKS = new Set(['repeat', 'coach', 'long-repeat', 'quick']);

/** Which skill an attempt practised, for minutes per skill. */
function attemptSkill(a: Attempt): Section | null {
  const d = (a.detail ?? {}) as { section?: Section; fullMock?: boolean; band?: number; task?: string };
  if (d.fullMock) return null;
  if (d.section) return d.section;
  if (d.band != null || (d.task && SPEAKING_TASKS.has(d.task))) return 'speaking';
  return null;
}

export function WeeklyReport() {
  const { user, repo } = useApp();
  const t = user.toefl;
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  useEffect(() => {
    repo.list<Attempt>('attempts', { limit: 500 }).then((a) => setAttempts(a.filter((x) => x.kind === 'toefl')));
  }, [repo]);
  const now = Date.now();
  const from = now - 7 * DAY_MS;
  const prev = from - 7 * DAY_MS;
  const minutes = (a: number, b: number) => {
    const out: Record<Section, number> = { reading: 0, listening: 0, writing: 0, speaking: 0 };
    for (const x of attempts) {
      const s = attemptSkill(x);
      if (s && x.at >= a && x.at < b) out[s] += x.seconds / 60;
    }
    return out;
  };
  const accuracy = (a: number, b: number) =>
    Object.fromEntries(
      SECTIONS.map((s) => {
        const xs = t.log.filter((x) => x.section === s && x.at >= a && x.at < b);
        const max = xs.reduce((m, x) => m + x.max, 0);
        return [s, max ? xs.reduce((m, x) => m + x.points, 0) / max : null];
      }),
    ) as Record<Section, number | null>;
  const mThis = minutes(from, now);
  const accThis = accuracy(from, now);
  const accPrev = accuracy(prev, from);
  const { plan } = todaysPlan(user);
  const planned: Record<Section, number> = { reading: 0, listening: 0, writing: 0, speaking: 0 };
  for (const d of plan.slice(0, 7)) for (const i of d.items) for (const s of SECTIONS) if (i.label.startsWith(SECTION_LABELS[s])) planned[s] += i.minutes;
  const weekTypes = { ...t.typeWeeks[weekKey(prev + 1)] };
  for (const [k, v] of Object.entries(t.typeWeeks[weekKey(now)] ?? {})) weekTypes[k] = { right: (weekTypes[k]?.right ?? 0) + v.right, total: (weekTypes[k]?.total ?? 0) + v.total };
  const weakest = Object.entries(weekTypes)
    .filter(([, v]) => v.total >= 3)
    .sort((a, b) => a[1].right / a[1].total - b[1].right / b[1].total)
    .slice(0, 3);
  const bandNow = (s: Section) => skillBand(t, s, user.toeflBand)?.band ?? null;
  const bandBefore = (s: Section) => bandHistory(t, s).filter((p) => p.at < from).pop()?.band ?? null;
  const focus = [...SECTIONS].sort((a, b) => (bandNow(a) ?? 4) - (bandNow(b) ?? 4)).filter((s) => (bandNow(s) ?? 4) < t.target).slice(0, 2);
  const pct = (x: number | null) => (x == null ? '–' : `${Math.round(x * 100)}%`);
  return (
    <div className="stack">
      <h1>Weekly TOEFL report</h1>
      <div className="small muted">
        The last 7 days, compared with the 7 days before. {new Date(from).toLocaleDateString()} – {new Date(now).toLocaleDateString()}
      </div>
      <div className="card">
        <div className="grid grid-4">
          {SECTIONS.map((s) => {
            const b = bandNow(s);
            const b0 = bandBefore(s);
            return (
              <div key={s} className="soft small stack" style={{ gap: 4 }}>
                <b>{SECTION_LABELS[s]}</b>
                <div>
                  Band {b == null ? '–' : b.toFixed(1)}
                  {b != null && b0 != null && b !== b0 && <span style={{ color: b > b0 ? 'var(--good)' : 'var(--bad)' }}> ({b > b0 ? '+' : ''}{(b - b0).toFixed(1)})</span>}
                </div>
                <div>
                  {Math.round(mThis[s])} of ~{planned[s]} planned min
                </div>
                <div className="muted">
                  Accuracy {pct(accThis[s])} (before: {pct(accPrev[s])})
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="card stack">
        <h3 style={{ margin: 0 }}>Weakest question types this week</h3>
        {weakest.length ? (
          weakest.map(([k, v]) => (
            <div key={k} className="spread small">
              <span>{k}</span>
              <span className="chip bad">
                {v.right}/{v.total} · {Math.round((v.right / v.total) * 100)}%
              </span>
            </div>
          ))
        ) : (
          <div className="small muted">Not enough answers this week yet.</div>
        )}
      </div>
      <div className="card stack">
        <h3 style={{ margin: 0 }}>Next week's focus</h3>
        {focus.length ? (
          <div className="row">
            {focus.map((s) => (
              <a key={s} className="btn" href={href(`/toefl/${s}`)}>
                {SECTION_LABELS[s]}
              </a>
            ))}
          </div>
        ) : (
          <div className="small">All skills are at your target. Keep them there with a mock a week.</div>
        )}
        {SECTIONS.some((s) => mThis[s] < planned[s] / 2) && <div className="small muted">You did less than half the planned time in some skills; the plan only works if most days get done.</div>}
      </div>
    </div>
  );
}

// ---- Question-type trends ----

/** Accuracy per question type for the last 8 weeks, as a heat table. */
export function TypeTrends() {
  const { user } = useApp();
  const weeks = useMemo(() => {
    const out: string[] = [];
    for (let k = 7; k >= 0; k--) out.push(weekKey(Date.now() - k * 7 * DAY_MS));
    return [...new Set(out)];
  }, []);
  const tw = user.toefl.typeWeeks;
  const types = Object.keys(user.toefl.typeStats)
    .filter((ty) => weeks.some((w) => tw[w]?.[ty]?.total))
    .sort((a, b) => (user.toefl.typeStats[b].total ?? 0) - (user.toefl.typeStats[a].total ?? 0))
    .slice(0, 12);
  if (!types.length) return null;
  const color = (p: number) => (p >= 0.8 ? 'var(--good)' : p >= 0.6 ? 'var(--warn, #d9a400)' : 'var(--bad)');
  return (
    <div className="card" style={{ overflowX: 'auto' }}>
      <h3>Trends by week</h3>
      <table className="small" style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>Type</th>
            {weeks.map((w) => (
              <th key={w} className="muted" style={{ fontWeight: 400, padding: '0 4px' }}>
                {w.slice(5)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {types.map((ty) => (
            <tr key={ty}>
              <td style={{ padding: '3px 6px 3px 0', whiteSpace: 'nowrap' }}>{ty}</td>
              {weeks.map((w) => {
                const v = tw[w]?.[ty];
                const p = v?.total ? v.right / v.total : null;
                return (
                  <td key={w} style={{ textAlign: 'center', padding: 2 }}>
                    {p == null ? (
                      <span className="faint">·</span>
                    ) : (
                      <span title={`${v!.right}/${v!.total}`} style={{ display: 'inline-block', minWidth: 34, borderRadius: 6, padding: '1px 4px', color: '#fff', background: color(p) }}>
                        {Math.round(p * 100)}
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---- Writing: 1-minute planner and tone ----

/** Plan an Academic Discussion post in 60 seconds, get the plan checked, then write it. */
export function EssayPlanner() {
  const { update } = useApp();
  const [data, setData] = useState<GenOut<'discussion'> | null>(null);
  const [plan, setPlan] = useState({ view: '', reason: '', example: '' });
  const [left, setLeft] = useState(60);
  const [phase, setPhase] = useState<'idle' | 'planning' | 'checking' | 'checked' | 'writing'>('idle');
  const [check, setCheck] = useState<PlanCheck | null>(null);
  const [error, setError] = useState<string | null>(null);
  const start = useRef(0);
  const planRef = useRef(plan);
  planRef.current = plan;

  async function load() {
    setError(null);
    setCheck(null);
    try {
      setData((await toeflItem({ kind: 'discussion', difficulty: 'standard' })) as GenOut<'discussion'>);
      setPlan({ view: '', reason: '', example: '' });
      start.current = Date.now();
      setLeft(60);
      setPhase('planning');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
  async function submit() {
    if (!data || phase !== 'planning') return;
    setPhase('checking');
    try {
      setCheck(await aiTask('planCheck', { prompt: data, ...planRef.current }));
      setPhase('checked');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase('planning');
    }
  }
  useEffect(() => {
    if (phase !== 'planning') return;
    const tm = setInterval(() => {
      const l = Math.max(0, 60 - Math.round((Date.now() - start.current) / 1000));
      setLeft(l);
      if (l === 0) submit();
    }, 300);
    return () => clearInterval(tm);
  }); // re-armed each render so submit sees the latest plan

  return (
    <div className="stack">
      <h1>1-minute essay planner</h1>
      <p className="muted">Good discussion posts are planned before typing: one view, one reason that adds something new, one specific example. Practise doing that in 60 seconds.</p>
      {phase === 'idle' && (
        <button className="btn primary big" onClick={load}>
          <Icon name="bolt" /> Get a prompt and start the minute
        </button>
      )}
      {error && <div className="banner error">{error}</div>}
      {data && phase !== 'idle' && (
        <div className="card stack">
          <div className="small muted">{data.course}</div>
          <div>
            <b>Professor:</b> {data.professor}
          </div>
          {data.posts.map((p) => (
            <div key={p.name} className="small">
              <b>{p.name}:</b> {p.text}
            </div>
          ))}
        </div>
      )}
      {data && (phase === 'planning' || phase === 'checking' || phase === 'checked') && (
        <div className="card stack">
          {phase === 'planning' && <span className={`chip ${left > 15 ? 'brand' : 'bad'}`} style={{ alignSelf: 'flex-start' }}>{left} s</span>}
          {(['view', 'reason', 'example'] as const).map((k) => (
            <label key={k} className="field">
              <span>{k === 'view' ? 'My view' : k === 'reason' ? 'Main reason (new, not what the students said)' : 'Specific example'}</span>
              <input type="text" spellCheck={false} value={plan[k]} disabled={phase !== 'planning'} onChange={(e) => setPlan({ ...plan, [k]: e.target.value })} />
            </label>
          ))}
          {phase === 'planning' && (
            <button className="btn primary" onClick={submit} style={{ alignSelf: 'flex-start' }}>
              Check my plan
            </button>
          )}
          {phase === 'checking' && <div className="muted">Checking the plan…</div>}
          {check && (
            <div className="stack fade-in">
              <span className={`chip ${check.score >= 4 ? 'good' : check.score >= 3 ? 'ok' : 'bad'}`} style={{ alignSelf: 'flex-start' }}>
                Plan potential {check.score} / 5
              </span>
              {check.good.map((g) => (
                <div key={g} className="small" style={{ color: 'var(--good)' }}>
                  ✓ {g}
                </div>
              ))}
              {check.fix.map((g) => (
                <div key={g} className="small">
                  → {g}
                </div>
              ))}
              <div className="soft small">
                <b>Stronger plan:</b> {check.better.view} / {check.better.reason} / {check.better.example}
              </div>
              <div className="row">
                <button className="btn primary" onClick={() => setPhase('writing')}>
                  Write the full post now (10 min)
                </button>
                <button className="btn" onClick={load}>
                  Another prompt
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {data && phase === 'writing' && (
        <div className="card">
          <div className="soft small" style={{ marginBottom: 10 }}>
            Your plan: {plan.view} / {plan.reason} / {plan.example}
          </div>
          <WritingTask kind="discussion" data={data} mode="practice" onSubmit={(o) => !o.revision && update((u) => recordOutcome(u, 'discussion', o))} />
        </div>
      )}
    </div>
  );
}

export const ToneTrainer = () => (
  <PracticeRunner
    section="writing"
    title="Email tone trainer"
    kinds={['tone']}
    fixedDifficulty="standard"
    intro={<p className="muted">Emails to professors and offices lose points when they sound too casual or demanding. Rewrite each sentence for the reader, then compare with a model.</p>}
  />
);

export const MONDAY = () => new Date().getDay() === 1;
