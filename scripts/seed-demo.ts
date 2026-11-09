// Creates a demo account with a week of realistic history (streak, learned words, speaking scores,
// items due for review) so the app can be shown without waiting for real days to pass.
//   npm run seed:demo      →  demo@dailyspeak.app / demo1234
import "dotenv/config";
import { getPool, query, queryOne } from "../src/lib/db";
import { hashPassword } from "../src/lib/auth-hash";
import { ensureLesson, markSection } from "../src/lib/lessons/service";
import { getFeedback } from "../src/lib/ai/feedback";
import { addDays, localDate } from "../src/lib/time";
import { SECTIONS } from "../src/lib/types";

const EMAIL = "demo@dailyspeak.app";
const TZ = "Asia/Colombo";

const ANSWERS = [
  "yesterday i fixed the login bug and today i am working on the payment api",
  "i did finished the report and i will discuss about it with my lead today morning",
  "I'm stuck on a CORS error, could you give me a hand after the stand-up?",
  "we deployed the new version yesterday night and it is working fine",
  "I'll look into the production issue and get back to you by the end of the day",
  "the client want a new requirement so we need to estimate it again",
  "Just to clarify, should the report include cancelled orders?",
];

async function main() {
  await query("DELETE FROM users WHERE email=$1", [EMAIL]);
  const u = await queryOne<{ id: string }>("INSERT INTO users (email, password_hash, name) VALUES ($1,$2,$3) RETURNING id", [EMAIL, await hashPassword("demo1234"), "Sampath Perera"]);
  const id = Number(u!.id);
  await query(
    `INSERT INTO profiles (user_id, profession, domain, level, goal, explanation_language, daily_minutes, preferred_time, timezone, interests, notify_push, notify_email, onboarded)
     VALUES ($1,'Software Engineer','software_development','elementary','Speak confidently in meetings','english_sinhala',15,'08:00',$2,'{Cricket,Travel,Technology news}',true,true,true)`,
    [id, TZ],
  );

  const today = localDate(TZ);
  // Six completed days before today → 6-day streak.
  for (let i = 6; i >= 1; i--) {
    const date = addDays(today, -i);
    const { lesson } = await ensureLesson(id, date);
    for (const s of SECTIONS) await markSection(id, lesson.id, s.id);
    const fb = await getFeedback({ text: ANSWERS[6 - i], mode: "answer", level: "elementary", profession: "Software Engineer" });
    await query(
      `INSERT INTO speech_attempts (user_id, lesson_id, mode, prompt, transcript, feedback, score, created_at)
       VALUES ($1,$2,'answer','Daily practice',$3,$4,$5, ($6::date + time '19:00') AT TIME ZONE $7)`,
      [id, lesson.id, ANSWERS[6 - i], JSON.stringify(fb), Math.min(98, fb.score + (6 - i) * 3), date, TZ],
    );
    await query("UPDATE lessons SET completed_at = ($2::date + time '20:00') AT TIME ZONE $3 WHERE id=$1", [lesson.id, date, TZ]);
  }

  // Today: lesson ready, words done, the rest left to show live.
  const { lesson } = await ensureLesson(id, today);
  await markSection(id, lesson.id, "words");

  // Put earlier items into today's review queue.
  await query(
    `UPDATE learning_items SET due_date=$2 WHERE id IN (
       SELECT id FROM learning_items WHERE user_id=$1 AND learned_at IS NOT NULL AND lesson_id <> $3 ORDER BY random() LIMIT 8)`,
    [id, today, lesson.id],
  );
  // A friendly in-app reminder for today.
  await query(
    `INSERT INTO notifications (user_id, lesson_date, channel, status, detail) VALUES ($1,$2,'in_app','sent',$3)`,
    [id, today, "Good morning! Your new English practice lesson is ready. Learn 5 new words, 5 useful phrases, and practise today's conversations."],
  );
  console.log(`✔ Demo account ready: ${EMAIL} / demo1234 (6-day streak, today's lesson in progress, 8 items due for review)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => getPool().end());
