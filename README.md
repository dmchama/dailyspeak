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
- **External cron:** call `GET /api/cron/daily` with `Authorization: Bearer $CRON_SECRET` every 5–15 minutes. `db/supabase-cron.sql` sets this up with Supabase `pg_cron` + `pg_net`.

## Deploying to Vercel (Hobby) + Supabase

Supabase is used only as the Postgres database (the app has its own login). Supabase also runs the scheduler, because Vercel Hobby cron jobs can only run once a day.

1. **Supabase:** create a project. Under **Connect → Session pooler**, copy the connection string. Don't use the direct connection (Vercel can't reach it) or the transaction pooler (the scheduler's advisory lock needs session mode). Create the tables by pasting `db/schema.sql` into the SQL Editor, or run `DATABASE_URL="…" npm run db:migrate`.
2. **Vercel:** import the GitHub repo (Next.js preset, no changes). Keep **Fluid compute** on (the default for new projects; under Settings → Functions). Without it, functions are cut off well before the job's time budget.
3. **Environment variables** (Project → Settings → Environment Variables), then redeploy:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | Supabase session pooler string |
   | `APP_URL` | `https://your-app.vercel.app` |
   | `CRON_SECRET` | output of `openssl rand -hex 32` |
   | `ENABLE_INTERNAL_SCHEDULER` | `false` |
   | `OPENAI_API_KEY`, `OPENAI_MODEL` | optional; without a key the curated lesson bank is used |
   | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | from `npm run vapid`; keep them fixed once users subscribe |
   | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` | from your email provider (Resend, Brevo, SendGrid…); without them emails are skipped |

4. **Scheduler:** in Supabase, enable the `pg_cron` and `pg_net` extensions, put your URL and `CRON_SECRET` into `db/supabase-cron.sql`, and run it in the SQL Editor. It calls the job every 10 minutes.
5. **Check:** `curl -H "Authorization: Bearer $CRON_SECRET" https://your-app.vercel.app/api/cron/daily` should return a JSON summary (`401` means the secret doesn't match). Then sign up, finish onboarding, and use **Settings → Send test notification**.

Each run stops *starting* new lesson generations after `CRON_TIME_BUDGET_SECONDS` (default 200 s, inside Vercel's 300 s limit). It still sends reminders for lessons that already exist, and reports the rest as `deferred`; the next run picks them up. New users don't wait for the scheduler: their first lesson is generated right after onboarding.

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
- For a large number of users, move generation into a job queue so lessons are generated in parallel. Today each run generates lessons one at a time, roughly 10–30 s each with AI.
