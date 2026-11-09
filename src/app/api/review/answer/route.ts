import { error, json, withUser } from "@/lib/api";
import { recordReview } from "@/lib/review";

export const POST = withUser(async (user, profile, req) => {
  const { itemId, correct } = (await req.json().catch(() => ({}))) as { itemId?: number; correct?: boolean };
  if (!itemId || typeof correct !== "boolean") return error("itemId and correct are required");
  const r = await recordReview(user.id, itemId, correct, profile?.timezone ?? "UTC");
  if (!r) return error("Item not found", 404);
  return json(r);
});
