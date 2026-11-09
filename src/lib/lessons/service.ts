import { query, queryOne } from "../db";
import { addDays, localDate, toIsoDate } from "../time";
import { SECTIONS, type LessonContent, type LessonRow, type SectionId } from "../types";
import { buildLearnerContext, getProfile, normalize } from "./context";
import { buildFallbackLesson, generateLessonWithAI } from "./generate";

type RawLesson = Omit<LessonRow, "id" | "user_id" | "lesson_date"> & { id: string; user_id: string; lesson_date: Date | string; created_at: Date };

const toLesson = (r: RawLesson): LessonRow => ({
  ...r,
  id: Number(r.id),
  user_id: Number(r.user_id),
  lesson_date: toIsoDate(r.lesson_date),
});

export async function getLesson(userId: number, lessonDate: string): Promise<LessonRow | null> {
  const r = await queryOne<RawLesson>("SELECT * FROM lessons WHERE user_id=$1 AND lesson_date=$2", [userId, lessonDate]);
  return r ? toLesson(r) : null;
}

export type EnsureResult = { lesson: LessonRow; created: boolean };

/**
 * Idempotently make sure the user has a lesson for `lessonDate`.
 * The UNIQUE(user_id, lesson_date) constraint + a "generating" claim row guarantee that
 * concurrent callers (scheduler, page load, cron endpoint) never create duplicates.
 */
export async function ensureLesson(userId: number, lessonDate: string): Promise<EnsureResult> {
  const claimed = await queryOne<{ id: string }>(
    `INSERT INTO lessons (user_id, lesson_date, status) VALUES ($1,$2,'generating')
     ON CONFLICT (user_id, lesson_date) DO NOTHING RETURNING id`,
    [userId, lessonDate],
  );

  let lessonId: number | null = claimed ? Number(claimed.id) : null;
  if (!lessonId) {
    // Someone else owns it. Take over only if it failed or a generator crashed (stale claim).
    const takeover = await queryOne<{ id: string }>(
      `UPDATE lessons SET status='generating', created_at=now(), error=NULL
       WHERE user_id=$1 AND lesson_date=$2
         AND (status='failed' OR (status='generating' AND created_at < now() - interval '5 minutes'))
       RETURNING id`,
      [userId, lessonDate],
    );
    if (!takeover) {
      const existing = await getLesson(userId, lessonDate);
      if (existing?.status === "generating") return { lesson: await waitForLesson(userId, lessonDate), created: false };
      return { lesson: existing!, created: false };
    }
    lessonId = Number(takeover.id);
  }

  try {
    const ctx = await buildLearnerContext(userId, lessonDate);
    let content: LessonContent;
    let source: "ai" | "fallback" = "ai";
    let error: string | null = null;
    try {
      content = await generateLessonWithAI(ctx);
    } catch (e) {
      source = "fallback";
      error = (e as Error).message;
      content = buildFallbackLesson(ctx);
    }
    await query(`UPDATE lessons SET status='ready', source=$2, content=$3, error=$4 WHERE id=$1`, [lessonId, source, JSON.stringify(content), error]);
    await recordItems(userId, lessonId, content);
    if (source === "fallback") console.info(`[lessons] user=${userId} date=${lessonDate} used fallback (${error})`);
  } catch (e) {
    await query(`UPDATE lessons SET status='failed', error=$2 WHERE id=$1`, [lessonId, (e as Error).message]);
    throw e;
  }
  return { lesson: (await getLesson(userId, lessonDate))!, created: true };
}

async function waitForLesson(userId: number, lessonDate: string): Promise<LessonRow> {
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const l = await getLesson(userId, lessonDate);
    if (l && l.status !== "generating") return l;
  }
  return (await getLesson(userId, lessonDate))!;
}

async function recordItems(userId: number, lessonId: number, content: LessonContent) {
  const rows: [string, string, string, object][] = [
    ...content.words.map((w) => ["word", w.word, normalize(w.word), w] as [string, string, string, object]),
    ...content.phrases.map((p) => ["phrase", p.phrase, normalize(p.phrase), p] as [string, string, string, object]),
  ];
  for (const [kind, text, norm, data] of rows) {
    await query(
      `INSERT INTO learning_items (user_id, lesson_id, kind, text, norm_text, data) VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (user_id, kind, norm_text) DO UPDATE SET lesson_id = EXCLUDED.lesson_id, data = EXCLUDED.data
       WHERE learning_items.learned_at IS NULL`,
      [userId, lessonId, kind, text, norm, JSON.stringify(data)],
    );
  }
}

/** Today's lesson for a user in their own timezone (creating it on demand if the scheduler hasn't yet). */
export async function ensureTodaysLesson(userId: number): Promise<LessonRow> {
  const profile = await getProfile(userId);
  const today = localDate(profile?.timezone ?? "UTC");
  return (await ensureLesson(userId, today)).lesson;
}

export async function markSection(userId: number, lessonId: number, section: SectionId): Promise<LessonRow | null> {
  const lesson = await queryOne<RawLesson>(
    `UPDATE lessons SET progress = progress || jsonb_build_object($3::text, true)
     WHERE id=$1 AND user_id=$2 AND status='ready' RETURNING *`,
    [lessonId, userId, section],
  );
  if (!lesson) return null;
  const l = toLesson(lesson);
  const profile = await getProfile(userId);
  const today = localDate(profile?.timezone ?? "UTC");

  if (section === "words" || section === "phrases") {
    // Learned items enter spaced repetition: first review tomorrow.
    await query(
      `UPDATE learning_items SET learned_at = COALESCE(learned_at, now()), due_date = COALESCE(due_date, $3::date)
       WHERE user_id=$1 AND lesson_id=$2 AND kind=$4`,
      [userId, lessonId, addDays(today, 1), section === "words" ? "word" : "phrase"],
    );
  }
  const allDone = SECTIONS.every((s) => l.progress[s.id]);
  if (allDone && !l.completed_at) {
    await query("UPDATE lessons SET completed_at=now() WHERE id=$1", [lessonId]);
    l.completed_at = new Date().toISOString();
  }
  return l;
}

export async function listLessons(userId: number, limit = 60) {
  const rows = await query<RawLesson>(
    "SELECT * FROM lessons WHERE user_id=$1 AND status='ready' ORDER BY lesson_date DESC LIMIT $2",
    [userId, limit],
  );
  return rows.map(toLesson);
}

export async function getStats(userId: number, timezone: string) {
  const [counts, days] = await Promise.all([
    queryOne<{ words: string; phrases: string; lessons: string; completed: string; attempts: string; avg_score: string | null; due: string }>(
      `SELECT
        (SELECT count(*) FROM learning_items WHERE user_id=$1 AND kind='word' AND learned_at IS NOT NULL) AS words,
        (SELECT count(*) FROM learning_items WHERE user_id=$1 AND kind='phrase' AND learned_at IS NOT NULL) AS phrases,
        (SELECT count(*) FROM lessons WHERE user_id=$1 AND status='ready') AS lessons,
        (SELECT count(*) FROM lessons WHERE user_id=$1 AND completed_at IS NOT NULL) AS completed,
        (SELECT count(*) FROM speech_attempts WHERE user_id=$1) AS attempts,
        (SELECT round(avg(score)) FROM speech_attempts WHERE user_id=$1 AND score IS NOT NULL) AS avg_score,
        (SELECT count(*) FROM learning_items WHERE user_id=$1 AND learned_at IS NOT NULL AND due_date <= $2::date) AS due`,
      [userId, localDate(timezone)],
    ),
    query<{ d: Date | string }>(
      `SELECT DISTINCT lesson_date AS d FROM lessons WHERE user_id=$1 AND completed_at IS NOT NULL ORDER BY d DESC LIMIT 400`,
      [userId],
    ),
  ]);
  const completedDates = new Set(days.map((r) => toIsoDate(r.d)));
  const today = localDate(timezone);
  let streak = 0;
  let cursor = completedDates.has(today) ? today : addDays(today, -1); // today not done yet doesn't break the streak
  while (completedDates.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of [...completedDates].sort()) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return {
    words: Number(counts?.words ?? 0),
    phrases: Number(counts?.phrases ?? 0),
    lessons: Number(counts?.lessons ?? 0),
    completed: Number(counts?.completed ?? 0),
    attempts: Number(counts?.attempts ?? 0),
    avgScore: counts?.avg_score ? Number(counts.avg_score) : null,
    due: Number(counts?.due ?? 0),
    streak,
    bestStreak: best,
    completedDates: [...completedDates],
  };
}
