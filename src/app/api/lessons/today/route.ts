import { error, json, withUser } from "@/lib/api";
import { ensureTodaysLesson } from "@/lib/lessons/service";

/** Returns today's lesson, generating it on demand if the scheduler hasn't created it yet. */
export const POST = withUser(async (user, profile) => {
  if (!profile?.onboarded) return error("Please finish onboarding first", 409);
  const lesson = await ensureTodaysLesson(user.id);
  return json({ lesson });
});
export const GET = POST;
