# Speakly

A speaking-first English trainer, A1 to C2, for an Arabic speaker aiming at work meetings and the new
(2026) TOEFL iBT. React + TypeScript + Vite, installable on a phone (PWA), Firebase for Google sign-in
and progress, Azure AI Speech for pronunciation scoring and the tutor's voice, Claude for the tutor.

- **Path**: 37 units from A1 to C2. Each unit opens with a 3-minute speaking check (pronunciation,
  grammar in speech, open task). Pass it and the unit is done; miss a part and you practise only that part.
- **Practice**: shadowing, read-aloud, sound drills for Arabic speakers (p/b, v/f, th, short vowels,
  American r, clusters, stress, intonation), speak-fast drills against hesitation, role-plays.
- **Tutor**: hands-free voice conversation (or push-to-talk), light corrections during, full report after.
- **TOEFL**: Listen and Repeat, Take an Interview, full mock, band estimate on the 1-6 scale.
- **More practice**: fast-track level test, daily speaking journal, "say it better" from Arabic,
  personal phrase bank, your own texts, filler and pause tracker, intonation graph, mouth diagrams.
- **Conversation modes**: debate, phone calls, small talk, job interview from your CV; the tutor
  remembers you between sessions. Plus listen-and-retell, monthly accent check-up, car mode, idiom of the day.
- **Everyday use**: first-run setup, microphone check, spending meter with a daily limit, weekly focus,
  printable progress report, comparison with earlier test scores, light/dark switch. Drills for numbers
  and spelling, 60-second opinions, story building and tongue twisters.
- **Goals**: TOEFL exam date and target band plan, XP and achievements.
- **Progress**: skill rings (0-100 + CEFR, like an EF SET report), history chart, mistake bank with
  spaced repetition, streak, weekly report, recordings (then vs now).

```
npm install
npm run dev      # http://localhost:5190 (runs the /api functions too)
npm test
npm run build
```

Setup of Firebase, Azure and Anthropic: see [SETUP.md](SETUP.md). Without them the app runs in test mode.

Code map: `src/content` (syllabus, sounds, TOEFL sets), `src/engine` (scoring, path, review schedule),
`src/speech` (Azure + browser engines), `src/ui/pages`, `api/` (Vercel functions: sign-in check,
Azure token, tutor), `shared/tasks.ts` (AI task shapes shared by browser and server).
