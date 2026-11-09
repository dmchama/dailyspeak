import { createSession, verifyPassword } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { error, json } from "@/lib/api";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { email?: string; password?: string };
  const email = String(body.email ?? "").trim().toLowerCase();
  const user = await queryOne<{ id: string; password_hash: string; onboarded: boolean | null }>(
    "SELECT u.id, u.password_hash, p.onboarded FROM users u LEFT JOIN profiles p ON p.user_id=u.id WHERE u.email=$1",
    [email],
  );
  if (!user || !(await verifyPassword(String(body.password ?? ""), user.password_hash))) {
    return error("Email or password is incorrect.", 401);
  }
  await createSession(Number(user.id));
  return json({ ok: true, next: user.onboarded ? "/dashboard" : "/onboarding" });
}
