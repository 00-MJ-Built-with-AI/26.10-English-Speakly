import { useState } from 'react';
import type { FacultyEmail, PitchFeedback, QaFeedback, SopReview } from '../../../shared/kaust.ts';
import { countWords } from '../../engine/text.ts';
import { aiTask } from '../../lib/api.ts';
import { go, href } from '../../lib/router.ts';
import { useApp } from '../../lib/store.tsx';
import { emptyKaust, type KaustData } from '../../lib/types.ts';
import type { Assessment } from '../../speech/index.ts';
import { Icon } from '../components/Icon.tsx';
import { MicControl, PlayBlob, useListen, useSpeak } from '../components/speaking.tsx';

/** KAUST graduate programs, as suggestions (any text is fine). */
const PROGRAMS = [
  'Computer Science',
  'Electrical and Computer Engineering',
  'Applied Mathematics and Computational Science',
  'Statistics',
  'Mechanical Engineering',
  'Chemical Engineering',
  'Materials Science and Engineering',
  'Energy Resources and Petroleum Engineering',
  'Environmental Science and Engineering',
  'Earth Science and Engineering',
  'Marine Science',
  'Bioscience',
  'Bioengineering',
  'Plant Science',
  'Chemistry',
];

function useKaust(): [KaustData, (fn: (k: KaustData) => void) => void] {
  const { user, update } = useApp();
  const k = user.kaust ?? emptyKaust();
  return [k, (fn) => update((u) => fn((u.kaust ??= emptyKaust())))];
}

const profileOf = (k: KaustData) => ({ program: k.program, interests: k.interests, cv: k.cv });

/** Your applicant profile and the coach's tools. */
export function KaustHome() {
  const { user } = useApp();
  const [k, set] = useKaust();
  const [prof, setProf] = useState({ name: '', area: '', notes: '' });
  const ready = Boolean(k.program && (k.interests || k.cv));
  const tools = [
    { to: '/kaust/tracker', icon: 'check' as const, title: 'Application tracker', desc: `${k.deadlines.filter((d) => !d.done).length} open deadlines · ${k.recommenders.length} recommenders` },
    { to: '/kaust/sop', icon: 'book' as const, title: 'Statement of purpose review', desc: k.sops.length ? `${k.sops.length} version${k.sops.length === 1 ? '' : 's'}, last score ${k.sops[k.sops.length - 1].score ?? '–'}/5` : 'Feedback like an admissions committee' },
    { to: '/kaust/email', icon: 'chat' as const, title: 'Email a professor', desc: 'Write or improve an email about supervision' },
    { to: '/tutor?kind=research', icon: 'mic' as const, title: 'Faculty interview', desc: 'A professor asks about your research, live by voice' },
    { to: '/kaust/pitch', icon: 'target' as const, title: '2-minute research pitch + Q&A', desc: 'Present your research, answer audience questions' },
    { to: '/kaust/seminar', icon: 'users' as const, title: 'Seminar discussion', desc: 'Discuss with a professor and two classmates' },
  ];
  return (
    <div className="stack">
      <h1>KAUST application coach</h1>
      <p className="muted">For the application itself and for life in a research lab: your statement, emails to faculty, interviews, and academic speaking. Nothing here is sent to KAUST; it's practice and feedback.</p>
      <div className="card stack">
        <h3 style={{ margin: 0 }}>Your profile</h3>
        <label className="field">
          <span>Program</span>
          <input list="kaust-programs" value={k.program} onChange={(e) => set((x) => (x.program = e.target.value))} placeholder="e.g. Computer Science (MS/PhD)" />
          <datalist id="kaust-programs">
            {PROGRAMS.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </label>
        <label className="field">
          <span>Research interests</span>
          <textarea rows={3} value={k.interests} onChange={(e) => set((x) => (x.interests = e.target.value))} placeholder="What you want to work on, in a few sentences…" />
        </label>
        <label className="field">
          <span>CV (as text)</span>
          <textarea rows={6} value={k.cv} onChange={(e) => set((x) => (x.cv = e.target.value))} placeholder="Education, research projects, publications, skills…" />
        </label>
        {!k.cv && user.interviewPrep?.cv && (
          <button className="btn small" onClick={() => set((x) => (x.cv = user.interviewPrep!.cv))} style={{ alignSelf: 'flex-start' }}>
            Use the CV from interview prep
          </button>
        )}
        <div className="small faint">Saved to your account. The AI uses it for feedback and interviews.</div>
      </div>
      <div className="card stack">
        <h3 style={{ margin: 0 }}>Professors you're interested in</h3>
        {k.professors.map((p) => (
          <div key={p.id} className="spread small" style={{ borderBottom: '1px solid var(--line)', padding: '4px 0' }}>
            <span>
              <b>{p.name}</b> · {p.area}
              {p.notes && <div className="muted">{p.notes}</div>}
            </span>
            <span className="row">
              <a className="btn small" href={href(`/kaust/email?p=${p.id}`)}>
                Email
              </a>
              <a className="btn small" href={href(`/tutor?kind=research&area=${encodeURIComponent(p.area)}`)}>
                Interview
              </a>
              <button className="btn small ghost" aria-label="Remove" onClick={() => set((x) => (x.professors = x.professors.filter((q) => q.id !== p.id)))}>
                <Icon name="trash" size={14} />
              </button>
            </span>
          </div>
        ))}
        <div className="grid grid-3">
          <input value={prof.name} onChange={(e) => setProf({ ...prof, name: e.target.value })} placeholder="Name" />
          <input value={prof.area} onChange={(e) => setProf({ ...prof, area: e.target.value })} placeholder="Research area" />
          <input value={prof.notes} onChange={(e) => setProf({ ...prof, notes: e.target.value })} placeholder="Paper or note (optional)" />
        </div>
        <button
          className="btn"
          disabled={!prof.name.trim() || !prof.area.trim()}
          onClick={() => {
            set((x) => x.professors.push({ id: Date.now().toString(36), name: prof.name.trim(), area: prof.area.trim(), notes: prof.notes.trim() }));
            setProf({ name: '', area: '', notes: '' });
          }}
          style={{ alignSelf: 'flex-start' }}
        >
          Add professor
        </button>
        <div className="small faint">Check names and research areas on the KAUST faculty pages; the AI doesn't look them up.</div>
      </div>
      {!ready && <div className="banner">Add your program and your interests or CV first; the tools use them.</div>}
      <div className="grid grid-2">
        {tools.map((x) => (
          <a key={x.to} className="list-item" href={href(x.to)} style={{ marginTop: 0 }}>
            <span className="icon-tile">
              <Icon name={x.icon} />
            </span>
            <span className="grow">
              <b>{x.title}</b>
              <div className="small muted">{x.desc}</div>
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}

/** Statement of purpose: review against what committees look for, with versions over time. */
export function SopPage() {
  const [k, set] = useKaust();
  const [text, setText] = useState(k.sops[k.sops.length - 1]?.text ?? '');
  const [review, setReview] = useState<SopReview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run() {
    setBusy(true);
    setError(null);
    try {
      const r = await aiTask('sopReview', { text, profile: profileOf(k) });
      setReview(r);
      set((x) => (x.sops = [...x.sops, { at: Date.now(), text, score: r.score }].slice(-10)));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  const PARTS = [
    ['motivation', 'Motivation'],
    ['background', 'Background'],
    ['research', 'Research experience'],
    ['fit', 'Fit with KAUST'],
    ['goals', 'Goals'],
  ] as const;
  return (
    <div className="stack">
      <h1>Statement of purpose</h1>
      <div className="card stack">
        <textarea rows={14} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste your statement of purpose draft…" />
        <div className="row small">
          <span className="muted">{countWords(text)} words · check the length your program asks for</span>
        </div>
        <button className="btn primary" onClick={run} disabled={busy || countWords(text) < 80} style={{ alignSelf: 'flex-start' }}>
          {busy ? 'Reviewing…' : 'Review this version'}
        </button>
        {error && <div className="banner error">{error}</div>}
      </div>
      {review && (
        <div className="card stack fade-in">
          <div className="spread">
            <h3 style={{ margin: 0 }}>Review</h3>
            <span className={`chip ${review.score >= 4 ? 'good' : review.score >= 3 ? 'ok' : 'bad'}`} style={{ fontSize: '1rem' }}>
              {review.score} / 5
            </span>
          </div>
          <p style={{ margin: 0 }}>{review.summary}</p>
          {PARTS.map(([key, label]) => (
            <div key={key} className="small">
              <span style={{ color: review.parts[key].present ? 'var(--good)' : 'var(--bad)' }}>{review.parts[key].present ? '✓' : '✗'}</span> <b>{label}:</b> {review.parts[key].comment}
            </div>
          ))}
          {review.strengths.length > 0 && (
            <div className="small">
              <b>Strengths</b>
              <ul style={{ margin: 0 }}>
                {review.strengths.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="small">
            <b>Fix first</b>
            <ol style={{ margin: 0 }}>
              {review.issues.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          </div>
          {review.edits.map((e, n) => (
            <div key={n} className="soft small">
              <s className="muted">{e.original}</s> → <b>{e.better}</b>
              <div className="muted">{e.why}</div>
            </div>
          ))}
        </div>
      )}
      {k.sops.length > 1 && (
        <div className="card">
          <h3>Versions</h3>
          {k.sops
            .slice()
            .reverse()
            .map((v) => (
              <div key={v.at} className="spread small" style={{ padding: '4px 0', borderBottom: '1px solid var(--line)' }}>
                <span>
                  {new Date(v.at).toLocaleString()} · {countWords(v.text)} words
                </span>
                <span className="row">
                  <span className="chip">{v.score ?? '–'}/5</span>
                  <button className="btn small ghost" onClick={() => setText(v.text)}>
                    Load
                  </button>
                </span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

/** An email to a professor about supervision: written from your profile or improved from your draft. */
export function FacultyEmailPage({ professorId }: { professorId?: string }) {
  const [k] = useKaust();
  const saved = k.professors.find((p) => p.id === professorId);
  const [professor, setProfessor] = useState(saved?.name ?? '');
  const [area, setArea] = useState(saved?.area ?? '');
  const [work, setWork] = useState(saved?.notes ?? '');
  const [draft, setDraft] = useState('');
  const [out, setOut] = useState<FacultyEmail | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  async function run() {
    setBusy(true);
    setError(null);
    setCopied(false);
    try {
      setOut(await aiTask('facultyEmail', { professor, area, work: work || undefined, draft: draft.trim() || undefined, profile: profileOf(k) }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="stack">
      <h1>Email a professor</h1>
      <div className="card stack">
        {k.professors.length > 0 && (
          <div className="row small">
            {k.professors.map((p) => (
              <button key={p.id} className={`btn small ${professor === p.name ? 'primary' : 'ghost'}`} onClick={() => (setProfessor(p.name), setArea(p.area), setWork(p.notes))}>
                {p.name}
              </button>
            ))}
          </div>
        )}
        <div className="grid grid-2">
          <input value={professor} onChange={(e) => setProfessor(e.target.value)} placeholder="Professor's name" />
          <input value={area} onChange={(e) => setArea(e.target.value)} placeholder="Their research area" />
        </div>
        <input value={work} onChange={(e) => setWork(e.target.value)} placeholder="A paper or project of theirs you read (optional, recommended)" />
        <label className="field">
          <span>Your own draft (optional: leave empty to get one written from your profile)</span>
          <textarea rows={6} value={draft} onChange={(e) => setDraft(e.target.value)} />
        </label>
        <button className="btn primary" onClick={run} disabled={busy || !professor.trim() || !area.trim()} style={{ alignSelf: 'flex-start' }}>
          {busy ? 'Writing…' : draft.trim() ? 'Improve my draft' : 'Write the email'}
        </button>
        {error && <div className="banner error">{error}</div>}
      </div>
      {out && (
        <div className="card stack fade-in">
          <div>
            <b>Subject:</b> {out.subject}
          </div>
          <div className="soft" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
            {out.body}
          </div>
          <ul className="small" style={{ margin: 0 }}>
            {out.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
          <button
            className="btn"
            onClick={() => navigator.clipboard?.writeText(`Subject: ${out.subject}\n\n${out.body}`).then(() => setCopied(true))}
            style={{ alignSelf: 'flex-start' }}
          >
            {copied ? 'Copied' : 'Copy email'}
          </button>
          <div className="small faint">Fill in every [bracket] and check the facts before you send it from your own email.</div>
        </div>
      )}
    </div>
  );
}

/** A 2-minute research pitch by voice, feedback, then three audience questions. */
export function PitchPage() {
  const app = useApp();
  const [k, set] = useKaust();
  const mic = useListen();
  const { speak, speaking, stop } = useSpeak();
  const [a, setA] = useState<Assessment | null>(null);
  const [fb, setFb] = useState<PitchFeedback | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qi, setQi] = useState(-1);
  const [answers, setAnswers] = useState<{ a: Assessment; fb: QaFeedback | null }[]>([]);

  async function record() {
    setError(null);
    setFb(null);
    setQi(-1);
    setAnswers([]);
    const r = await mic.listen({ maxSeconds: 150, endSilenceMs: 6000, noSpeechMs: 15_000, record: true });
    if (!r) return;
    setA(r);
    setBusy(true);
    try {
      const f = await aiTask('pitch', { transcript: r.text, seconds: r.speechMs / 1000, profile: profileOf(k) });
      setFb(f);
      set((x) => (x.pitch = r.text));
      app.logAttempt({ at: Date.now(), kind: 'tutor', title: 'Research pitch', seconds: Math.round(r.speechMs / 1000), scores: {}, detail: { task: 'pitch', score: f.score } });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function ask(n: number) {
    if (!fb || !a) return;
    setQi(n);
    await speak(fb.questions[n]);
    const r = await mic.listen({ maxSeconds: 75, endSilenceMs: 5000, noSpeechMs: 12_000, record: true });
    if (!r) return;
    setAnswers((x) => [...x.slice(0, n), { a: r, fb: null }]);
    try {
      const q = await aiTask('qa', { pitch: a.text, question: fb.questions[n], transcript: r.text });
      setAnswers((x) => x.map((y, j) => (j === n ? { ...y, fb: q } : y)));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const secs = a ? Math.round(a.speechMs / 1000) : 0;
  return (
    <div className="stack">
      <h1>2-minute research pitch</h1>
      <p className="muted">
        Explain your research (or the project you want to do at KAUST) to a mixed academic audience: the problem, your approach, results so far, why it matters. Aim for about 2 minutes. Then answer three audience questions.
      </p>
      <div className="card stack">
        {mic.state === 'listening' && qi < 0 ? (
          <div className="stack">
            <span className="status-pill">
              <span className="dot live" /> Recording your pitch
            </span>
            <div className="partial">{mic.partial}</div>
            <button className="btn small" onClick={mic.stop} style={{ alignSelf: 'flex-start' }}>
              I'm done
            </button>
            {!mic.canListen && <MicControl {...mic} onStart={() => {}} onStop={mic.stop} onTyped={mic.submitTyped} canListen={false} />}
          </div>
        ) : (
          <button className="btn primary" onClick={record} disabled={busy || mic.state !== 'idle'} style={{ alignSelf: 'flex-start' }}>
            <Icon name="mic" size={16} /> {a ? 'Record again' : 'Start your pitch'}
          </button>
        )}
        {mic.error && <div className="banner error">{mic.error}</div>}
        {busy && <div className="muted">Listening back and writing feedback…</div>}
        {error && <div className="banner error">{error}</div>}
        {k.pitch && !a && <div className="small muted">Last pitch saved: “{k.pitch.slice(0, 120)}…”</div>}
      </div>
      {a && fb && (
        <div className="card stack fade-in">
          <div className="row">
            <span className={`chip ${fb.score >= 4 ? 'good' : fb.score >= 3 ? 'ok' : 'bad'}`}>{fb.score} / 5</span>
            {a.engine !== 'typed' && <span className={`chip ${secs >= 90 && secs <= 140 ? 'good' : 'ok'}`}>{secs} s</span>}
            {(['problem', 'approach', 'results', 'impact'] as const).map((p) => (
              <span key={p} className={`chip ${fb.parts[p] ? 'good' : 'bad'}`}>
                {fb.parts[p] ? '✓' : '✗'} {p}
              </span>
            ))}
          </div>
          <p style={{ margin: 0 }}>{fb.feedback}</p>
          <ul className="small" style={{ margin: 0 }}>
            {fb.tips.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <details>
            <summary className="small">A tighter version of your pitch</summary>
            <p className="small" style={{ lineHeight: 1.6 }}>
              {fb.improved}
            </p>
            <button className="btn small" onClick={() => (speaking ? stop() : speak(fb.improved))}>
              <Icon name="volume" size={14} /> {speaking ? 'Stop' : 'Listen'}
            </button>
          </details>
          <PlayBlob blob={a.audio} />
        </div>
      )}
      {a && fb && (
        <div className="card stack">
          <h3 style={{ margin: 0 }}>Audience questions</h3>
          {fb.questions.map((q, n) => (
            <div key={q} className="soft stack">
              <b>
                {n + 1}. {q}
              </b>
              {qi === n && mic.state === 'listening' && (
                <div className="stack">
                  <div className="partial">{mic.partial}</div>
                  <button className="btn small" onClick={mic.stop} style={{ alignSelf: 'flex-start' }}>
                    I'm done
                  </button>
                  {!mic.canListen && <MicControl {...mic} onStart={() => {}} onStop={mic.stop} onTyped={mic.submitTyped} canListen={false} />}
                </div>
              )}
              {answers[n] && (
                <div className="small stack">
                  <div className="muted">“{answers[n].a.text}”</div>
                  {answers[n].fb ? (
                    <>
                      <span className={`chip ${answers[n].fb!.score >= 4 ? 'good' : answers[n].fb!.score >= 3 ? 'ok' : 'bad'}`} style={{ alignSelf: 'flex-start' }}>
                        {answers[n].fb!.score} / 5
                      </span>
                      <div>{answers[n].fb!.feedback}</div>
                      <div className="soft">
                        <b>Stronger answer:</b> {answers[n].fb!.better}
                      </div>
                    </>
                  ) : (
                    <div className="muted">Scoring…</div>
                  )}
                </div>
              )}
              {mic.state === 'idle' && !speaking && (
                <button className="btn small" onClick={() => ask(n)} style={{ alignSelf: 'flex-start' }}>
                  <Icon name="mic" size={14} /> {answers[n] ? 'Answer again' : 'Hear it and answer'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const SEMINAR_TOPICS = [
  'Should research data and code always be openly shared?',
  'Is it better to specialize early or stay broad in graduate school?',
  'Should AI tools be allowed in writing research papers?',
  'How should limited water resources be shared in arid regions?',
  'Is renewable energy enough to reach net zero by 2060?',
  'Should universities measure researchers by citations?',
  'Are large international labs better for students than small groups?',
  'How much should industry fund university research?',
];

/** Pick a topic for a seminar discussion with an AI professor and two classmates. */
export function SeminarPage() {
  const [custom, setCustom] = useState('');
  return (
    <div className="stack">
      <h1>Seminar discussion</h1>
      <p className="muted">Graduate classes are often discussions. Practise taking the floor: a clear position, building on or challenging others, asking for clarification, summarizing.</p>
      <div className="card stack">
        {SEMINAR_TOPICS.map((t) => (
          <button key={t} className="list-item" style={{ marginTop: 0, textAlign: 'left' }} onClick={() => go(`/tutor?kind=seminar&topic=${encodeURIComponent(t)}`)}>
            <span className="grow">{t}</span>
            <Icon name="next" size={14} />
          </button>
        ))}
        <div className="row">
          <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Or a topic from your field…" style={{ flex: 1, minWidth: 200 }} />
          <button className="btn primary" disabled={!custom.trim()} onClick={() => go(`/tutor?kind=seminar&topic=${encodeURIComponent(custom.trim())}`)}>
            Start
          </button>
        </div>
      </div>
      <div className="card small">
        <b>Useful moves</b>
        <ul style={{ margin: '4px 0 0' }}>
          <li>“Building on what Lena said, …” / “I see it a bit differently: …”</li>
          <li>“Could you clarify what you mean by …?”</li>
          <li>“So if I understand correctly, you're saying …”</li>
          <li>“To sum up where we are: …”</li>
        </ul>
      </div>
    </div>
  );
}
