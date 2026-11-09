import { timingSafeEqual } from "node:crypto";
import { error, json } from "@/lib/api";
import { runDailyTick } from "@/lib/scheduler/daily";

export const dynamic = "force-dynamic";
// Vercel Hobby with Fluid compute allows up to 300 s. We stop starting new lesson generations after
// CRON_TIME_BUDGET_SECONDS (default 200 s) so a run always finishes cleanly; the rest happens on the next tick.
export const maxDuration = 300;

/**
 * External scheduler entry point (Vercel Cron, Supabase pg_cron + pg_net, GitHub Actions, system cron…).
 * Call every 5–15 minutes with:  Authorization: Bearer $CRON_SECRET
 */
async function handler(req: Request) {
  const secret = process.env.CRON_SECRET;
  const given = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!secret || given.length !== secret.length || !timingSafeEqual(Buffer.from(given), Buffer.from(secret))) {
    return error("Unauthorized", 401);
  }
  const budgetMs = Number(process.env.CRON_TIME_BUDGET_SECONDS || 200) * 1000;
  const summary = await runDailyTick(new Date(), { budgetMs });
  return json(summary);
}
export const GET = handler;
export const POST = handler;
