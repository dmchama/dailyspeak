import { z } from "zod";
import { createSession, hashPassword } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { error, json } from "@/lib/api";

const Body = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return error(parsed.error.issues[0].message);
  const { name, email, password } = parsed.data;
  const exists = await queryOne("SELECT 1 FROM users WHERE email=$1", [email]);
  if (exists) return error("An account with this email already exists. Please sign in.", 409);
  const user = await queryOne<{ id: string }>(
    "INSERT INTO users (email, password_hash, name) VALUES ($1,$2,$3) RETURNING id",
    [email, await hashPassword(password), name],
  );
  await query("INSERT INTO profiles (user_id) VALUES ($1)", [user!.id]);
  await createSession(Number(user!.id));
  return json({ ok: true, next: "/onboarding" });
}
