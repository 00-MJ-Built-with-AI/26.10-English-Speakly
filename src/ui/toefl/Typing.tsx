import { useMemo, useRef, useState } from 'react';
import { href } from '../../lib/router.ts';
import { useApp } from '../../lib/store.tsx';
import { Icon } from '../components/Icon.tsx';

/** Short academic and email-style passages to copy (written for this app). */
const PASSAGES = [
  'I am writing to ask whether it would be possible to submit my lab report two days late. I was ill last week and could not finish the experiment on time.',
  'In my opinion, universities should require students to take at least one course outside their major, because it helps them think in new ways and prepares them for a changing job market.',
  'Although online classes offer flexibility, many students find it harder to stay motivated without regular contact with their classmates and instructors.',
  'One reason renewable energy is becoming more popular is that the cost of solar panels has fallen sharply over the past decade, making them affordable for many households.',
  'I partly agree with Sara. Digital textbooks are convenient, but I think students still need paper for difficult subjects, where taking notes by hand improves understanding.',
  'Thank you for organizing the workshop last Thursday. I found the session on research methods especially useful, and I would like to ask whether the slides will be shared.',
  'Scientists have found that sleep plays an important role in memory. During deep sleep, the brain appears to replay and strengthen what was learned during the day.',
  'Could you please let me know which documents I need to bring to the registration office? I would also like to confirm whether the office is open during the lunch break.',
];

/** Typing speed (words per minute = characters / 5 per minute) and accuracy, without spellcheck. */
export function Typing() {
  const { user, update } = useApp();
  const [i, setI] = useState(() => Math.floor(Math.random() * PASSAGES.length));
  const target = PASSAGES[i];
  const [text, setText] = useState('');
  const [result, setResult] = useState<{ wpm: number; accuracy: number } | null>(null);
  const start = useRef<number | null>(null);
  const recent = user.toefl.typing;
  const avg = recent.length ? Math.round(recent.reduce((a, b) => a + b, 0) / recent.length) : null;

  const marks = useMemo(() => [...target].map((c, k) => (k >= text.length ? 'todo' : text[k] === c ? 'ok' : 'bad')), [target, text]);

  function onChange(v: string) {
    if (result) return;
    if (start.current == null && v.length) start.current = Date.now();
    setText(v);
    if (v.length >= target.length) {
      const minutes = Math.max(0.05, (Date.now() - (start.current ?? Date.now())) / 60000);
      const correct = [...target].filter((c, k) => v[k] === c).length;
      const r = { wpm: Math.round(target.length / 5 / minutes), accuracy: Math.round((correct / target.length) * 100) };
      setResult(r);
      update((u) => (u.toefl.typing = [...u.toefl.typing, r.wpm].slice(-20)));
    }
  }

  function next() {
    setI((x) => (x + 1) % PASSAGES.length);
    setText('');
    setResult(null);
    start.current = null;
  }

  return (
    <div className="stack">
      <a className="small" href={href('/toefl')}>
        ← TOEFL
      </a>
      <h1>Typing practice</h1>
      <p className="muted">
        The Writing section is typed by hand: no dictation, no spellcheck, no pasting. About 35 words per minute with few mistakes leaves you enough time to think during the 23 minutes.
        {avg != null && ` Your recent average: ${avg} wpm.`}
      </p>
      <div className="card stack">
        <div style={{ fontSize: '1.15rem', lineHeight: 1.8, fontFamily: 'ui-monospace, monospace' }}>
          {[...target].map((c, k) => (
            <span key={k} style={{ color: marks[k] === 'ok' ? 'var(--good)' : marks[k] === 'bad' ? 'var(--bad)' : 'var(--muted)', background: marks[k] === 'bad' ? 'var(--bad-soft)' : undefined }}>
              {c}
            </span>
          ))}
        </div>
        <textarea
          rows={4}
          value={text}
          onChange={(e) => onChange(e.target.value)}
          onPaste={(e) => e.preventDefault()}
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          placeholder="Start typing the text above…"
          disabled={Boolean(result)}
          style={{ fontFamily: 'ui-monospace, monospace' }}
        />
        {result && (
          <div className="row fade-in">
            <span className={`chip ${result.wpm >= 35 ? 'good' : result.wpm >= 25 ? 'ok' : 'bad'}`}>{result.wpm} wpm</span>
            <span className={`chip ${result.accuracy >= 97 ? 'good' : result.accuracy >= 90 ? 'ok' : 'bad'}`}>{result.accuracy}% accurate</span>
            <button className="btn primary small" onClick={next}>
              Next text <Icon name="next" size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
