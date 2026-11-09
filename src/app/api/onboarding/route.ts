import { after } from "next/server";
import { query } from "@/lib/db";
import { error, json, withUser } from "@/lib/api";
import { ProfileInput } from "@/lib/profile-schema";
import { ensureTodaysLesson } from "@/lib/lessons/service";

export const maxDuration = 120;

/** Saves the onboarding profile (also used by Settings) and starts generating today's lesson. */
export const POST = withUser(async (user, _profile, req) => {
  const parsed = ProfileInput.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return error(parsed.error.issues[0].message);
  const p = parsed.data;
  await query(
    `INSERT INTO profiles (user_id, profession, domain, level, goal, explanation_language, daily_minutes, preferred_time, timezone, interests, notify_push, notify_email, onboarded, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,true,now())
     ON CONFLICT (user_id) DO UPDATE SET profession=$2, domain=$3, level=$4, goal=$5, explanation_language=$6, daily_minutes=$7,
       preferred_time=$8, timezone=$9, interests=$10, notify_push=$11, notify_email=$12, onboarded=true, updated_at=now()`,
    [user.id, p.profession, p.domain, p.level, p.goal, p.explanation_language, p.daily_minutes, p.preferred_time, p.timezone, p.interests, p.notify_push, p.notify_email],
  );
  // Generate today's lesson after the response is sent. `after()` keeps the function alive on
  // serverless platforms (Vercel), where a plain un-awaited promise could be frozen mid-generation.
  after(() => ensureTodaysLesson(user.id).catch((e) => console.error("[onboarding] lesson generation failed", e)));
  return json({ ok: true });
});
