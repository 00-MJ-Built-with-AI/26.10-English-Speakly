import { useEffect, useState } from 'react';
import { SOUNDS } from '../../content/sounds.ts';
import { currentUnit } from '../../engine/path.ts';
import { LEARNED_BOX } from '../../engine/srs.ts';
import { href } from '../../lib/router.ts';
import { useApp } from '../../lib/store.tsx';
import type { Mistake, VocabItem } from '../../lib/types.ts';
import { Icon } from '../components/Icon.tsx';

interface Item {
  to: string;
  icon: string;
  title: string;
  desc: string;
}

interface Group {
  title: string;
  items: Item[];
  /** Index of the item to suggest first. */
  pick: number;
  why?: string;
}

/** All practice in five groups, each with one suggested starting point. */
export function PracticeHub() {
  const { user, repo } = useApp();
  const unit = currentUnit(user);
  const q = unit ? `?unit=${unit.id}` : '';
  const [due, setDue] = useState(0);
  const [vocabDue, setVocabDue] = useState(0);
  useEffect(() => {
    repo.list<Mistake>('mistakes', { dueBefore: Date.now() }).then((m) => setDue(m.filter((x) => x.box < LEARNED_BOX).length));
    repo.list<VocabItem>('vocab', { dueBefore: Date.now() }).then((v) => setVocabDue(v.filter((x) => x.box < LEARNED_BOX).length));
  }, [repo]);

  const weakest = SOUNDS.filter((s) => user.sounds[s.id] != null && user.sounds[s.id] < 75).sort((a, b) => user.sounds[a.id] - user.sounds[b.id])[0];

  const groups: Group[] = [
    {
      title: 'Pronunciation',
      items: [
        weakest
          ? { to: `/practice/sounds/${weakest.id}`, icon: 'wave', title: `Sound drill: ${weakest.title}`, desc: `Your weakest sound (${Math.round(user.sounds[weakest.id])}).` }
          : { to: '/practice/sounds', icon: 'wave', title: 'Sound drills', desc: 'p/b, v/f, th, short vowels, American r, stress and intonation.' },
        { to: `/practice/shadow${q}`, icon: 'ear', title: 'Shadowing', desc: 'Repeat native sentences right away; every word scored, melody graph.' },
        { to: '/twisters', icon: 'bolt', title: 'Tongue twisters', desc: 'Fast, fun practice built around your weakest sounds.' },
        { to: `/practice/read${q}`, icon: 'book', title: 'Read aloud', desc: 'A passage at your level: accuracy, pace and rhythm.' },
        { to: '/practice/mytext', icon: 'book', title: 'My texts', desc: 'Your own emails, slides or talks, out loud.' },
        { to: '/checkup', icon: 'target', title: 'Accent check-up', desc: 'Once a month: every sound scored and compared.' },
      ],
      pick: 0,
      why: weakest ? 'your weakest sound' : undefined,
    },
    {
      title: 'Fluency',
      items: [
        { to: `/practice/fast${q}`, icon: 'bolt', title: 'Speak fast', desc: 'Start talking within 3 seconds.' },
        { to: '/opinion', icon: 'chat', title: '60-second opinion', desc: 'Point, reason, example, conclusion, on the clock.' },
        { to: '/story', icon: 'spark', title: 'Story builder', desc: 'Three random words, one short story.' },
        { to: '/journal', icon: 'book', title: 'Speaking journal', desc: 'One prompt a day, 1-2 minutes, feedback.' },
        { to: '/practice/fillers', icon: 'pause', title: 'Fillers and pauses', desc: 'Track um/uh and freezes; learn to buy time.' },
        { to: '/car', icon: 'play', title: 'Car mode', desc: 'Eyes-free practice by voice.' },
      ],
      pick: 0,
    },
    {
      title: 'Conversations',
      items: [
        { to: '/tutor', icon: 'chat', title: 'Talk with the tutor', desc: 'Hands-free conversation; the tutor remembers you.' },
        { to: '/roleplays', icon: 'users', title: 'Role-plays', desc: 'Stand-ups, negotiations, angry clients and more.' },
        { to: '/phone', icon: 'chat', title: 'Phone calls', desc: 'Realistic calls with phone-line sound.' },
        { to: '/debate', icon: 'users', title: 'Debate', desc: 'The tutor argues the other side.' },
        { to: '/smalltalk', icon: 'users', title: 'Small talk', desc: 'Start, keep going, end politely.' },
        { to: '/interview-prep', icon: 'trophy', title: 'Interview from your CV', desc: 'A mock interview for a real job ad.' },
      ],
      pick: 0,
    },
    {
      title: 'Vocabulary and grammar',
      items: [
        { to: '/review', icon: 'repeat', title: 'Review my mistakes', desc: due ? `${due} due today.` : 'Your corrections come back until you get them right.' },
        { to: '/vocab', icon: 'book', title: 'My phrases', desc: vocabDue ? `${vocabDue} due today.` : 'Your phrase bank, reviewed out loud.' },
        { to: '/numbers', icon: 'target', title: 'Numbers and spelling', desc: 'Prices, dates, emails, spelling names.' },
        { to: '/idiom', icon: 'spark', title: 'Idiom of the day', desc: 'Hear it, say it, use it.' },
        { to: '/better', icon: 'chat', title: 'Say it better', desc: 'Arabic or rough English in, natural English out.' },
        { to: '/retell', icon: 'ear', title: 'Listen and retell', desc: 'Hear a short talk, retell the main points.' },
      ],
      pick: due ? 0 : vocabDue ? 1 : 2,
      why: due ? 'mistakes are due' : vocabDue ? 'phrases are due' : undefined,
    },
    {
      title: 'TOEFL and level',
      items: [
        { to: '/toefl', icon: 'trophy', title: 'TOEFL speaking', desc: 'Listen and Repeat, Take an Interview, full mock.' },
        { to: '/placement', icon: 'target', title: 'Fast-track level test', desc: 'Pass whole levels in a few minutes.' },
        { to: '/path', icon: 'path', title: 'My path', desc: unit ? `Now: ${unit.level} · ${unit.title}` : 'All units done.' },
      ],
      pick: user.settings.examDate ? 0 : 2,
      why: user.settings.examDate ? 'your exam is coming' : undefined,
    },
  ];

  return (
    <div className="stack">
      <h1>Practice</h1>
      <p className="muted">Five areas. The highlighted card in each is a good place to start today.</p>
      {groups.map((g) => {
        const main = g.items[g.pick];
        const rest = g.items.filter((_, i) => i !== g.pick);
        return (
          <section key={g.title} className="section" style={{ marginTop: 18 }}>
            <div className="section-title">{g.title}</div>
            <a className="list-item" href={href(main.to)} style={{ borderColor: 'var(--brand)', marginTop: 0 }}>
              <span className="icon-tile">
                <Icon name={main.icon} />
              </span>
              <span className="grow">
                <div className="row">
                  <b>{main.title}</b>
                  <span className="chip brand">Start here{g.why ? `: ${g.why}` : ''}</span>
                </div>
                <div className="small muted">{main.desc}</div>
              </span>
              <Icon name="next" />
            </a>
            <div className="grid grid-2" style={{ marginTop: 8 }}>
              {rest.map((it) => (
                <a key={it.to} className="list-item" href={href(it.to)} style={{ marginTop: 0, padding: '10px 12px' }}>
                  <Icon name={it.icon} size={18} />
                  <span className="grow">
                    <b className="small">{it.title}</b>
                    <div className="small muted">{it.desc}</div>
                  </span>
                </a>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
