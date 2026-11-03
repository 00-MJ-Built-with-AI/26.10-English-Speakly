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

## TOEFL for KAUST (2026-11-03)
- All four sections in the 2026 format. AI writes original items (`toeflGen`): Complete the Words, Read in
  Daily Life, Academic Passage, Choose a Response, Conversation, Announcement, Academic Talk, Build a
  Sentence, Email, Academic Discussion. Practice at `/toefl/reading|listening|writing?task=...` with
  lower/standard/upper difficulty and answers with explanations.
- Writing scored 0-5 with the ETS-style rubric (`toeflWrite`); typed only, no spellcheck or pasting.
  Typing practice (`/toefl/typing`) with wpm and accuracy.
- Scores (`/toefl/scores`): photo of the score report read by the AI (`scoreReport`), confirm or type the
  numbers. Band <-> 0-30 concordance from ETS (`src/engine/toeflScale.ts`).
- KAUST goal: minimum 79, target 85 by default (both editable). Gap per section and a day-by-day plan up
  to the next exam date (`src/engine/toeflPlan.ts`).
- Full mock (`/toefl/full-mock`): timed Reading and Listening with two-stage adaptive modules, Writing,
  then the speaking mock; saves an estimated score and compares it with the goal.
- Mistake log (`/toefl/mistakes`): accuracy by question type, weak types feed the practice sets. 44 unit tests.

## TOEFL per skill (2026-11-03, round 2)
- Goal on the 1-6 scale: target 5.5, minimum 5.0, for every section (KAUST's pages still say 79/81 on
  0-120 = ETS band 4.0; below 90 = 4.5 means a mandatory English course). Old 0-120 goals migrate.
- Overview + tabs for Reading, Listening, Writing, Speaking (`/toefl/{skill}`): band tracker with history
  and target line (`src/engine/toeflSkill.ts`), section test (`/test`, adaptive), daily 10-min drill
  (`/drill`, also on Today for the weakest skill), strategy lessons (`/lessons`, 19 types).
- Reading: academic vocabulary with spaced review, paraphrase matching, speed + comprehension,
  word-ending spelling. Listening: dictation, note-taking (key points checked), implied meaning, practice
  speed 0.8/1/1.2x and varied voices. Writing: rewrite and rescore, Build a Sentence grammar patterns,
  phrase bank + drill, error-pattern tracker. Speaking: structure coach (live cues, band 5.5 rewrite of your
  own answer via `speakCompare`), interview topic bank with model answers, long-sentence repeat in chunks.
- Daily plan about 50 minutes, starting today; section test on Wednesdays, full mock on Saturdays. 48 tests.

## TOEFL round 3 (2026-11-03)
- Learning from mistakes: "Why? Explain this" on every missed question (AI `explain`, with follow-ups),
  wrong-answer review (`/toefl/review`: back after 1 day, then 3; leaves after two right answers), Arabic
  explanations switch (`arabic` task, cached), weekly accuracy trends per question type on the mistake log.
- Readiness predictor (band and likely range per skill; ready / close / not yet / need data), exam-day
  checklist with countdown (`/toefl/exam-day`), weekly report (`/toefl/weekly`, banner on Mondays), today's
  plan with check-off and .ics calendar export (`src/engine/toeflExtras.ts`).
- Writing: 1-minute essay planner (`planCheck`) then write the post; email tone trainer (`tone` items).
- Speaking: 15-second quick answers (start delay), real speaking daily drill (quick answers + one coached
  answer), weak sounds from TOEFL answers (Azure phonemes) linked to sound drills.
- Note-taking feedback now from the AI (`notesFeedback`). 52 tests.

## KAUST coach and TOEFL round 4 (2026-11-03)
- KAUST application coach (`/kaust`, also a tab on the TOEFL pages): applicant profile (program, interests,
  CV, professors of interest), statement of purpose review with versions (`sopReview`), faculty email
  writer/improver (`facultyEmail`), faculty interview by voice (tutor kind `research`).
- Grad-school English: 2-minute research pitch with feedback and three audience questions answered by voice
  (`pitch`, `qa`); seminar discussion with an AI professor and two classmates (tutor kind `seminar`).
- Score calibration: an official result is compared with what mocks, section tests and practice predicted;
  later estimates shift per skill (`calibrate` in `src/engine/toeflSkill.ts`), shown on the Scores page.
- Question bank (`src/ai/toeflBank.ts`, IndexedDB per device): fresh saved sets start instantly and are
  replaced in the background; offline or on AI errors, done sets are reused; offline packs of ~37 sets
  (`/toefl/bank`).
- Test-style timed tests: app menus hidden, slim header with hide-time toggle and Exit, leave warning.
- TOEFL section in the progress report (bands, likely ranges, official result, readiness, weak types). 53 tests.

## Go-live and planning (2026-11-03)
- Go-live check (`/go-live`, from Settings and the test-mode banner): server functions, one real AI call,
  Azure token and test voice, Google sign-in and cloud read, microphone, spending limit; each with the fix.
- One combined daily plan on Today when TOEFL is active: core speaking items plus TOEFL items to about
  60 minutes (tick-off shared with the TOEFL page) and KAUST reminders.
- KAUST application tracker (`/kaust/tracker`): deadlines you enter, documents checklist (TOEFL code 4107),
  recommenders with status and an AI recommender brief (`recBrief`); deadlines and letters due within two
  weeks appear on Today (`src/engine/kaust.ts`).
- "Will I reach 5.5 in time?": trend per skill from tests and weekly practice projected to the exam date,
  with the extra daily minutes needed (`project` in `src/engine/toeflExtras.ts`).
- Backup and restore (`/backup`): one JSON file with the user document, history collections and the local
  question bank (no recording audio); restore replaces progress and merges history. 55 tests.

## Not verified yet
- Real microphone, Azure pronunciation scores and voices, the Claude tutor, Firebase sign-in and sync:
  all need the keys from SETUP.md. First real run should be on Chrome with headphones.
- Hands-free turn-taking timing (default 1.6 s pause) needs tuning on real speech.
- Install-to-home-screen on the phone.
- Arabic recognition for "Say it better" and the intonation graph on real recordings (need Azure + mic).
- Passing a level in the fast-track test (needs real speech; logic is unit-tested).
- HD voices on the user's Azure resource; phone-line filter on real Azure audio; car mode on a phone.
- TOEFL items, writing scores, explanations, Arabic, plan checks and score-report reading with the real Claude API (test mode uses fixed
  samples); how close mock estimates are to real results.
- Spending numbers against real Anthropic/Azure bills (Azure rates are editable estimates); the mic check
  thresholds on a real microphone.

## Owner actions
1. Create Firebase project (Google sign-in, Firestore, Blaze + Storage, rules), copy web config.
2. Create Azure Speech resource, copy key and region.
3. Create Anthropic API key; optionally pick a cheaper TUTOR_MODEL.
4. Add the keys as Vercel environment variables (project `speakly`, live at speakly-puce-gamma.vercel.app,
   auto-deploys from GitHub main) and decide on Vercel Deployment Protection.
