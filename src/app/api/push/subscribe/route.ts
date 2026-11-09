import { query } from "@/lib/db";
import { error, json, withUser } from "@/lib/api";

export async function GET() {
  return json({ publicKey: process.env.VAPID_PUBLIC_KEY || null });
}

export const POST = withUser(async (user, _p, req) => {
  const sub = (await req.json().catch(() => ({}))) as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  if (!sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) return error("Invalid subscription");
  await query(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES ($1,$2,$3,$4)
     ON CONFLICT (endpoint) DO UPDATE SET user_id=$1, p256dh=$3, auth=$4`,
    [user.id, sub.endpoint, sub.keys.p256dh, sub.keys.auth],
  );
  return json({ ok: true });
});

export const DELETE = withUser(async (user, _p, req) => {
  const { endpoint } = (await req.json().catch(() => ({}))) as { endpoint?: string };
  await query("DELETE FROM push_subscriptions WHERE user_id=$1 AND endpoint=$2", [user.id, endpoint ?? ""]);
  return json({ ok: true });
});
