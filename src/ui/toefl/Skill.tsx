import { lessonsFor } from '../../content/toeflLessons.ts';
import { bandHistory, skillBand, type BandSource } from '../../engine/toeflSkill.ts';
import { SECTION_LABELS, type Section } from '../../engine/toeflScale.ts';
import { href } from '../../lib/router.ts';
import { useApp } from '../../lib/store.tsx';
import { Icon } from '../components/Icon.tsx';
import { SKILLS } from './record.ts';
import { SoundsFromToefl } from './SpeakingTools.tsx';

type IconName = Parameters<typeof Icon>[0]['name'];

/** Overview + one tab per skill, shown at the top of every TOEFL page. */
export function ToeflTabs({ active }: { active: string | undefined }) {
  const tabs = [{ id: '', label: 'Overview' }, ...SKILLS.map((s) => ({ id: s, label: SECTION_LABELS[s] }))];
  const current = SKILLS.includes(active as Section) ? active : '';
  return (
    <nav className="row" style={{ gap: 6, marginBottom: 12, overflowX: 'auto', flexWrap: 'nowrap' }} aria-label="TOEFL sections">
      {tabs.map((t) => (
        <a key={t.id} className={`btn small ${current === t.id ? 'primary' : 'ghost'}`} href={href(t.id ? `/toefl/${t.id}` : '/toefl')} aria-current={current === t.id ? 'page' : undefined}>
          {t.label}
        </a>
      ))}
    </nav>
  );
}

const SOURCE_LABEL: Record<BandSource, string> = { official: 'official score', mock: 'full mock', test: 'section test', practice: 'practice estimate' };

/** Band over time with the target line. */
function BandChart({ points, target }: { points: { at: number; band: number }[]; target: number }) {
  if (points.length < 2) return null;
  const w = 320;
  const h = 90;
  const x0 = points[0].at;
  const span = Math.max(1, points[points.length - 1].at - x0);
  const x = (at: number) => 8 + ((at - x0) / span) * (w - 16);
  const y = (b: number) => h - 8 - ((b - 1) / 5) * (h - 16);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', maxWidth: 420 }} role="img" aria-label="Band history">
      <line x1={0} x2={w} y1={y(target)} y2={y(target)} stroke="var(--good)" strokeDasharray="4 4" />
      <polyline fill="none" stroke="var(--brand)" strokeWidth={2} points={points.map((p) => `${x(p.at)},${y(p.band)}`).join(' ')} />
      {points.map((p, k) => (
        <circle key={k} cx={x(p.at)} cy={y(p.band)} r={3} fill="var(--brand)" />
      ))}
    </svg>
  );
}

/** Current band for a skill vs the target, with history. */
export function SkillTracker({ section }: { section: Section }) {
  const { user } = useApp();
  const t = user.toefl;
  const now = skillBand(t, section, user.toeflBand);
  const hist = bandHistory(t, section);
  const gap = now ? Math.max(0, t.target - now.band) : null;
  return (
    <div className="card stack">
      <div className="spread">
        <div>
          <div className="section-title">Your {SECTION_LABELS[section]} band</div>
          <span style={{ fontSize: '2.2rem', fontWeight: 800, color: 'var(--brand)' }}>{now ? now.band.toFixed(1) : '–'}</span> <span className="muted">/ 6</span>
          {now && <div className="small muted">from your latest {SOURCE_LABEL[now.source]}</div>}
        </div>
        <span className={`chip ${gap == null ? '' : gap ? 'bad' : 'good'}`}>{gap == null ? `Target ${t.target.toFixed(1)}` : gap ? `+${gap.toFixed(1)} to ${t.target.toFixed(1)}` : `At target ${t.target.toFixed(1)}`}</span>
      </div>
      {now && (
        <div className="bar">
          <span style={{ width: `${(now.band / 6) * 100}%`, background: gap ? undefined : 'var(--good)' }} />
        </div>
      )}
      <BandChart points={hist} target={t.target} />
      {!now && <div className="small muted">Take the section test or do a few practice sets to get an estimate.</div>}
    </div>
  );
}

interface Tool {
  to: string;
  icon: IconName;
  title: string;
  desc: string;
}

function tools(section: Section, dueWords: number, openErrors: number): Tool[] {
  switch (section) {
    case 'reading':
      return [
        { to: '/toefl/reading/practice', icon: 'book', title: 'Test tasks', desc: 'Complete the Words, Daily Life, Academic Passage' },
        { to: '/toefl/reading/vocab', icon: 'spark', title: 'Academic vocabulary', desc: dueWords ? `${dueWords} word${dueWords === 1 ? '' : 's'} due for review` : 'Learn words in context, spaced review' },
        { to: '/toefl/reading/paraphrase', icon: 'repeat', title: 'Paraphrase matching', desc: 'Same meaning, different words' },
        { to: '/toefl/reading/speed', icon: 'bolt', title: 'Speed and comprehension', desc: 'Words per minute plus questions' },
        { to: '/toefl/reading/spelling', icon: 'check', title: 'Word-ending spelling', desc: '-tion, -ment, -ies, -ed for Complete the Words' },
      ];
    case 'listening':
      return [
        { to: '/toefl/listening/practice', icon: 'ear', title: 'Test tasks', desc: 'Response, Conversation, Announcement, Talk; speed and voice control' },
        { to: '/toefl/listening/dictation', icon: 'check', title: 'Dictation', desc: 'Hear it, type every word' },
        { to: '/toefl/listening/notes', icon: 'book', title: 'Note-taking', desc: 'One play, answer from your notes' },
        { to: '/toefl/listening/implied', icon: 'chat', title: 'Implied meaning', desc: 'Tone, hints, polite refusals' },
      ];
    case 'writing':
      return [
        { to: '/toefl/writing/practice', icon: 'spark', title: 'Test tasks', desc: 'Build a Sentence, Email, Discussion; rewrite and rescore' },
        { to: '/toefl/writing/grammar', icon: 'repeat', title: 'Build a Sentence grammar', desc: 'Indirect questions, relative clauses, passive…' },
        { to: '/toefl/writing/phrases', icon: 'book', title: 'Phrase bank', desc: 'Email and discussion phrases, with a drill' },
        { to: '/toefl/writing/planner', icon: 'bolt', title: '1-minute essay planner', desc: 'Plan a discussion post in 60 s, get it checked, then write it' },
        { to: '/toefl/writing/tone', icon: 'chat', title: 'Email tone trainer', desc: 'Rewrite casual sentences for a professor or office' },
        { to: '/toefl/writing/errors', icon: 'target', title: 'Your error patterns', desc: openErrors ? `${openErrors} mistake${openErrors === 1 ? '' : 's'} to fix` : 'Collected from your scored writing' },
        { to: '/toefl/typing', icon: 'bolt', title: 'Typing practice', desc: 'Speed and accuracy, no spellcheck' },
      ];
    case 'speaking':
      return [
        { to: '/toefl/speaking/quick', icon: 'bolt', title: '15-second quick answers', desc: 'Start speaking within 2 seconds' },
        { to: '/toefl/speaking/coach', icon: 'chat', title: 'Answer structure coach', desc: 'Cues while you speak, then a band 5.5 version of your answer' },
        { to: '/toefl/speaking/bank', icon: 'book', title: 'Interview topic bank', desc: 'Questions by theme with model answers' },
        { to: '/toefl/speaking/long', icon: 'repeat', title: 'Long-sentence repeat', desc: '12-20 words, built up chunk by chunk' },
        { to: '/toefl/repeat', icon: 'ear', title: 'Listen and Repeat', desc: '7 sentences, word-by-word feedback' },
        { to: '/toefl/interview', icon: 'mic', title: 'Take an Interview', desc: '4 questions, 45 seconds each' },
      ];
  }
}

/** One skill's page: band tracker, test, drill, lessons and every practice tool. */
export function SkillHome({ section }: { section: Section }) {
  const { user } = useApp();
  const t = user.toefl;
  const now = Date.now();
  const due = Object.values(t.vocab).filter((v) => v.due <= now).length;
  const open = t.writeErrors.filter((e) => e.fixed < 2).length;
  const testTo = section === 'speaking' ? '/toefl/mock' : `/toefl/${section}/test`;
  const drillTo = `/toefl/${section}/drill`;
  return (
    <div className="stack">
      <h1>{SECTION_LABELS[section]}</h1>
      <SkillTracker section={section} />
      <div className="grid grid-3">
        <a className="btn primary big" href={href(drillTo)}>
          <Icon name="bolt" /> Daily 10-min drill
        </a>
        <a className="btn big" href={href(testTo)}>
          <Icon name="target" /> Section test
        </a>
        <a className="btn big" href={href(`/toefl/${section}/lessons`)}>
          <Icon name="book" /> Strategy lessons ({lessonsFor(section).length})
        </a>
      </div>
      <div className="grid grid-2">
        {tools(section, due, open).map((x) => (
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
      {section === 'speaking' && <SoundsFromToefl />}
    </div>
  );
}

/** Strategy lessons for one skill: what each question type tests, steps, traps, a worked example. */
export function Lessons({ section }: { section: Section }) {
  return (
    <div className="stack">
      <h1>{SECTION_LABELS[section]}: strategy lessons</h1>
      {lessonsFor(section).map((l) => (
        <details key={l.id} className="card">
          <summary>
            <b>{l.title}</b>
            <div className="small muted">{l.tests}</div>
          </summary>
          <div className="stack" style={{ marginTop: 10 }}>
            <div>
              <b className="small">How to do it</b>
              <ol className="small" style={{ margin: '4px 0 0' }}>
                {l.steps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
            </div>
            <div>
              <b className="small">Traps</b>
              <ul className="small" style={{ margin: '4px 0 0' }}>
                {l.traps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
            <div className="soft small">
              <div>
                <b>Example:</b> {l.example.item}
              </div>
              <div className="muted">{l.example.thinking}</div>
            </div>
            <a className="btn small primary" href={href(l.practice)} style={{ alignSelf: 'flex-start' }}>
              Practise this
            </a>
          </div>
        </details>
      ))}
    </div>
  );
}
