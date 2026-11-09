-- DailySpeak schema (PostgreSQL / Supabase compatible). Idempotent.

CREATE TABLE IF NOT EXISTS users (
  id            BIGSERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS profiles (
  user_id               BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  profession            TEXT NOT NULL DEFAULT 'Software Engineer',
  domain                TEXT NOT NULL DEFAULT 'software_development',
  level                 TEXT NOT NULL DEFAULT 'beginner',  -- beginner | elementary | intermediate | upper_intermediate
  goal                  TEXT NOT NULL DEFAULT 'Speak confidently in meetings',
  explanation_language  TEXT NOT NULL DEFAULT 'english',   -- english | english_sinhala
  daily_minutes         INT  NOT NULL DEFAULT 15,
  preferred_time        TEXT NOT NULL DEFAULT '08:00',     -- HH:MM in user's local time
  timezone              TEXT NOT NULL DEFAULT 'Asia/Colombo',
  interests             TEXT[] NOT NULL DEFAULT '{}',
  notify_push           BOOLEAN NOT NULL DEFAULT true,
  notify_email          BOOLEAN NOT NULL DEFAULT true,
  onboarded             BOOLEAN NOT NULL DEFAULT false,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One lesson per user per local date (guarantees no duplicates).
CREATE TABLE IF NOT EXISTS lessons (
  id           BIGSERIAL PRIMARY KEY,
  user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_date  DATE NOT NULL,
  status       TEXT NOT NULL DEFAULT 'generating',  -- generating | ready | failed
  source       TEXT,                                -- ai | fallback
  content      JSONB,
  progress     JSONB NOT NULL DEFAULT '{}'::jsonb,  -- { words: true, phrases: true, ... }
  completed_at TIMESTAMPTZ,
  error        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, lesson_date)
);

-- Words & phrases delivered to a user, with spaced-repetition (SM-2) state.
CREATE TABLE IF NOT EXISTS learning_items (
  id            BIGSERIAL PRIMARY KEY,
  user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id     BIGINT REFERENCES lessons(id) ON DELETE SET NULL,
  kind          TEXT NOT NULL,       -- word | phrase
  text          TEXT NOT NULL,
  norm_text     TEXT NOT NULL,
  data          JSONB NOT NULL,
  learned_at    TIMESTAMPTZ,
  ease          REAL NOT NULL DEFAULT 2.5,
  interval_days INT  NOT NULL DEFAULT 0,
  repetitions   INT  NOT NULL DEFAULT 0,
  due_date      DATE,
  correct_count INT  NOT NULL DEFAULT 0,
  wrong_count   INT  NOT NULL DEFAULT 0,
  last_reviewed TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind, norm_text)
);
CREATE INDEX IF NOT EXISTS learning_items_due_idx ON learning_items (user_id, due_date);

-- Every spoken/typed practice attempt and the feedback returned.
CREATE TABLE IF NOT EXISTS speech_attempts (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id   BIGINT REFERENCES lessons(id) ON DELETE SET NULL,
  mode        TEXT NOT NULL,        -- read_aloud | answer | challenge | partner
  prompt      TEXT,
  transcript  TEXT NOT NULL,
  feedback    JSONB NOT NULL,
  score       INT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL UNIQUE,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Log of daily notifications; unique per user/date/channel so nobody is notified twice.
CREATE TABLE IF NOT EXISTS notifications (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_date DATE NOT NULL,
  channel     TEXT NOT NULL,        -- in_app | push | email
  status      TEXT NOT NULL,        -- sent | skipped | failed
  detail      TEXT,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, lesson_date, channel)
);

CREATE TABLE IF NOT EXISTS job_runs (
  id          BIGSERIAL PRIMARY KEY,
  job         TEXT NOT NULL,
  started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  summary     JSONB
);
