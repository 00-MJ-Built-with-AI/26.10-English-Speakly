import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { User } from 'firebase/auth';
import { hasFirebase } from './config.ts';
import { signInWithGoogle, signOutUser, watchUser } from './lib/firebase.ts';
import { CloudRepo, LocalRepo } from './lib/repo.ts';
import { href, useRoute } from './lib/router.ts';
import { AppProvider, useApp, type Account } from './lib/store.tsx';
import { Icon } from './ui/components/Icon.tsx';
import { Today } from './ui/pages/Today.tsx';
import { PathPage } from './ui/pages/Path.tsx';
import { UnitPage } from './ui/pages/Unit.tsx';
import { UnitCheck } from './ui/pages/UnitCheck.tsx';
import { PracticeHub } from './ui/pages/Practice.tsx';
import { Shadowing } from './ui/pages/Shadowing.tsx';
import { ReadAloud } from './ui/pages/ReadAloud.tsx';
import { SoundsList, SoundDrill } from './ui/pages/Sounds.tsx';
import { SpeakFast } from './ui/pages/SpeakFast.tsx';
import { Roleplays } from './ui/pages/Roleplays.tsx';
import { Tutor } from './ui/pages/Tutor.tsx';
import { Review } from './ui/pages/Review.tsx';
import { ToeflHub, ToeflRepeat, ToeflInterview } from './ui/pages/Toefl.tsx';
import { ProgressPage } from './ui/pages/Progress.tsx';
import { Recordings } from './ui/pages/Recordings.tsx';
import { SettingsPage } from './ui/pages/Settings.tsx';
import { Grammar } from './ui/pages/Grammar.tsx';
import { UpdateBadge } from './ui/components/UpdateBadge.tsx';
import { Placement } from './ui/pages/Placement.tsx';
import { Fillers } from './ui/pages/Fillers.tsx';
import { Journal } from './ui/pages/Journal.tsx';
import { Better } from './ui/pages/Better.tsx';
import { Vocab } from './ui/pages/Vocab.tsx';
import { MyTexts } from './ui/pages/MyTexts.tsx';
import { Achievements } from './ui/pages/Achievements.tsx';
import { Debate, InterviewPrep, PhoneCalls, SmallTalk } from './ui/pages/Scenes.tsx';
import { Retell } from './ui/pages/Retell.tsx';
import { Checkup } from './ui/pages/Checkup.tsx';
import { Car } from './ui/pages/Car.tsx';
import { IdiomPage } from './ui/pages/IdiomPage.tsx';

export function App() {
  if (!hasFirebase) return <LocalApp />;
  return <CloudApp />;
}

function LocalApp() {
  const repo = useMemo(() => new LocalRepo(), []);
  return (
    <AppProvider repo={repo} account={null}>
      <Shell />
    </AppProvider>
  );
}

function CloudApp() {
  const [fbUser, setFbUser] = useState<User | null | undefined>(undefined);
  useEffect(() => watchUser(setFbUser), []);
  const account = useMemo<Account | null>(
    () => (fbUser ? { uid: fbUser.uid, name: fbUser.displayName ?? '', email: fbUser.email ?? undefined, photo: fbUser.photoURL ?? undefined } : null),
    [fbUser],
  );
  const repo = useMemo(() => (fbUser ? new CloudRepo(fbUser.uid) : null), [fbUser]);
  if (fbUser === undefined) return <div className="center-screen muted">Loading…</div>;
  if (!fbUser || !repo) return <SignIn />;
  return (
    <AppProvider key={fbUser.uid} repo={repo} account={account} signOut={() => signOutUser()}>
      <Shell />
    </AppProvider>
  );
}

function SignIn() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="center-screen">
      <div className="card" style={{ maxWidth: 420, width: '100%', padding: 28 }}>
        <div className="logo" style={{ justifyContent: 'center', fontSize: '1.6rem' }}>
          <span className="logo-mark" style={{ width: 40, height: 40 }}>
            <Icon name="wave" size={22} />
          </span>
          Speakly
        </div>
        <p className="muted" style={{ margin: '14px 0 22px' }}>
          Speak English with confidence, from A1 to C2. Sign in to save your progress on all your devices.
        </p>
        <button
          className="btn big"
          style={{ width: '100%' }}
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await signInWithGoogle();
            } catch (e) {
              setError(e instanceof Error ? e.message.replace('Firebase: ', '') : String(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          <Icon name="google" size={20} /> Continue with Google
        </button>
        {error && (
          <div className="banner error" style={{ marginTop: 14 }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

const TABS: { to: string; label: string; icon: string; match: string[] }[] = [
  { to: '/today', label: 'Today', icon: 'home', match: ['today', ''] },
  { to: '/path', label: 'Path', icon: 'path', match: ['path', 'unit', 'grammar', 'placement'] },
  { to: '/practice', label: 'Practice', icon: 'spark', match: ['practice', 'review', 'roleplays', 'journal', 'better', 'vocab', 'retell', 'checkup', 'car', 'idiom'] },
  { to: '/tutor', label: 'Tutor', icon: 'chat', match: ['tutor', 'debate', 'phone', 'smalltalk', 'interview-prep'] },
  { to: '/toefl', label: 'TOEFL', icon: 'trophy', match: ['toefl'] },
  { to: '/progress', label: 'Progress', icon: 'chart', match: ['progress', 'recordings', 'achievements'] },
];

function Shell() {
  const route = useRoute();
  const { account, status, repo } = useApp();
  const top = route.path[0] ?? '';
  const testMode = repo.kind === 'local' || !status.speech || !status.tutor;
  let page: ReactNode;
  const [a, b, c] = route.path;
  switch (a) {
    case undefined:
    case 'today':
      page = <Today />;
      break;
    case 'path':
      page = <PathPage />;
      break;
    case 'unit':
      page = c === 'check' ? <UnitCheck id={b} /> : <UnitPage id={b} />;
      break;
    case 'placement':
      page = <Placement />;
      break;
    case 'grammar':
      page = <Grammar unitId={b} />;
      break;
    case 'practice':
      if (b === 'shadow') page = <Shadowing unitId={route.query.get('unit') ?? undefined} />;
      else if (b === 'read') page = <ReadAloud unitId={route.query.get('unit') ?? undefined} />;
      else if (b === 'sounds') page = c ? <SoundDrill id={c} unitId={route.query.get('unit') ?? undefined} /> : <SoundsList />;
      else if (b === 'fast') page = <SpeakFast unitId={route.query.get('unit') ?? undefined} />;
      else if (b === 'fillers') page = <Fillers />;
      else if (b === 'mytext') page = <MyTexts />;
      else page = <PracticeHub />;
      break;
    case 'journal':
      page = <Journal />;
      break;
    case 'better':
      page = <Better />;
      break;
    case 'vocab':
      page = <Vocab />;
      break;
    case 'debate':
      page = <Debate />;
      break;
    case 'phone':
      page = <PhoneCalls />;
      break;
    case 'smalltalk':
      page = <SmallTalk />;
      break;
    case 'interview-prep':
      page = <InterviewPrep />;
      break;
    case 'retell':
      page = <Retell />;
      break;
    case 'checkup':
      page = <Checkup />;
      break;
    case 'car':
      page = <Car />;
      break;
    case 'idiom':
      page = <IdiomPage />;
      break;
    case 'roleplays':
      page = <Roleplays />;
      break;
    case 'review':
      page = <Review />;
      break;
    case 'tutor':
      page = <Tutor query={route.query} />;
      break;
    case 'toefl':
      page = b === 'repeat' ? <ToeflRepeat mock={false} /> : b === 'interview' ? <ToeflInterview mock={false} /> : b === 'mock' ? <ToeflRepeat mock /> : b === 'mock-interview' ? <ToeflInterview mock /> : <ToeflHub />;
      break;
    case 'progress':
      page = <ProgressPage />;
      break;
    case 'achievements':
      page = <Achievements />;
      break;
    case 'recordings':
      page = <Recordings />;
      break;
    case 'settings':
      page = <SettingsPage />;
      break;
    default:
      page = <Today />;
  }
  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <a className="logo" href={href('/today')}>
            <span className="logo-mark">
              <Icon name="wave" size={18} />
            </span>
            Speakly
          </a>
          <nav className="nav">
            {TABS.map((t) => (
              <a key={t.to} href={href(t.to)} className={t.match.includes(top) ? 'active' : ''}>
                {t.label}
              </a>
            ))}
          </nav>
          <div className="top-right">
            {testMode && (
              <a className="chip ok" href={href('/settings')} title="Some services are not connected yet">
                Test mode
              </a>
            )}
            <UpdateBadge />
            <a className="btn ghost small" href={href('/settings')} aria-label="Settings">
              <Icon name="gear" />
            </a>
            {account?.photo ? <img className="avatar" src={account.photo} alt="" referrerPolicy="no-referrer" /> : null}
          </div>
        </div>
      </header>
      {/* A new address always starts the page fresh (e.g. one sound drill to the next). */}
      <main className="main" key={`${route.path.join('/')}?${route.query.toString()}`}>
        {page}
      </main>
      <nav className="tabbar">
        {TABS.filter((t) => t.to !== '/toefl').map((t) => (
          <a key={t.to} href={href(t.to)} className={t.match.includes(top) || (t.to === '/practice' && top === 'toefl') ? 'active' : ''}>
            <Icon name={t.icon} size={22} />
            {t.label}
          </a>
        ))}
      </nav>
    </>
  );
}
