import { timingSafeEqual } from "node:crypto";
import { error, json } from "@/lib/api";
import { runDailyTick } from "@/lib/scheduler/daily";

export const dynamic = "force-dynamic";
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
  const summary = await runDailyTick();
  return json(summary);
}
export const GET = handler;
export const POST = handler;
