import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import nodemailer from "nodemailer";
import webpush from "web-push";
import { query, queryOne } from "../db";
import type { LessonContent, Profile } from "../types";

export const DAILY_MESSAGE =
  "Good morning! Your new English practice lesson is ready. Learn 5 new words, 5 useful phrases, and practise today's conversations.";

const appUrl = () => (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");

export function pushConfigured() {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

let vapidSet = false;
function ensureVapid() {
  if (!vapidSet && pushConfigured()) {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@example.com", process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
    vapidSet = true;
  }
}

function greetingFor(minutesOfDay: number) {
  if (minutesOfDay < 12 * 60) return "Good morning!";
  if (minutesOfDay < 17 * 60) return "Good afternoon!";
  return "Good evening!";
}

export function buildMessage(localMinutes: number, content?: LessonContent | null) {
  const body = DAILY_MESSAGE.replace("Good morning!", greetingFor(localMinutes));
  const preview = content ? `Today's words: ${content.words.map((w) => w.word).join(", ")}.` : "";
  return { title: "DailySpeak – your lesson is ready", body, preview };
}

export async function sendPush(userId: number, payload: { title: string; body: string; url: string }) {
  if (!pushConfigured()) return { status: "skipped" as const, detail: "VAPID keys not configured" };
  ensureVapid();
  const subs = await query<{ id: string; endpoint: string; p256dh: string; auth: string }>("SELECT * FROM push_subscriptions WHERE user_id=$1", [userId]);
  if (!subs.length) return { status: "skipped" as const, detail: "No browser subscribed" };
  let sent = 0;
  const errors: string[] = [];
  for (const s of subs) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 60 * 60 * 12 });
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await query("DELETE FROM push_subscriptions WHERE id=$1", [s.id]); // expired
      errors.push(`${code ?? ""} ${(e as Error).message}`.trim());
    }
  }
  return sent > 0 ? { status: "sent" as const, detail: `${sent}/${subs.length} devices` } : { status: "failed" as const, detail: errors.join("; ") };
}

export async function sendEmail(to: string, subject: string, text: string, html: string) {
  const from = process.env.EMAIL_FROM || "DailySpeak <no-reply@dailyspeak.app>";
  if (!process.env.SMTP_HOST) {
    // Serverless filesystems are read-only, so there's nowhere to write the outbox.
    if (process.env.VERCEL) return { status: "skipped" as const, detail: "SMTP not configured" };
    // Development mode: write the email to ./outbox so it can be inspected.
    const dir = join(process.cwd(), "outbox");
    await mkdir(dir, { recursive: true });
    const file = join(dir, `${Date.now()}-${to.replace(/[^a-z0-9]/gi, "_")}.json`);
    await writeFile(file, JSON.stringify({ from, to, subject, text, html }, null, 2));
    return { status: "sent" as const, detail: `SMTP not configured – written to outbox/${file.split("/").pop()}` };
  }
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  const info = await transport.sendMail({ from, to, subject, text, html });
  return { status: "sent" as const, detail: info.messageId };
}

function emailHtml(name: string, body: string, content: LessonContent | null | undefined, url: string) {
  const words = content?.words.map((w) => `<li><b>${w.word}</b> – ${w.definition}</li>`).join("") ?? "";
  return `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:auto;color:#0f172a">
  <h2 style="color:#4f46e5">DailySpeak</h2>
  <p>Hi ${name},</p><p>${body}</p>
  ${words ? `<p><b>Today's words</b></p><ul>${words}</ul>` : ""}
  <p><a href="${url}" style="background:#4f46e5;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Start today's practice</a></p>
  <p style="color:#64748b;font-size:12px">You can change notification settings in the app.</p></div>`;
}

/**
 * Send the daily "lesson ready" notifications on every enabled channel.
 * The UNIQUE(user_id, lesson_date, channel) row is claimed first, so a user is never notified twice.
 */
export async function sendDailyNotifications(
  user: { id: number; email: string; name: string },
  profile: Profile,
  lessonDate: string,
  localMinutes: number,
  content?: LessonContent | null,
) {
  const msg = buildMessage(localMinutes, content);
  const url = `${appUrl()}/lesson/${lessonDate}`;
  const channels: ("in_app" | "push" | "email")[] = ["in_app"];
  if (profile.notify_push) channels.push("push");
  if (profile.notify_email) channels.push("email");
  const results: Record<string, string> = {};

  for (const channel of channels) {
    const claim = await queryOne<{ id: string }>(
      `INSERT INTO notifications (user_id, lesson_date, channel, status) VALUES ($1,$2,$3,'pending')
       ON CONFLICT (user_id, lesson_date, channel) DO NOTHING RETURNING id`,
      [user.id, lessonDate, channel],
    );
    if (!claim) continue; // already handled
    let r: { status: "sent" | "skipped" | "failed"; detail: string };
    try {
      if (channel === "in_app") r = { status: "sent", detail: msg.body };
      else if (channel === "push") r = await sendPush(user.id, { title: msg.title, body: msg.body, url });
      else r = await sendEmail(user.email, msg.title, `${msg.body}\n\n${msg.preview}\n\nOpen: ${url}`, emailHtml(user.name, msg.body, content, url));
    } catch (e) {
      r = { status: "failed", detail: (e as Error).message };
    }
    await query("UPDATE notifications SET status=$2, detail=$3 WHERE id=$1", [claim.id, r.status, r.detail]);
    results[channel] = r.status;
  }
  return results;
}
