import { error, json, withUser } from "@/lib/api";
import { markSection } from "@/lib/lessons/service";
import { SECTIONS, type SectionId } from "@/lib/types";

export const POST = withUser(async (user, _p, req, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const { section } = (await req.json().catch(() => ({}))) as { section?: string };
  if (!SECTIONS.some((s) => s.id === section)) return error("Unknown section");
  const lesson = await markSection(user.id, Number(id), section as SectionId);
  if (!lesson) return error("Lesson not found", 404);
  return json({ progress: lesson.progress, completed: Boolean(lesson.completed_at) });
});
