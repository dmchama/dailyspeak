import { z } from "zod";
import { query } from "@/lib/db";
import { error, json, withUser } from "@/lib/api";
import { partnerReply } from "@/lib/ai/partner";
import { basicFeedback } from "@/lib/ai/feedback";

const Body = z.object({
  scenario: z.string(),
  history: z.array(z.object({ role: z.enum(["partner", "learner"]), text: z.string().max(2000) })).min(1).max(40),
});

export const POST = withUser(async (user, profile, req) => {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success || !profile) return error("Invalid request");
  const { scenario, history } = parsed.data;
  let out;
  try {
    out = await partnerReply(profile, scenario, history);
  } catch (e) {
    console.warn("[partner] AI failed, using scripted partner", (e as Error).message);
    out = await partnerReply({ ...profile }, scenario, history).catch(() => ({ reply: "Sorry, could you say that again?", quickTip: "", corrected: "", engine: "basic" as const }));
  }
  const last = [...history].reverse().find((m) => m.role === "learner");
  if (last) {
    const fb = basicFeedback(last.text);
    await query(
      "INSERT INTO speech_attempts (user_id, mode, prompt, transcript, feedback, score) VALUES ($1,'partner',$2,$3,$4,$5)",
      [user.id, scenario, last.text, JSON.stringify({ ...fb, natural: out.corrected || fb.natural }), fb.score],
    );
  }
  return json(out);
});
