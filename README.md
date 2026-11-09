# DailySpeak – English Practice for Professionals

A mobile-first, AI-powered web app that helps software engineers and other IT professionals improve their spoken English with a fresh **15–20 minute lesson every day**.

Each daily lesson contains:

- **5 words**: definition, optional Sinhala meaning, pronunciation, an IT example and an everyday example
- **5 phrases**: meaning, when to use it, IT and everyday examples
- **An IT conversation and an everyday conversation**: the scenario rotates daily, with audio playback, highlighted key expressions, role-play read-aloud and a "your turn" prompt
- **Speaking practice**: read aloud or answer questions by voice, with feedback on grammar, sentence structure, vocabulary, pronunciation and naturalness
- **A daily challenge**: a short speaking task

Other features:

- **AI conversation partner**: stand-up, QA bug talk, interview, client update, small talk and restaurant scenarios
- **Revision**: SM-2 spaced repetition, with meaning quizzes, fill-in-the-blank and sentence-building exercises
- **Tracking**: streaks, words and phrases learned, completed lessons, speaking scores and recurring mistakes
- **Personalisation**: profession, domain, level, goal, interests and explanation language. Difficulty rises as you improve, delivered items never repeat, and recurring mistakes feed into future lessons.

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 15 (App Router) + React 19 + TypeScript, Tailwind CSS 4 |
| Backend | Next.js route handlers (Node runtime) |
| Database | PostgreSQL (works with Supabase Postgres: just set `DATABASE_URL`) |
| AI | OpenAI Chat Completions (JSON mode, zod-validated) + Whisper transcription. **Keys stay server-side.** |
| Scheduler | Built-in in-process scheduler, **or** `npm run worker`, **or** `/api/cron/daily` (Vercel Cron / Supabase pg_cron / system cron) |
| Notifications | Web Push (VAPID + service worker), email (SMTP via nodemailer), in-app |
| Speech | Browser MediaRecorder + Web Speech API, plus server-side Whisper when a key is set; browser text-to-speech for listening |

## Getting started

```bash
cp .env.example .env            # then edit DATABASE_URL, CRON_SECRET, OPENAI_API_KEY …
npm install
npm run db:migrate              # creates the tables (idempotent)
npm run vapid                   # paste the keys into .env for push notifications
npm run dev                     # http://localhost:3000
```

Without `OPENAI_API_KEY`, the app still works fully. It uses a curated lesson bank of 45 words, 40 phrases, 17 conversations and 14 challenges, a rule-based grammar checker tuned to common South Asian English patterns, and a guided conversation partner. Without `SMTP_HOST`, emails are written to `./outbox/*.json`.

## How daily generation works

`src/lib/scheduler/daily.ts` → `runDailyTick(now)` runs every few minutes:

1. It takes a Postgres advisory lock, so only one instance runs a tick at a time.
2. For each onboarded user, it computes **today in the user's timezone** and calls `ensureLesson()`. That function claims the `(user_id, lesson_date)` row first; a `UNIQUE` constraint means concurrent callers can never create duplicates. It then generates the lesson with AI. If the AI call fails, times out or returns invalid JSON (after one retry), it falls back to the curated lesson. Delivered words and phrases go into `learning_items`, which is used for de-duplication and spaced repetition.
3. Once the user's local time reaches their **preferred time**, notifications are sent once per channel (in-app, push, email). Each channel is claimed through `UNIQUE(user_id, lesson_date, channel)`.

Users can open any previous lesson from **Library → Lessons** or with the Prev/Next links on a lesson.

### Scheduling options

- **Single server (default):** `ENABLE_INTERNAL_SCHEDULER=true`. The tick runs inside `next start` (`src/instrumentation.ts`).
- **Separate worker:** set `ENABLE_INTERNAL_SCHEDULER=false` and run `npm run worker`.
- **External cron:** call `GET /api/cron/daily` with `Authorization: Bearer $CRON_SECRET` every 5–15 minutes. `vercel.json` already does this on Vercel. With Supabase, use `pg_cron` + `pg_net`:

  ```sql
  select cron.schedule('dailyspeak', '*/10 * * * *', $$
    select net.http_get('https://YOUR_APP/api/cron/daily', headers := '{"Authorization":"Bearer YOUR_CRON_SECRET"}'::jsonb)
  $$);
  ```

## Verification

```bash
npm run verify
```

This runs 24 end-to-end checks against the real database and scheduler code:

- local-timezone lesson dates
- the fallback lesson when no AI key is set
- no duplicates under concurrent calls
- notifications sent only after the preferred time, and only once
- a real encrypted Web Push delivered to a local HTTPS endpoint
- email, and the exact in-app message
- next-day lessons that avoid repeated words and scenarios
- SM-2 review scheduling
- grammar and pronunciation feedback
- the AI path against a mock OpenAI server: de-duplication of repeated words, invalid output falling back after a retry, and an unreachable API falling back

## Project layout

```
db/schema.sql                 tables (users, profiles, lessons, learning_items, speech_attempts, push_subscriptions, notifications, job_runs)
src/lib/lessons/              context (personalisation), generate (AI + fallback), service (ensureLesson, progress, stats), fallback-bank
src/lib/scheduler/daily.ts    daily tick + internal scheduler
src/lib/notify/               push / email / in-app
src/lib/ai/                   OpenAI client, speaking feedback, conversation partner
src/lib/review.ts             spaced repetition + quiz builder
src/app/(app)/                dashboard, lesson/[date], practice, review, vocabulary, phrases, history, progress, settings
scripts/                      migrate, vapid, worker, cron:once, verify
```

## Notes

- Authentication is built in: email and password with scrypt hashing and HTTP-only session cookies stored in Postgres. To use Supabase Auth instead, replace `src/lib/auth.ts`. The rest of the app only uses `getCurrentUser()` and `requireUser()`.
- Pronunciation feedback compares the sentence you were asked to read with what speech recognition heard. Words that weren't recognised are flagged for practice.
- Live speech-to-text in the browser works best in Chrome and Edge. Other browsers record audio and use server-side Whisper when a key is set; otherwise the user can type.
- For a large number of users, move generation into a job queue so lessons are generated in parallel.
