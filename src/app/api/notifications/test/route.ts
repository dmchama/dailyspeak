import { json, withUser } from "@/lib/api";
import { buildMessage, sendEmail, sendPush } from "@/lib/notify";
import { localMinutes } from "@/lib/time";

/** Sends a test notification on the user's enabled channels so they can confirm delivery. */
export const POST = withUser(async (user, profile) => {
  const msg = buildMessage(localMinutes(profile?.timezone ?? "UTC"));
  const url = `${(process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "")}/dashboard`;
  const results: Record<string, { status: string; detail: string }> = {};
  if (profile?.notify_push !== false) results.push = await sendPush(user.id, { title: `[Test] ${msg.title}`, body: msg.body, url });
  if (profile?.notify_email !== false) {
    try {
      results.email = await sendEmail(user.email, `[Test] ${msg.title}`, msg.body, `<p>${msg.body}</p><p><a href="${url}">Open DailySpeak</a></p>`);
    } catch (e) {
      results.email = { status: "failed", detail: (e as Error).message };
    }
  }
  return json({ results });
});
