import { z } from "zod";
import { query } from "@/lib/db";
import { error, json, withUser } from "@/lib/api";
import { getFeedback } from "@/lib/ai/feedback";

const Body = z.object({
  text: z.string().trim().min(1, "Say or type something first").max(3000),
  mode: z.enum(["read_aloud", "answer", "challenge", "partner"]),
  prompt: z.string().max(1000).optional(),
  expected: z.string().max(1000).optional(),
  lessonId: z.number().int().optional(),
});

export const POST = withUser(async (user, profile, req) => {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return error(parsed.error.issues[0].message);
  const b = parsed.data;
  const feedback = await getFeedback({
    text: b.text,
    mode: b.mode,
    prompt: b.prompt,
    expected: b.mode === "read_aloud" ? b.expected : undefined,
    level: profile?.level ?? "beginner",
    profession: profile?.profession ?? "IT professional",
  });
  await query(
    "INSERT INTO speech_attempts (user_id, lesson_id, mode, prompt, transcript, feedback, score) VALUES ($1,$2,$3,$4,$5,$6,$7)",
    [user.id, b.lessonId ?? null, b.mode, b.prompt ?? b.expected ?? null, b.text, JSON.stringify(feedback), Math.round(feedback.score)],
  );
  return json({ feedback });
});
