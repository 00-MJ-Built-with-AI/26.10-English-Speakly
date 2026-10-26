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

## Not verified yet
- Real microphone, Azure pronunciation scores and voices, the Claude tutor, Firebase sign-in and sync:
  all need the keys from SETUP.md. First real run should be on Chrome with headphones.
- Hands-free turn-taking timing (default 1.6 s pause) needs tuning on real speech.
- Install-to-home-screen on the phone.

## Owner actions
1. Create Firebase project (Google sign-in, Firestore, Blaze + Storage, rules), copy web config.
2. Create Azure Speech resource, copy key and region.
3. Create Anthropic API key; optionally pick a cheaper TUTOR_MODEL.
4. Decide: GitHub repo (public or private) and Vercel deploy.
