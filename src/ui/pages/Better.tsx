import { useEffect, useState } from 'react';
import type { BetterResult } from '../../../shared/tasks.ts';
import { workingLevel } from '../../engine/path.ts';
import { aiTask } from '../../lib/api.ts';
import { useApp } from '../../lib/store.tsx';
import type { Attempt } from '../../lib/types.ts';
import type { Assessment } from '../../speech/index.ts';
import { Icon } from '../components/Icon.tsx';
import { MicControl, ScoreChips, useElapsed, useListen, useSpeak, WordScores } from '../components/speaking.tsx';

export const ARABIC_LOCALES: [string, string][] = [
  ['ar-JO', 'Jordan'],
  ['ar-SA', 'Saudi Arabia'],
  ['ar-AE', 'UAE'],
  ['ar-EG', 'Egypt'],
  ['ar-LB', 'Lebanon'],
  ['ar-SY', 'Syria'],
  ['ar-PS', 'Palestine'],
  ['ar-IQ', 'Iraq'],
  ['ar-KW', 'Kuwait'],
  ['ar-QA', 'Qatar'],
  ['ar-BH', 'Bahrain'],
  ['ar-OM', 'Oman'],
  ['ar-MA', 'Morocco'],
  ['ar-DZ', 'Algeria'],
  ['ar-TN', 'Tunisia'],
  ['ar-LY', 'Libya'],
  ['ar-YE', 'Yemen'],
];

const STYLE_LABEL = { everyday: 'Everyday', professional: 'Professional', concise: 'Short and direct' } as const;

/** Say what you mean in Arabic (or rough English); get natural English to practise saying. */
export function Better() {
  const app = useApp();
  const level = workingLevel(app.user);
  const mic = useListen();
  const practiceMic = useListen();
  const { speak } = useSpeak();
  const elapsed = useElapsed();
  const [lang, setLang] = useState<'ar' | 'en'>('ar');
  const [situation, setSituation] = useState('');
  const [said, setSaid] = useState('');
  const [result, setResult] = useState<BetterResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<number | null>(null);
  const [scores, setScores] = useState<Record<number, Assessment>>({});
  const [added, setAdded] = useState<number | null>(null);
  const [recent, setRecent] = useState<Attempt[]>([]);
  const locale = app.user.settings.arabicLocale;

  useEffect(() => {
    app.repo.list<Attempt>('attempts', { limit: 200 }).then((a) => setRecent(a.filter((x) => x.kind === 'better').slice(0, 8)));
  }, [app.repo]);

  async function ask(text: string) {
    setBusy(true);
    setError(null);
    setScores({});
    setAdded(null);
    try {
      const r = await aiTask('better', { level, text, language: lang, situation: situation || undefined });
      setResult(r);
      speak(r.versions[0]?.text ?? '');
      await app.logAttempt({ at: Date.now(), kind: 'better', title: `Say it better: ${r.understood}`, seconds: elapsed(), scores: {}, detail: { text, lang, result: r } });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function listen() {
    setResult(null);
    const a = await mic.listen({ language: lang === 'ar' ? locale : 'en-US', assess: lang === 'en', maxSeconds: 45, endSilenceMs: 2200, noSpeechMs: 12_000 });
    if (!a || !a.text.trim()) return;
    setSaid(a.text);
    await ask(a.text);
  }

  return (
    <div className="stack">
      <h1>Say it better</h1>
      <p className="muted">Know what you want to say but not how? Say it in Arabic or rough English and get three natural ways to say it, then practise them out loud.</p>
      <div className="card stack">
        <div className="row">
          <button className={`btn small ${lang === 'ar' ? 'primary' : ''}`} onClick={() => setLang('ar')}>
            عربي Arabic
          </button>
          <button className={`btn small ${lang === 'en' ? 'primary' : ''}`} onClick={() => setLang('en')}>
            Rough English
          </button>
          {lang === 'ar' && (
            <select value={locale} onChange={(e) => app.update((u) => (u.settings.arabicLocale = e.target.value))} style={{ width: 'auto' }} aria-label="Arabic dialect">
              {ARABIC_LOCALES.map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
          )}
        </div>
        <input type="text" placeholder="Situation (optional), e.g. in a meeting with my manager" value={situation} onChange={(e) => setSituation(e.target.value)} />
        <MicControl {...mic} onStart={listen} onStop={mic.stop} onTyped={mic.submitTyped} disabled={busy} hint={lang === 'ar' ? 'Tap and say it in Arabic' : 'Tap and say it any way you can'} />
        {said && (
          <div className="soft" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
            {said}
          </div>
        )}
        {busy && <div className="muted">Finding natural English…</div>}
        {error && <div className="banner error">{error}</div>}
      </div>

      {result && (
        <div className="stack fade-in">
          <div className="small muted">You mean: {result.understood}</div>
          {result.versions.map((v, k) => (
            <div key={k} className="card stack">
              <div className="spread">
                <span className="chip brand">{STYLE_LABEL[v.style]}</span>
                <span className="small muted">{v.note}</span>
              </div>
              {scores[k] ? <WordScores a={scores[k]} /> : <div className="prompt-text" style={{ fontSize: '1.2rem' }}>{v.text}</div>}
              {scores[k] && <ScoreChips a={scores[k]} showFluency={false} />}
              <div className="row">
                <button className="btn small" onClick={() => speak(v.text)}>
                  <Icon name="volume" size={16} /> Listen
                </button>
                <button
                  className="btn small primary"
                  disabled={practiceMic.state !== 'idle'}
                  onClick={async () => {
                    setActive(k);
                    const a = await practiceMic.listen({ reference: v.text, maxSeconds: 25, endSilenceMs: 1500, noSpeechMs: 8000 });
                    setActive(null);
                    if (a) setScores((s) => ({ ...s, [k]: a }));
                  }}
                >
                  <Icon name="mic" size={16} /> Say it
                </button>
              </div>
              {active === k && <MicControl {...practiceMic} onStart={() => {}} onStop={practiceMic.stop} onTyped={practiceMic.submitTyped} />}
            </div>
          ))}
          {result.phrases.length > 0 && (
            <div className="card stack">
              <h3>Worth learning</h3>
              {result.phrases.map((p) => (
                <div key={p.phrase}>
                  <b>{p.phrase}</b> <span className="small muted">{p.meaning}</span>
                  <div className="small">“{p.example}”</div>
                </div>
              ))}
              <button className="btn small" style={{ alignSelf: 'flex-start' }} disabled={added != null} onClick={async () => setAdded(await app.addVocab(result.phrases, 'Say it better'))}>
                {added == null ? 'Add to my phrases' : `Added ${added}`}
              </button>
            </div>
          )}
        </div>
      )}

      {recent.length > 0 && !result && (
        <div className="card">
          <h3>Recent</h3>
          {recent.map((r) => {
            const d = r.detail as { result?: BetterResult } | undefined;
            const v = d?.result?.versions?.[0];
            return v ? (
              <div key={r.id ?? r.at} className="spread" style={{ padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
                <span className="small">{v.text}</span>
                <button className="btn small ghost" onClick={() => speak(v.text)} aria-label="Listen">
                  <Icon name="volume" size={16} />
                </button>
              </div>
            ) : null;
          })}
        </div>
      )}
    </div>
  );
}
