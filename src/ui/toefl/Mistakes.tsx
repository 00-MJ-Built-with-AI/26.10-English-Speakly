import { weakTypes } from '../../engine/toeflPlan.ts';
import { SECTION_LABELS, type Section } from '../../engine/toeflScale.ts';
import { href } from '../../lib/router.ts';
import { useApp } from '../../lib/store.tsx';
import { TypeTrends } from './Extras.tsx';

/** What each tracked question type is, and where to practise it. */
const TYPE_INFO: Record<string, { label: string; tip: string; to: string }> = {
  'main-idea': { label: 'Main idea', tip: 'Read the first and last sentence of each paragraph before the details. The right answer covers the whole text, not one part.', to: '/toefl/reading/practice?task=academic' },
  detail: { label: 'Detail', tip: 'Find the exact sentence in the text. Wrong options often reuse words from the text but change the meaning.', to: '/toefl/reading/practice?task=daily' },
  inference: { label: 'Inference', tip: 'The answer is not stated but must be true from the text. Reject options that need outside knowledge or go too far.', to: '/toefl/reading/practice?task=academic' },
  vocabulary: { label: 'Vocabulary in context', tip: 'Replace the word with each option and reread the sentence. Pick the meaning that fits this context, not the most common one.', to: '/toefl/reading/practice?task=academic' },
  purpose: { label: 'Purpose', tip: 'Ask why the writer or speaker included this: to give an example, contrast, explain a cause, or make a request.', to: '/toefl/listening/practice?task=talk' },
  organization: { label: 'Organization', tip: 'Notice signal words (however, as a result, for example) and how the parts connect.', to: '/toefl/listening/practice?task=talk' },
  attitude: { label: 'Speaker attitude', tip: 'Listen to tone and hedges like "I suppose" or "actually". Attitude is often in how something is said.', to: '/toefl/listening/practice?task=conversation' },
  response: { label: 'Choose a response', tip: 'Pick the reply a person would really say. Watch for options that repeat words from the prompt but do not answer it.', to: '/toefl/listening/practice?task=response' },
  'complete-words': { label: 'Complete the Words', tip: 'Use grammar first (plural, past tense, part of speech), then meaning. Spelling must be exact, so build accuracy with typing practice.', to: '/toefl/reading/practice?task=complete' },
  'build-sentence': { label: 'Build a Sentence', tip: 'Find the subject and verb first, then attach phrases. Questions and indirect questions have different word order.', to: '/toefl/writing/practice?task=build' },
  email: { label: 'Write an Email', tip: 'Cover all three points, use a polite opening and closing, and keep the tone right for the reader.', to: '/toefl/writing/practice?task=email' },
  paraphrase: { label: 'Paraphrase', tip: 'Check who does what and why, and the small words: some/all, may/will, not.', to: '/toefl/reading/paraphrase' },
  spelling: { label: 'Word endings', tip: 'Learn the patterns: y to ies, doubling before -ed, -ate to -ation.', to: '/toefl/reading/spelling' },
  dictation: { label: 'Dictation', tip: 'Listen for small words and endings; replay at 0.8x first, then 1x.', to: '/toefl/listening/dictation' },
  implied: { label: 'Implied meaning', tip: 'A reason instead of yes/no usually means no; listen to tone.', to: '/toefl/listening/implied' },
  'note-taking': { label: 'Note-taking', tip: 'One line per signposted point, short forms, examples in 2-3 words.', to: '/toefl/listening/notes' },
  tone: { label: 'Email tone', tip: 'Polite openings, "could you please", no slang or demands; match the reader.', to: '/toefl/writing/tone' },
  phrases: { label: 'Phrase choice', tip: 'Match the phrase to the job: request, explanation, agreement, example.', to: '/toefl/writing/phrases' },
  discussion: { label: 'Academic Discussion', tip: 'State your view in the first sentence, add a reason and an example, and refer to one classmate’s idea.', to: '/toefl/writing/practice?task=discussion' },
};

/** Accuracy by question type, weakest first, with a tip and a link to practise each. */
export function Mistakes() {
  const { user } = useApp();
  const t = user.toefl;
  const weak = new Set(weakTypes(t.typeStats));
  const rows = Object.entries(t.typeStats)
    .map(([type, s]) => ({ type, ...s, pct: s.total ? s.right / s.total : 0 }))
    .sort((a, b) => a.pct - b.pct);
  const sections = (Object.entries(t.sectionStats) as [Section, { points: number; max: number }][]).filter(([, s]) => s.max > 0);

  return (
    <div className="stack">
      <a className="small" href={href('/toefl')}>
        ← TOEFL
      </a>
      <h1>Mistake log</h1>
      <TypeTrends />
      <a className="list-item" href={href('/toefl/review')} style={{ marginTop: 0 }}>
        <span className="grow">
          <b>Wrong-answer review</b>
          <div className="small muted">{t.review.filter((r) => r.due <= Date.now()).length} due today · {t.review.length} in review</div>
        </span>
      </a>
      <p className="muted">Every practice set and mock records which question types you got right. Types under 70% (with at least 4 tries) are marked as weak; practice sets lean toward your weakest type.</p>
      {rows.length === 0 ? (
        <div className="card muted">No answers yet. Do a few Reading, Listening or Writing sets and your log fills in.</div>
      ) : (
        <>
          {sections.length > 0 && (
            <div className="card">
              <h3>By section</h3>
              {sections.map(([s, v]) => (
                <div key={s} style={{ marginBottom: 8 }}>
                  <div className="spread small">
                    <b>{SECTION_LABELS[s]}</b>
                    <span>{Math.round((v.points / v.max) * 100)}%</span>
                  </div>
                  <div className="bar">
                    <span style={{ width: `${(v.points / v.max) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
          {rows.map((r) => {
            const info = TYPE_INFO[r.type] ?? { label: r.type, tip: '', to: '/toefl' };
            const isWeak = weak.has(r.type);
            return (
              <div key={r.type} className="card stack" style={isWeak ? { borderColor: 'var(--bad)' } : undefined}>
                <div className="spread">
                  <b>
                    {info.label} {isWeak && <span className="chip bad">weak</span>}
                  </b>
                  <span className={`chip ${r.pct >= 0.8 ? 'good' : r.pct >= 0.7 ? 'ok' : 'bad'}`}>
                    {r.right}/{r.total} · {Math.round(r.pct * 100)}%
                  </span>
                </div>
                {info.tip && <div className="small muted">{info.tip}</div>}
                <a className="btn small" href={href(info.to)} style={{ alignSelf: 'flex-start' }}>
                  Practise this
                </a>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
