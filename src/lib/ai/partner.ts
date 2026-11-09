import { z } from "zod";
import { aiEnabled, chatJSON } from "./openai";
import { basicFeedback } from "./feedback";
import type { Profile } from "../types";

export type PartnerMessage = { role: "partner" | "learner"; text: string };

export const PARTNER_SCENARIOS = [
  { id: "standup", title: "Daily stand-up", role: "your Scrum Master", opener: "Good morning! Let's start the stand-up. What did you work on yesterday?", followUps: ["Great. What are you planning to work on today?", "Do you have any blockers?", "How long do you think it will take to finish?", "Thanks! Is there anything you need from the team?"] },
  { id: "bug", title: "Discussing a bug with QA", role: "a QA engineer", opener: "Hi! I found a bug on the checkout page – the total price is wrong when a coupon is used. Can you take a look?", followUps: ["Do you need the steps to reproduce it?", "When do you think the fix will be ready?", "Should I test anything else after the fix?", "Thanks! Can you tell me when it's deployed to the test server?"] },
  { id: "interview", title: "Job interview", role: "an interviewer at a software company", opener: "Thanks for coming in today. Could you start by telling me a little about yourself?", followUps: ["What project are you most proud of, and why?", "Tell me about a difficult problem you solved.", "How do you handle tight deadlines?", "Do you have any questions for us?"] },
  { id: "client", title: "Client update", role: "a client from Australia", opener: "Hi! Thanks for the call. How is the project going this week?", followUps: ["Are there any risks we should know about?", "When can we see a demo?", "Can we add one small feature to this release?", "Great, what are the next steps?"] },
  { id: "smalltalk", title: "Small talk with a colleague", role: "a friendly colleague", opener: "Hey! How was your weekend?", followUps: ["That sounds nice! Do you have any hobbies?", "Have you watched any good movies or series lately?", "What do you usually do after work?", "Any plans for the next holiday?"] },
  { id: "restaurant", title: "Ordering at a restaurant", role: "a waiter", opener: "Good evening! Welcome. Are you ready to order, or do you need a few minutes?", followUps: ["Would you like anything to drink?", "How would you like it – spicy or mild?", "Would you like a dessert?", "Is everything okay with your meal?"] },
] as const;

const ReplySchema = z.object({
  reply: z.string().min(1),
  quickTip: z.string().default(""),
  corrected: z.string().default(""),
});

/** Produce the partner's next turn plus a short correction of the learner's last message. */
export async function partnerReply(profile: Profile, scenarioId: string, history: PartnerMessage[]) {
  const scenario = PARTNER_SCENARIOS.find((s) => s.id === scenarioId) ?? PARTNER_SCENARIOS[0];
  const last = [...history].reverse().find((m) => m.role === "learner")?.text ?? "";

  if (!aiEnabled()) {
    const learnerTurns = history.filter((m) => m.role === "learner").length;
    const fb = basicFeedback(last);
    const reply = scenario.followUps[(learnerTurns - 1) % scenario.followUps.length] ?? "Thanks, that was a great conversation!";
    return {
      reply: learnerTurns > scenario.followUps.length ? "That was a great conversation! You did really well today. 🎉" : `${["Okay, thanks.", "I see.", "Got it.", "Nice."][learnerTurns % 4]} ${reply}`,
      quickTip: fb.grammar[0] ? `${fb.grammar[0].explanation}` : "",
      corrected: fb.grammar.length ? fb.corrected : "",
      engine: "basic" as const,
    };
  }

  const out = await chatJSON(
    [
      {
        role: "system",
        content: `You are ${scenario.role} in a role-play called "${scenario.title}" with an English learner who is a ${profile.profession} (${profile.level} level).
Stay in character. Reply in 1–3 short, natural sentences and always end with a question so the learner keeps speaking.
Use simple, natural English. Be warm and encouraging.
Also give feedback on the learner's LAST message only: "corrected" = a more natural version if it had mistakes (else empty), "quickTip" = one short friendly tip (else empty).
Return JSON: {"reply": string, "quickTip": string, "corrected": string}`,
      },
      ...history.map((m) => ({ role: m.role === "partner" ? ("assistant" as const) : ("user" as const), content: m.text })),
    ],
    ReplySchema,
    { temperature: 0.7 },
  );
  return { ...out, engine: "ai" as const };
}
