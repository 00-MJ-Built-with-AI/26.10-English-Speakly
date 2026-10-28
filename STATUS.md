# Status

## Built (v0.1, 2026-10-26)
- Google sign-in (Firebase Auth), progress in Firestore with offline cache, recordings in Firebase Storage.
- Local test mode when nothing is configured (localStorage + IndexedDB, browser speech, stand-in tutor).
- Server functions: `/api/status`, `/api/speech-token` (Azure token), `/api/tutor` (streamed chat + structured
  tasks: check, report, grade, task, toefl, generate, weekly). Sign-in token checked; optional email allowlist.
- 37-unit A1-C2 syllabus with can-do goals, grammar notes, vocabulary, target sounds, shadowing sentences,
  speak-fast drills, check question and role-play for every unit.
- Unit checks with test-out, per-part lessons, re-checks, jump-ahead.
- Shadowing, read-aloud, 20 sound drills (listening quiz + phoneme scores), speak-fast with start-time
  measurement, mistake review (Leitner boxes 1/3/7/14/30 days), role-plays, hands-free tutor with live
  corrections and end report, TOEFL 2026 Listen and Repeat / Take an Interview / mock.
- Today plan, skill rings, history chart, practice calendar, weekly report, weak sounds, recordings
  with then-vs-now, settings (voice, speed, turn pause, corrections, goal), data export.
- 16 unit tests; checked in the browser in test mode (typed answers, no microphone in the preview pane).

## Batch 2 (2026-10-26)
- Fast-track level test (`/placement`): one block per level, passing marks the whole level done; stops at
  the first level not passed. Shared `CheckRunner` + `evaluateCheck` now also power unit checks.
- Filler and pause tracker (`/practice/fillers`): um/uh, restarts, long pauses, start delay, per-minute
  trend; recorded on tutor sessions, journal, speak-fast, TOEFL interview and checks; time-buying phrases
  drill and a no-freeze drill.
- Daily speaking journal (`/journal`): prompt of the day, 1-2 min answer, feedback, natural version to
  read aloud, topic phrases, history with trend and recordings.
- Say it better (`/better`): speak Arabic (dialect choice, Azure `ar-*`) or rough English, get 3 natural
  versions to practise.
- Personal phrase bank (`/vocab`): from tutor reports, journal, say-it-better or added by hand (AI
  definition); spoken review on the same 1/3/7/14/30-day schedule.
- Intonation graph: pitch contour of your recording vs the model voice, match %, flatness hint
  (shadowing and sound-drill sentences). Model line needs Azure voices.
- Shadow your own text (`/practice/mytext`): saved texts, sentence by sentence or read it all.
- Mouth diagrams: side-view drawings (lips, tongue, contact, air, voice) for 12 sound drills.
- Exam date and target band: card on the TOEFL page and in Settings, band chart with target line;
  Today's plan adds TOEFL practice by phase (build / focus / final).
- Achievements and XP: 5 XP per minute plus bonuses, 50 per finished unit, 26 badges, toasts,
  `/achievements`; can be hidden in Settings.
- Pages now start fresh on every route change (fixed stale state between sound drills).
- 26 unit tests.

## Voice (2026-10-26)
- Azure HD voices by default (fallback to standard), tutor speaks in longer stretches, browser voices
  awaited and ranked with a picker (test mode). Edge "Online (Natural)" voices recommended until Azure.

## Batch 3 (2026-10-26)
- Tutor memory: facts the learner mentions, recent topics, phrases and mistakes in progress go into the
  tutor's instructions; viewable and deletable in Settings; can be switched off.
- Debate (`/debate`), phone-call simulator with phone-line sound and call screen (`/phone`), small talk and
  networking (`/smalltalk`), mock interview from a pasted job ad and CV (`/interview-prep`): all run in
  the tutor with their own instructions, endings and report focus.
- Listen and retell (`/retell`), monthly accent check-up with per-sound history (`/checkup`), car mode
  (`/car`, eyes-free, wake lock), idiom of the day (`/idiom`, 50 idioms), stress and linking marks in
  shadowing, new XP bonuses and 4 badges. 30 unit tests.

## Batch 4 (2026-10-29)
- Mic and audio check (`/mic-check`, also in first-run setup and Settings): noise, voice level, echo from
  speakers, test-sentence recognition, with fixes.
- Spending: server reports token usage (`X-Usage` header, usage after a NUL mark in the chat stream); the
  app prices it (`shared/pricing.ts`) plus editable Azure estimates, shows today/month in Settings, warns on
  Today, and at the daily limit pauses the AI tutor and switches speech to the free browser engine.
- First-run setup (`/welcome`): name, goals, earlier scores, mic check, then the level test.
- Practice page in 5 groups with a data-based "Start here" in each.
- Earlier test scores (EF SET etc.) with then-vs-now on Progress.
- Weekly focus: every Monday the two weakest areas (sound, hesitation, skill, mistake bank) go on Today.
- Progress report (`/report`): one page, print / Save as PDF.
- Light/dark switch (header button and Settings).
- Numbers and spelling (`/numbers`), 60-second opinion with structure coach (`/opinion`), story builder
  (`/story`), tongue twisters by weakest sound with speed levels (`/twisters`). 38 unit tests.

## Not verified yet
- Real microphone, Azure pronunciation scores and voices, the Claude tutor, Firebase sign-in and sync:
  all need the keys from SETUP.md. First real run should be on Chrome with headphones.
- Hands-free turn-taking timing (default 1.6 s pause) needs tuning on real speech.
- Install-to-home-screen on the phone.
- Arabic recognition for "Say it better" and the intonation graph on real recordings (need Azure + mic).
- Passing a level in the fast-track test (needs real speech; logic is unit-tested).
- HD voices on the user's Azure resource; phone-line filter on real Azure audio; car mode on a phone.
- Spending numbers against real Anthropic/Azure bills (Azure rates are editable estimates); the mic check
  thresholds on a real microphone.

## Owner actions
1. Create Firebase project (Google sign-in, Firestore, Blaze + Storage, rules), copy web config.
2. Create Azure Speech resource, copy key and region.
3. Create Anthropic API key; optionally pick a cheaper TUTOR_MODEL.
4. Deploy to Vercel once the keys exist (repo: github.com/00-MJ-Built-with-AI/26.10-English-Speakly).
