import { useEffect, useRef, useState } from 'react';
import type { ChatInput, CorrectionStyle, ErrorItem, ReportResult, Scenario } from '../../../shared/tasks.ts';
import { soundForPhoneme } from '../../content/sounds.ts';
import { unitById } from '../../content/units.ts';
import { markPracticed, workingLevel } from '../../engine/path.ts';
import { fluencyScore } from '../../engine/scoring.ts';
import { analyzeHesitation, combineHesitation, type HesitationStats } from '../../engine/hesitation.ts';
import { HesitationChips } from '../components/Hesitation.tsx';
import { takeSentences } from '../../engine/text.ts';
import { aiChat, aiTask } from '../../lib/api.ts';
import { href } from '../../lib/router.ts';
import { useApp } from '../../lib/store.tsx';
import { micStream, VoiceRecorder } from '../../speech/mic.ts';
import { SpeakQueue, type Assessment } from '../../speech/index.ts';
import { Icon } from '../components/Icon.tsx';
import { ScoreRing, SKILL_COLORS } from '../components/ScoreRing.tsx';
import { useListen } from '../components/speaking.tsx';

interface Turn {
  role: 'tutor' | 'learner';
  text: string;
  errors?: ErrorItem[];
  a?: Assessment;
}

type Phase = 'setup' | 'thinking' | 'speaking' | 'listening' | 'waiting' | 'reporting' | 'report';

const TOPICS = [
  'My job and a typical workday',
  'A project I am working on',
  'Pros and cons of remote work',
  'Technology and the future of work',
  'Travel and places I have been',
  'Learning and education',
  'Health, sport and daily habits',
  'Current events and the news',
];

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export function Tutor({ query }: { query: URLSearchParams }) {
  const app = useApp();
  const { user, engine } = app;
  const unit = unitById(query.get('unit') ?? '');
  const kind = (query.get('kind') as ChatInput['kind']) || 'free';
  const scenario: Scenario | undefined = kind === 'roleplay' || kind === 'unit' ? unit?.roleplay : undefined;
  const level = unit?.level ?? workingLevel(user);

  const [phase, setPhase] = useState<Phase>('setup');
  const [topic, setTopic] = useState(query.get('topic') ?? '');
  const [custom, setCustom] = useState('');
  const [correction, setCorrection] = useState<CorrectionStyle>(user.settings.correction);
  const [handsFree, setHandsFree] = useState(user.settings.handsFree);
  const [showText, setShowText] = useState(user.settings.liveTranscript);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [live, setLive] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ReportResult | null>(null);
  const [silent, setSilent] = useState(false);
  const [hes, setHes] = useState<HesitationStats | undefined>();

  const mic = useListen();
  const turnsRef = useRef<Turn[]>([]);
  const queue = useRef<SpeakQueue | null>(null);
  const abort = useRef<AbortController | null>(null);
  const rec = useRef<VoiceRecorder | null>(null);
  const started = useRef(0);
  const ended = useRef(false);
  const bottom = useRef<HTMLDivElement | null>(null);

  const setT = (fn: (t: Turn[]) => Turn[]) => {
    turnsRef.current = fn(turnsRef.current);
    setTurns(turnsRef.current);
  };

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [turns, live, phase]);

  useEffect(
    () => () => {
      ended.current = true;
      abort.current?.abort();
      queue.current?.stop();
      rec.current?.stop();
    },
    [],
  );

  const chatInput = (): ChatInput => ({
      level,
      kind: kind === 'unit' ? 'roleplay' : kind,
      topic: topic || undefined,
      scenario,
      targets: unit ? { grammar: unit.grammar.name, functions: unit.functions, vocab: unit.vocab } : undefined,
      goals: ['work meetings', 'the new TOEFL iBT'],
      correction,
      history: turnsRef.current.map((t) => ({ role: t.role, text: t.text })),
    });

  async function listen() {
    if (ended.current) return;
    setPhase('listening');
    setSilent(false);
    rec.current?.resume();
    const a = await mic.listen({
      maxSeconds: 120,
      endSilenceMs: user.settings.turnPause * 1000,
      noSpeechMs: 25_000,
      manualStop: !handsFree,
    });
    rec.current?.pause();
    if (ended.current) return;
    if (!a || !a.text.trim()) {
      setSilent(true);
      setPhase('waiting');
      return;
    }
    learnerSaid(a);
  }

  async function tutorTurn() {
    if (ended.current) return;
    setPhase('thinking');
    setError(null);
    abort.current = new AbortController();
    const q = new SpeakQueue(engine, { voice: user.settings.voice, browserVoice: user.settings.browserVoice, rate: user.settings.speechRate });
    queue.current = q;
    let buffer = '';
    let full = '';
    try {
      full = await aiChat(
        chatInput(),
        (piece) => {
          setPhase('speaking');
          full += piece;
          setLive(full);
          buffer += piece;
          const { sentences, rest } = takeSentences(buffer);
          buffer = rest;
          sentences.forEach((s) => q.push(s));
        },
        abort.current.signal,
      );
      q.push(buffer);
    } catch (e) {
      if (!ended.current) {
        setError(e instanceof Error ? e.message : String(e));
        setPhase('waiting');
      }
      return;
    }
    setT((t) => [...t, { role: 'tutor', text: full.trim() }]);
    setLive('');
    setPhase('speaking');
    await q.drain();
    if (ended.current) return;
    if (/end of role-?play/i.test(full)) {
      finish();
      return;
    }
    if (handsFree) listen();
    else setPhase('waiting');
  }

  function learnerSaid(a: Assessment) {
    const index = turnsRef.current.length;
    const prevTutor = [...turnsRef.current].reverse().find((t) => t.role === 'tutor')?.text;
    setT((t) => [...t, { role: 'learner', text: a.text, a }]);
    aiTask('check', { level, utterance: a.text, context: prevTutor })
      .then((r) => setT((t) => t.map((x, k) => (k === index ? { ...x, errors: r.errors } : x))))
      .catch(() => {});
    tutorTurn();
  }

  async function start() {
    ended.current = false;
    started.current = Date.now();
    setPhase('thinking');
    try {
      rec.current = new VoiceRecorder();
      rec.current.start(await micStream());
      rec.current.pause();
    } catch {
      rec.current = null;
    }
    tutorTurn();
  }

  function interrupt() {
    abort.current?.abort();
    queue.current?.stop();
    if (live) {
      setT((t) => [...t, { role: 'tutor', text: live.trim() }]);
      setLive('');
    }
    listen();
  }

  async function finish() {
    if (ended.current) return;
    ended.current = true;
    abort.current?.abort();
    queue.current?.stop();
    mic.cancel();
    const all = turnsRef.current;
    const learner = all.filter((t) => t.role === 'learner');
    const seconds = Math.round((Date.now() - started.current) / 1000);
    const audio = await rec.current?.stop();
    if (!learner.length) {
      setPhase('setup');
      return;
    }
    setPhase('reporting');
    const real = learner.map((t) => t.a).filter((a): a is Assessment => Boolean(a && a.engine !== 'typed'));
    const weakWords = real.flatMap((a) => a.words.filter((w) => w.error !== 'Omission' && w.accuracy < 60).map((w) => w.word));
    const soundScores: Record<string, number[]> = {};
    for (const a of real)
      for (const w of a.words)
        for (const p of w.phonemes) {
          const s = soundForPhoneme(p.phoneme);
          if (s) (soundScores[s.id] ??= []).push(p.accuracy);
        }
    const weakSounds = Object.entries(soundScores)
      .filter(([, v]) => v.length >= 3 && avg(v) < 70)
      .map(([id]) => id);
    const title = scenario ? scenario.title : `Conversation: ${topic || 'free talk'}`;
    let r: ReportResult | null = null;
    try {
      r = await aiTask('report', {
        level,
        title,
        turns: all.map((t) => ({ role: t.role, text: t.text, errors: t.errors })),
        pronunciation: real.length ? { score: avg(real.map((a) => a.pron)), weakWords: [...new Set(weakWords)].slice(0, 15), weakSounds } : undefined,
        fluency: real.length
          ? { wordsPerMinute: Math.round(avg(real.map((a) => a.wordsPerMinute))), avgStartDelayMs: Math.round(avg(real.map((a) => a.startDelayMs))), longPauses: real.reduce((x, a) => x + a.longPauses, 0) }
          : undefined,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    const fl = real.length ? avg(real.map((a) => fluencyScore(a, true))) : undefined;
    const hesitation = combineHesitation(real.map(analyzeHesitation));
    setHes(hesitation);
    await app.logAttempt({
      at: Date.now(),
      kind: kind === 'free' ? 'tutor' : 'roleplay',
      title,
      unitId: unit?.id,
      seconds,
      hesitation,
      scores: {
        ...(r ? { grammar: r.grammar, vocabulary: r.vocabulary } : {}),
        ...(real.length ? { pronunciation: avg(real.map((a) => a.pron)) } : {}),
        ...(fl != null ? { fluency: fl } : {}),
      },
    });
    await app.repo.add('sessions', { at: Date.now(), title, kind, turns: all.map((t) => ({ role: t.role, text: t.text, errors: t.errors ?? [] })), report: r, seconds });
    const mistakes = [
      ...(r?.corrections ?? []).map((c) => ({ kind: c.kind, said: c.said, better: c.better, why: c.why })),
      ...[...new Set(weakWords)].slice(0, 5).map((w) => ({ kind: 'pronunciation' as const, said: w, better: w, why: 'Unclear in conversation' })),
    ];
    await app.addMistakes(mistakes, title);
    if (r?.betterPhrases.length) await app.addVocab(r.betterPhrases.map((p) => ({ phrase: p.try, meaning: `A more natural way to say “${p.instead}”`, example: p.try })), title);
    app.saveRecording(audio, { title, kind: kind === 'free' ? 'tutor' : 'roleplay', seconds, text: learner.map((t) => t.text).join(' / ') });
    if (unit && kind === 'unit') app.update((u) => markPracticed(u, unit.id, 'task'));
    if (weakSounds.length) app.update((u) => weakSounds.forEach((id) => (u.sounds[id] = Math.round(avg(soundScores[id])))));
    setReport(r);
    setPhase('report');
  }

  // Push-to-talk with the space bar.
  useEffect(() => {
    if (handsFree || phase === 'setup' || phase === 'report') return;
    const down = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat || (e.target as HTMLElement).tagName === 'INPUT') return;
      e.preventDefault();
      if (phase === 'waiting') listen();
    };
    const up = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      if (mic.state === 'listening') mic.stop();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  });

  // ---------- setup ----------
  if (phase === 'setup') {
    return (
      <div className="stack">
        {unit && (
          <a className="small" href={href(kind === 'unit' ? `/unit/${unit.id}` : '/roleplays')}>
            ← Back
          </a>
        )}
        <h1>{scenario ? scenario.title : 'Talk with your tutor'}</h1>
        {scenario ? (
          <div className="card stack">
            <p>
              <b>Setting:</b> {scenario.setting}
            </p>
            <p>
              <b>The tutor plays:</b> {scenario.aiRole}
            </p>
            <p>
              <b>You are:</b> {scenario.userRole}
            </p>
            <p>
              <b>Your goal:</b> {scenario.userGoal}
            </p>
            {unit && (
              <p className="small muted">
                Try to use: {unit.grammar.name}; {unit.functions.join(', ')}.
              </p>
            )}
          </div>
        ) : (
          <div className="card stack">
            <div className="section-title">Pick a topic</div>
            <div className="row">
              {TOPICS.map((t) => (
                <button key={t} className={`btn small ${topic === t ? 'primary' : ''}`} onClick={() => setTopic(t)}>
                  {t}
                </button>
              ))}
            </div>
            <input type="text" placeholder="Or type your own topic…" value={custom} onChange={(e) => (setCustom(e.target.value), setTopic(e.target.value))} />
          </div>
        )}
        <div className="card">
          <label className="field">
            <span>Corrections</span>
            <select value={correction} onChange={(e) => setCorrection(e.target.value as CorrectionStyle)}>
              <option value="light">Light: natural recasts now, full report after</option>
              <option value="every">Every turn: show a better version and repeat it</option>
              <option value="end">Only at the end</option>
            </select>
          </label>
          <div className="toggle">
            <span>
              <b>Hands-free</b>
              <div className="small muted">The tutor listens automatically and replies when you pause for {user.settings.turnPause} s. Off = push-to-talk (button or space bar).</div>
            </span>
            <input type="checkbox" checked={handsFree} onChange={(e) => setHandsFree(e.target.checked)} />
          </div>
          <div className="toggle">
            <span>
              <b>Live transcript</b>
              <div className="small muted">Show the conversation as text with your mistakes marked.</div>
            </span>
            <input type="checkbox" checked={showText} onChange={(e) => setShowText(e.target.checked)} />
          </div>
        </div>
        <button className="btn primary big" onClick={start}>
          <Icon name="mic" /> Start {scenario ? 'role-play' : 'conversation'}
        </button>
        <p className="small muted">Use headphones if you can, so the tutor's voice does not reach your microphone. Level: {level}.</p>
      </div>
    );
  }

  // ---------- report ----------
  if (phase === 'reporting') return <div className="center-screen muted">Writing your report…</div>;
  if (phase === 'report') {
    return (
      <div className="stack">
        <h1>Your report</h1>
        {error && <div className="banner error">{error}</div>}
        {report ? (
          <>
            <div className="card">
              <p style={{ fontSize: '1.05rem' }}>{report.summary}</p>
              <div className="grid grid-3" style={{ marginTop: 12 }}>
                <ScoreRing value={report.grammar} color={SKILL_COLORS.grammar} label="Grammar" size={84} />
                <ScoreRing value={report.vocabulary} color={SKILL_COLORS.vocabulary} label="Vocabulary" size={84} />
                <ScoreRing value={report.taskAchievement} color={SKILL_COLORS.fluency} label="Task" size={84} showLevel={false} />
              </div>
              <p className="small muted" style={{ marginTop: 10 }}>
                This conversation: around <b>{report.cefr}</b>.
              </p>
            </div>
            {hes && (
              <div className="card">
                <h3>Fluency and hesitation</h3>
                <HesitationChips h={hes} />
              </div>
            )}
            {report.strengths.length > 0 && (
              <div className="card">
                <h3>What went well</h3>
                <ul>
                  {report.strengths.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
            {report.corrections.length > 0 && (
              <div className="card">
                <h3>Corrections</h3>
                {report.corrections.map((c, k) => (
                  <div key={k} className="soft" style={{ marginTop: 8 }}>
                    <div>
                      <s className="muted">{c.said}</s>
                    </div>
                    <div>
                      <b style={{ color: 'var(--good)' }}>{c.better}</b>
                    </div>
                    <div className="small muted">{c.why}</div>
                  </div>
                ))}
                <p className="small muted" style={{ marginTop: 8 }}>
                  Added to your review list.
                </p>
              </div>
            )}
            {report.betterPhrases.length > 0 && (
              <div className="card">
                <h3>Sound more natural</h3>
                {report.betterPhrases.map((p, k) => (
                  <p key={k}>
                    Instead of <i>“{p.instead}”</i>, try <b>“{p.try}”</b>
                  </p>
                ))}
                <p className="small muted">Added to My phrases.</p>
              </div>
            )}
            {report.pronunciationTips.length > 0 && (
              <div className="card">
                <h3>Pronunciation</h3>
                <ul>
                  {report.pronunciationTips.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="card">
              <h3>Next time, focus on</h3>
              <ul>
                {report.nextFocus.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          </>
        ) : (
          <div className="card">The report could not be created, but your conversation was saved.</div>
        )}
        <div className="row">
          <button className="btn primary" onClick={() => location.reload()}>
            New conversation
          </button>
          {unit && (
            <a className="btn" href={href(`/unit/${unit.id}`)}>
              Back to {unit.title}
            </a>
          )}
        </div>
      </div>
    );
  }

  // ---------- conversation ----------
  const statusText =
    phase === 'thinking' ? 'Tutor is thinking…' : phase === 'speaking' ? 'Tutor is speaking' : phase === 'listening' ? (handsFree ? 'Listening… pause to finish' : 'Listening… release / tap to send') : 'Your turn';
  return (
    <div className="stack">
      <div className="spread">
        <div>
          <h2 style={{ margin: 0 }}>{scenario ? scenario.title : topic || 'Free conversation'}</h2>
          <span className="small muted">{level}</span>
        </div>
        <div className="row">
          <label className="row small">
            <input type="checkbox" checked={showText} onChange={(e) => setShowText(e.target.checked)} /> Transcript
          </label>
          <button className="btn" onClick={finish}>
            End & get report
          </button>
        </div>
      </div>

      {showText ? (
        <div className="chat card" style={{ minHeight: 260 }}>
          {turns.map((t, k) => (
            <div key={k} className={`bubble ${t.role}`}>
              {t.text}
              {t.role === 'learner' && t.errors && t.errors.length > 0 && (
                <div className="fix">
                  {t.errors.map((e, j) => (
                    <div key={j}>
                      <s>{e.original}</s> → <b>{e.corrected}</b>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {live && <div className="bubble tutor">{live}</div>}
          {phase === 'listening' && <div className="bubble learner pending">{mic.partial || '…'}</div>}
          <div ref={bottom} />
        </div>
      ) : (
        <div className="card" style={{ minHeight: 200, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
          <div>
            <Icon name="wave" size={64} className={phase === 'speaking' ? '' : 'faint'} />
            <p className="muted">Transcript hidden. Just listen and talk.</p>
          </div>
        </div>
      )}

      <div className="card stack" style={{ textAlign: 'center', position: 'sticky', bottom: 76 }}>
        <div className="row" style={{ justifyContent: 'center' }}>
          <span className="status-pill">
            <span className={`dot ${phase === 'listening' ? 'live' : phase === 'speaking' ? 'speak' : phase === 'thinking' ? 'think' : ''}`} />
            {statusText}
          </span>
        </div>
        {silent && <div className="small muted">I didn't hear anything. Tap the microphone when you're ready.</div>}
        {error && <div className="banner error">{error}</div>}
        <div className="row" style={{ justifyContent: 'center' }}>
          {phase === 'speaking' || phase === 'thinking' ? (
            <button className="btn" onClick={interrupt}>
              <Icon name="mic" size={18} /> Interrupt
            </button>
          ) : phase === 'listening' ? (
            <button className="mic live" onClick={mic.stop} aria-label="Send">
              <Icon name="stop" size={30} />
            </button>
          ) : (
            <button className="mic" onClick={listen} aria-label="Speak">
              <Icon name="mic" size={30} />
            </button>
          )}
        </div>
        {phase === 'listening' && (!engine.canListen || mic.micFailed) && (
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault();
              const v = (e.currentTarget.elements.namedItem('t') as HTMLInputElement).value.trim();
              if (v) mic.submitTyped(v);
            }}
          >
            <input name="t" type="text" placeholder="Type what you would say" autoFocus />
            <button className="btn small">Send</button>
          </form>
        )}
        {!handsFree && phase === 'waiting' && (
          <div className="small faint">
            Tap the microphone or hold <span className="kbd">Space</span>
          </div>
        )}
      </div>
    </div>
  );
}
