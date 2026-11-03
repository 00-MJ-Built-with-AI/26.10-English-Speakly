import { useState } from 'react';
import type { GenKind, QuestionType } from '../../../shared/toefl.ts';
import { weakTypes } from '../../engine/toeflPlan.ts';
import { SECTION_LABELS, type Section } from '../../engine/toeflScale.ts';
import { aiTask } from '../../lib/api.ts';
import { href } from '../../lib/router.ts';
import { useApp } from '../../lib/store.tsx';
import { Icon } from '../components/Icon.tsx';
import { useElapsed } from '../components/speaking.tsx';
import { KIND_LABEL, KIND_SECTION, recordOutcome, SECTION_KINDS } from './record.ts';
import { TaskView, type TaskOutcome } from './tasks.tsx';

const MCQ_TYPES: QuestionType[] = ['main-idea', 'detail', 'inference', 'vocabulary', 'purpose', 'organization', 'attitude'];

/** Default difficulty from the latest score for this section. */
function defaultDifficulty(band: number | undefined): 'easier' | 'standard' | 'harder' {
  if (band == null) return 'standard';
  return band >= 5 ? 'harder' : band <= 3.5 ? 'easier' : 'standard';
}

/** Practice one TOEFL section: pick a task type, get a fresh set, see answers and explanations. */
export function SectionPractice({ section, task }: { section: Exclude<Section, 'speaking'>; task?: string }) {
  const app = useApp();
  const t = app.user.toefl;
  const latest = t.scores[0];
  const kinds = SECTION_KINDS[section];
  const [kind, setKind] = useState<GenKind>(kinds.find((k) => k.key === task)?.kind ?? kinds[0].kind);
  const [difficulty, setDifficulty] = useState(defaultDifficulty(latest?.bands[section]));
  const weak = weakTypes(t.typeStats).filter((x) => (MCQ_TYPES as string[]).includes(x)) as QuestionType[];
  const [useFocus, setUseFocus] = useState(Boolean(weak[0]));
  const [item, setItem] = useState<{ kind: GenKind; data: unknown; n: number } | null>(null);
  const [outcome, setOutcome] = useState<TaskOutcome | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const elapsed = useElapsed();

  async function load(k = kind) {
    setLoading(true);
    setError(null);
    setOutcome(null);
    try {
      const focusType = useFocus && weak[0] && (k === 'daily' || k === 'academic' || k === 'conversation' || k === 'announcement' || k === 'talk') ? weak[0] : undefined;
      const data = await aiTask('toeflGen', { kind: k, difficulty, focusType });
      setItem({ kind: k, data, n: Date.now() });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function done(o: TaskOutcome) {
    if (!item) return;
    setOutcome(o);
    app.update((u) => recordOutcome(u, item.kind, o));
    await app.logAttempt({
      at: Date.now(),
      kind: 'toefl',
      title: `TOEFL ${SECTION_LABELS[KIND_SECTION[item.kind]]}: ${KIND_LABEL[item.kind]}`,
      seconds: elapsed(),
      scores: o.writing ? { grammar: o.writing.score * 20, vocabulary: o.writing.score * 20 } : {},
      detail: { section: KIND_SECTION[item.kind], task: item.kind, points: o.points, max: o.max },
    });
    if (o.writing?.corrections.length) {
      await app.addMistakes(
        o.writing.corrections.map((c) => ({ kind: c.kind, said: c.original, better: c.corrected, why: c.explanation })),
        `TOEFL ${KIND_LABEL[item.kind]}`,
      );
    }
  }

  return (
    <div className="stack">
      <a className="small" href={href('/toefl')}>
        ← TOEFL
      </a>
      <h1>{SECTION_LABELS[section]} practice</h1>
      <div className="card stack">
        <div className="row">
          {kinds.map((k) => (
            <button key={k.kind} className={`btn small ${kind === k.kind ? 'primary' : ''}`} onClick={() => (setKind(k.kind), setItem(null), setOutcome(null))}>
              {KIND_LABEL[k.kind]}
            </button>
          ))}
        </div>
        <div className="row small">
          <span className="muted">Difficulty:</span>
          {(['easier', 'standard', 'harder'] as const).map((d) => (
            <button key={d} className={`btn small ${difficulty === d ? 'primary' : 'ghost'}`} onClick={() => setDifficulty(d)}>
              {d === 'easier' ? 'Lower module' : d === 'harder' ? 'Upper module' : 'Standard'}
            </button>
          ))}
          {weak[0] && section !== 'writing' && (
            <label className="row">
              <input type="checkbox" checked={useFocus} onChange={(e) => setUseFocus(e.target.checked)} /> More “{weak[0]}” questions (your weakest)
            </label>
          )}
        </div>
        {section === 'writing' && (
          <div className="small muted">
            On the real test you type everything yourself: no dictation tools like Wispr Flow, no spellcheck, no pasting. <a href={href('/toefl/typing')}>Typing practice</a>
          </div>
        )}
        <button className="btn primary" onClick={() => load()} disabled={loading} style={{ alignSelf: 'flex-start' }}>
          <Icon name="refresh" size={16} /> {loading ? 'Writing a new set…' : item ? 'New set' : 'Start'}
        </button>
        {error && <div className="banner error">{error}</div>}
      </div>
      {item && (
        <div className="card" key={item.n}>
          <TaskView kind={item.kind} data={item.data} mode="practice" onSubmit={done} />
          {outcome && (
            <div className="row" style={{ marginTop: 14 }}>
              <span className={`chip ${outcome.points / outcome.max >= 0.8 ? 'good' : outcome.points / outcome.max >= 0.6 ? 'ok' : 'bad'}`}>
                {outcome.writing ? `${outcome.points.toFixed(1)} / 5` : `${outcome.points} / ${outcome.max} correct`}
              </span>
              <button className="btn primary small" onClick={() => load(item.kind)} disabled={loading}>
                Next set <Icon name="next" size={14} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
