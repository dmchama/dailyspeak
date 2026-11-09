import { z } from "zod";
import { DOMAINS, LEVELS } from "./types";
import { isValidTimeZone } from "./time";

export const ProfileInput = z.object({
  profession: z.string().trim().min(1).max(80),
  domain: z.enum(DOMAINS.map((d) => d.id) as [string, ...string[]]),
  level: z.enum(LEVELS.map((l) => l.id) as [string, ...string[]]),
  goal: z.string().trim().min(1).max(160),
  explanation_language: z.enum(["english", "english_sinhala"]),
  daily_minutes: z.coerce.number().int().min(5).max(60),
  preferred_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must be HH:MM"),
  timezone: z.string().refine(isValidTimeZone, "Unknown timezone"),
  interests: z.array(z.string().max(40)).max(12).default([]),
  notify_push: z.boolean().default(true),
  notify_email: z.boolean().default(true),
});
export type ProfileInputT = z.infer<typeof ProfileInput>;
