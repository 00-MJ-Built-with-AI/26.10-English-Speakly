import { useEffect, useState } from 'react';
import { currentUnit } from '../../engine/path.ts';
import { href } from '../../lib/router.ts';
import { useApp } from '../../lib/store.tsx';
import type { Mistake } from '../../lib/types.ts';
import { Icon } from '../components/Icon.tsx';

export function PracticeHub() {
  const { user, repo } = useApp();
  const unit = currentUnit(user);
  const [due, setDue] = useState<number | null>(null);
  useEffect(() => {
    repo.list<Mistake>('mistakes', { dueBefore: Date.now() }).then((m) => setDue(m.filter((x) => x.box < 6).length));
  }, [repo]);
  const items = [
    { to: '/review', icon: 'repeat', title: 'Review my mistakes', desc: due == null ? 'Your corrections come back until you get them right.' : `${due} due today`, accent: due ? 'var(--bad)' : undefined },
    { to: '/journal', icon: 'book', title: 'Speaking journal', desc: 'One prompt a day. Talk for 1-2 minutes, get feedback and a natural version.' },
    { to: '/better', icon: 'chat', title: 'Say it better', desc: 'Say it in Arabic or rough English; get 3 natural ways to say it in English.' },
    { to: '/vocab', icon: 'book', title: 'My phrases', desc: 'Your personal phrase bank, reviewed by using each phrase out loud.' },
    { to: `/practice/shadow${unit ? `?unit=${unit.id}` : ''}`, icon: 'ear', title: 'Shadowing', desc: 'Hear a native sentence, repeat it right away, see every word scored.' },
    { to: '/practice/mytext', icon: 'book', title: 'My texts', desc: 'Practise your own emails, slides or talk scripts out loud.' },
    { to: `/practice/read${unit ? `?unit=${unit.id}` : ''}`, icon: 'book', title: 'Read aloud', desc: 'Read a passage; get accuracy, pace and rhythm.' },
    { to: '/practice/sounds', icon: 'wave', title: 'Sound drills', desc: 'p/b, v/f, th, short vowels, American r and more, for Arabic speakers.' },
    { to: `/practice/fast${unit ? `?unit=${unit.id}` : ''}`, icon: 'bolt', title: 'Speak fast', desc: 'Start talking within 3 seconds. Beats hesitation.' },
    { to: '/practice/fillers', icon: 'pause', title: 'Fillers and pauses', desc: 'Track um/uh, restarts and freezes; learn natural ways to buy time.' },
    { to: '/roleplays', icon: 'users', title: 'Role-plays', desc: 'Stand-ups, negotiations, interviews, angry clients and more.' },
    { to: '/tutor', icon: 'chat', title: 'Talk with the tutor', desc: 'Hands-free conversation on any topic.' },
    { to: '/toefl', icon: 'trophy', title: 'TOEFL speaking', desc: 'New 2026 format: Listen and Repeat, Take an Interview.' },
  ];
  return (
    <div>
      <h1>Practice</h1>
      <p className="muted">Everything here adapts to your current unit{unit ? ` (${unit.level}: ${unit.title})` : ''}.</p>
      <div className="grid grid-2" style={{ marginTop: 16 }}>
        {items.map((it) => (
          <a key={it.to} className="list-item" href={href(it.to)} style={{ marginTop: 0 }}>
            <span className="icon-tile" style={it.accent ? { color: it.accent } : undefined}>
              <Icon name={it.icon} />
            </span>
            <span className="grow">
              <b>{it.title}</b>
              <div className="small muted">{it.desc}</div>
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
