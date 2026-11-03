import { useState } from 'react';
import { daysUntil } from '../../engine/exam.ts';
import { analyzeGap, buildPlan, gapSummary, planOffset } from '../../engine/toeflPlan.ts';
import { comparableTotal, KAUST, overallBand, SECTION_LABELS, SECTIONS, type Section, type ToeflScore } from '../../engine/toeflScale.ts';
import { aiTask } from '../../lib/api.ts';
import { href } from '../../lib/router.ts';
import { useApp } from '../../lib/store.tsx';
import { Icon } from '../components/Icon.tsx';

const BANDS = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6];

/** Shrinks a photo to at most 1600 px and returns base64 JPEG (keeps uploads small). */
async function photoToJpeg(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('Could not open the image.'));
      i.src = url;
    });
    const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.85).split(',')[1];
  } finally {
    URL.revokeObjectURL(url);
  }
}

interface Draft {
  date: string;
  bands: Partial<Record<Section, number>>;
  scores30: Partial<Record<Section, number>>;
  total?: number;
}

const emptyDraft = (): Draft => ({ date: new Date().toISOString().slice(0, 10), bands: {}, scores30: {} });

/** Enter an official result (from a photo or by hand), see the gap to KAUST and a plan. */
export function Scores() {
  const app = useApp();
  const t = app.user.toefl;
  const [draft, setDraft] = useState<Draft | null>(null);
  const [reading, setReading] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function fromPhoto(file: File) {
    setReading(true);
    setError(null);
    setNote(null);
    try {
      const image = await photoToJpeg(file);
      const r = await aiTask('scoreReport', { image, mediaType: 'image/jpeg' });
      if (!r.found) setNote(r.notes || 'This does not look like a TOEFL score report. You can type the numbers instead.');
      else setNote(r.notes || null);
      const d = emptyDraft();
      if (r.testDate) d.date = r.testDate;
      for (const s of SECTIONS) {
        const b = r[s];
        if (b != null) d.bands[s] = b;
        const v = r[`${s}30` as const];
        if (v != null) d.scores30[s] = v;
      }
      if (r.total0to120 != null) d.total = r.total0to120;
      setDraft(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setDraft(emptyDraft());
    } finally {
      setReading(false);
    }
  }

  function save() {
    if (!draft || SECTIONS.some((s) => draft.bands[s] == null)) return;
    const bands = draft.bands as Record<Section, number>;
    const score: ToeflScore = {
      id: Date.now().toString(36),
      at: Date.now(),
      date: draft.date,
      source: 'official',
      overall: overallBand(bands),
      bands,
      scores30: Object.keys(draft.scores30).length ? draft.scores30 : undefined,
      total: draft.total,
    };
    app.update((u) => {
      u.toefl.scores = [score, ...u.toefl.scores].sort((a, b) => b.date.localeCompare(a.date) || b.at - a.at);
      // toeflBand is the speaking estimate; an official result resets it.
      u.toeflBand = bands.speaking;
    });
    setDraft(null);
    setNote(null);
  }

  return (
    <div className="stack">
      <a className="small" href={href('/toefl')}>
        ← TOEFL
      </a>
      <h1>My TOEFL scores</h1>

      <TargetCard />

      <div className="card stack">
        <h3 style={{ margin: 0 }}>Add an official result</h3>
        <p className="small muted" style={{ margin: 0 }}>
          Take a photo or screenshot of your score report. The AI reads the numbers (the image is sent to the AI service only for this), then you check them before saving.
        </p>
        <div className="row">
          <label className="btn primary">
            <Icon name="target" size={18} /> {reading ? 'Reading the report…' : 'Upload score report photo'}
            <input type="file" accept="image/*" hidden disabled={reading} onChange={(e) => e.target.files?.[0] && fromPhoto(e.target.files[0])} />
          </label>
          <button className="btn" onClick={() => setDraft(emptyDraft())}>
            Type the numbers
          </button>
        </div>
        {error && <div className="banner error">{error}</div>}
        {note && <div className="banner">{note}</div>}
        {draft && <ScoreForm draft={draft} setDraft={setDraft} onSave={save} onCancel={() => setDraft(null)} />}
      </div>

      {t.scores[0] && <GapCard score={t.scores[0]} showPlan />}

      {t.scores.length > 0 && (
        <div className="card">
          <h3>History</h3>
          {t.scores.map((s) => (
            <div key={s.id} className="spread small" style={{ padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
              <span>
                <b>{s.date}</b> · {s.source === 'official' ? 'official' : 'mock estimate'}
                <div className="muted">
                  {SECTIONS.map((k) => `${SECTION_LABELS[k][0]} ${s.bands[k]}`).join(' · ')}
                </div>
              </span>
              <span className="row">
                <span className="chip brand">
                  {s.overall.toFixed(1)} · {comparableTotal(s)}/120
                </span>
                <button className="btn ghost small" aria-label="Delete" onClick={() => confirm('Delete this result?') && app.update((u) => (u.toefl.scores = u.toefl.scores.filter((x) => x.id !== s.id)))}>
                  <Icon name="trash" size={14} />
                </button>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ScoreForm({ draft, setDraft, onSave, onCancel }: { draft: Draft; setDraft: (d: Draft) => void; onSave: () => void; onCancel: () => void }) {
  const complete = SECTIONS.every((s) => draft.bands[s] != null);
  const overall = complete ? overallBand(draft.bands as Record<Section, number>) : null;
  const num = (v: string) => (v === '' ? undefined : Number(v));
  return (
    <div className="soft stack fade-in">
      <label className="field">
        <span>Test date</span>
        <input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
      </label>
      <div className="grid grid-4">
        {SECTIONS.map((s) => (
          <div key={s} className="stack">
            <label className="field">
              <span>{SECTION_LABELS[s]} band</span>
              <select value={draft.bands[s] ?? ''} onChange={(e) => setDraft({ ...draft, bands: { ...draft.bands, [s]: num(e.target.value) } })}>
                <option value="">–</option>
                {BANDS.map((b) => (
                  <option key={b} value={b}>
                    {b.toFixed(1)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field small">
              <span>0-30 (if shown)</span>
              <input type="number" min={0} max={30} value={draft.scores30[s] ?? ''} onChange={(e) => setDraft({ ...draft, scores30: { ...draft.scores30, [s]: num(e.target.value) } })} />
            </label>
          </div>
        ))}
      </div>
      <label className="field">
        <span>Comparable 0-120 total (if shown)</span>
        <input type="number" min={0} max={120} value={draft.total ?? ''} onChange={(e) => setDraft({ ...draft, total: num(e.target.value) })} />
      </label>
      {overall != null && <div className="small">Overall band: <b>{overall.toFixed(1)}</b></div>}
      <div className="row">
        <button className="btn primary" disabled={!complete} onClick={onSave}>
          Save result
        </button>
        <button className="btn ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

/** The goal: KAUST's minimum and our target with a margin, both editable. */
export function TargetCard() {
  const { user, update } = useApp();
  const t = user.toefl;
  return (
    <div className="card stack">
      <div className="spread">
        <h3 style={{ margin: 0 }}>Goal: KAUST</h3>
        <a className="small" href={KAUST.source} target="_blank" rel="noreferrer">
          KAUST admissions FAQ ↗
        </a>
      </div>
      <div className="grid grid-2">
        <label className="field">
          <span>Target band (1-6)</span>
          <select value={t.target} onChange={(e) => update((u) => (u.toefl.target = Number(e.target.value)))}>
            {BANDS.map((b) => (
              <option key={b} value={b}>
                {b.toFixed(1)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Minimum band (1-6)</span>
          <select value={t.minimum} onChange={(e) => update((u) => (u.toefl.minimum = Number(e.target.value)))}>
            {BANDS.map((b) => (
              <option key={b} value={b}>
                {b.toFixed(1)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="small muted" style={{ margin: 0 }}>
        KAUST's pages still give the old 0-120 scale (79 on the FAQ, 81 on "Applying to KAUST"); ETS places both in band 4.0. Below TOEFL 90 (band 4.5),
        admitted students take a mandatory English course. Your goal of {t.target.toFixed(1)} (minimum {t.minimum.toFixed(1)}) is well above both, for every section.
      </p>
    </div>
  );
}

/** Where a score stands against the target, section by section, with an optional day-by-day plan. */
export function GapCard({ score, showPlan = false }: { score: ToeflScore; showPlan?: boolean }) {
  const { user } = useApp();
  const t = user.toefl;
  const g = analyzeGap(score, t.target, t.minimum);
  const daysLeft = user.settings.examDate ? daysUntil(user.settings.examDate) : null;
  const plan = showPlan ? buildPlan(g, daysLeft != null && daysLeft > 0 ? daysLeft : null, 50, planOffset()) : [];
  return (
    <div className="card stack">
      <div className="spread">
        <h3 style={{ margin: 0 }}>
          {score.source === 'official' ? 'Your score' : 'Mock estimate'} ({score.date})
        </h3>
        <span className={`chip ${g.meetsTarget ? 'good' : g.meetsMinimum ? 'ok' : 'bad'}`} style={{ fontSize: '1rem' }}>
          {g.total} / 120 · band {score.overall.toFixed(1)}
        </span>
      </div>
      <p style={{ margin: 0 }}>{gapSummary(g)}</p>
      {g.sections.map((s) => (
        <div key={s.section}>
          <div className="spread small">
            <span>
              <b>{SECTION_LABELS[s.section]}</b> band {score.bands[s.section]}
            </span>
            <span className={s.gap ? 'muted' : ''} style={!s.gap ? { color: 'var(--good)' } : undefined}>
              {s.gap ? `+${s.gap.toFixed(1)} to ${s.target.toFixed(1)}` : '✓ at target'}
            </span>
          </div>
          <div className="bar">
            <span style={{ width: `${(s.now / 6) * 100}%`, background: s.gap ? undefined : 'var(--good)' }} />
          </div>
        </div>
      ))}
      {showPlan && !g.meetsTarget && (
        <details open>
          <summary>
            Plan{daysLeft != null && daysLeft > 0 ? ` for the ${Math.min(14, daysLeft)} days before your next exam` : ' for the next two weeks'} (about 50 min a day)
          </summary>
          {!user.settings.examDate && (
            <div className="small muted" style={{ margin: '6px 0' }}>
              Set your next exam date on the <a href={href('/toefl')}>TOEFL page</a> to fit the plan to it.
            </div>
          )}
          <div className="grid grid-2" style={{ marginTop: 8 }}>
            {plan.map((d) => (
              <div key={d.day} className="soft small">
                <b>Day {d.day}</b>
                {d.items.map((i) => (
                  <div key={i.label}>
                    <a href={href(i.to)}>{i.label}</a> <span className="faint">{i.minutes} min</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
