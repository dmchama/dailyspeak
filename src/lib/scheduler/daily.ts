import { query, withClient } from "../db";
import { ensureLesson } from "../lessons/service";
import { sendDailyNotifications } from "../notify";
import { hhmmToMinutes, localDate, localMinutes } from "../time";
import type { Profile } from "../types";

const LOCK_KEY = 4_242_001; // pg advisory lock id: only one scheduler instance runs a tick at a time

export type TickSummary = {
  at: string;
  users: number;
  generated: number;
  notified: number;
  skippedLocked?: boolean;
  errors: string[];
};

/**
 * One scheduler tick. Safe to run as often as you like (idempotent):
 *  1. For every onboarded user, compute "today" in THEIR timezone and make sure the lesson exists
 *     (lessons are pre-generated as soon as the local day starts, so they're ready before the reminder).
 *  2. Once the user's local time reaches their preferred learning time, send notifications once.
 */
export async function runDailyTick(now: Date = new Date()): Promise<TickSummary> {
  return withClient(async (client) => {
    const lock = await client.query<{ ok: boolean }>("SELECT pg_try_advisory_lock($1) AS ok", [LOCK_KEY]);
    if (!lock.rows[0].ok) return { at: now.toISOString(), users: 0, generated: 0, notified: 0, skippedLocked: true, errors: [] };
    const run = await client.query<{ id: string }>("INSERT INTO job_runs (job) VALUES ('daily_tick') RETURNING id");
    const summary: TickSummary = { at: now.toISOString(), users: 0, generated: 0, notified: 0, errors: [] };
    try {
      const users = await query<Profile & { id: string; email: string; name: string }>(
        `SELECT u.id, u.email, u.name, p.* FROM users u JOIN profiles p ON p.user_id=u.id WHERE p.onboarded`,
      );
      summary.users = users.length;
      for (const u of users) {
        const userId = Number(u.id);
        try {
          const date = localDate(u.timezone, now);
          const { lesson, created } = await ensureLesson(userId, date);
          if (created) summary.generated++;
          const mins = localMinutes(u.timezone, now);
          if (lesson.status === "ready" && mins >= hhmmToMinutes(u.preferred_time)) {
            const sent = await sendDailyNotifications({ id: userId, email: u.email, name: u.name }, { ...u, user_id: userId }, date, mins, lesson.content);
            if (Object.keys(sent).length) summary.notified++;
          }
        } catch (e) {
          summary.errors.push(`user ${userId}: ${(e as Error).message}`);
        }
      }
    } finally {
      await client.query("UPDATE job_runs SET finished_at=now(), summary=$2 WHERE id=$1", [run.rows[0].id, JSON.stringify(summary)]);
      await client.query("SELECT pg_advisory_unlock($1)", [LOCK_KEY]);
    }
    return summary;
  });
}

declare global {
  // eslint-disable-next-line no-var
  var __dailyspeakScheduler: NodeJS.Timeout | undefined;
}

/** In-process scheduler started from instrumentation.ts (disable with ENABLE_INTERNAL_SCHEDULER=false). */
export function startInternalScheduler() {
  if (globalThis.__dailyspeakScheduler) return;
  const minutes = Math.max(1, Number(process.env.SCHEDULER_INTERVAL_MINUTES || 5));
  const tick = () =>
    runDailyTick()
      .then((s) => {
        if (s.generated || s.notified || s.errors.length) console.info("[scheduler]", JSON.stringify(s));
      })
      .catch((e) => console.error("[scheduler] tick failed", e));
  setTimeout(tick, 5_000);
  globalThis.__dailyspeakScheduler = setInterval(tick, minutes * 60_000);
  console.info(`[scheduler] internal daily-lesson scheduler running every ${minutes} min`);
}
