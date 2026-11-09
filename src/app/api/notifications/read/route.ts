import { query } from "@/lib/db";
import { json, withUser } from "@/lib/api";

export const POST = withUser(async (user) => {
  await query("UPDATE notifications SET read_at=now() WHERE user_id=$1 AND channel='in_app' AND read_at IS NULL", [user.id]);
  return json({ ok: true });
});
