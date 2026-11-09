/**
 * End-to-end verification of the daily lesson generation + notification workflow.
 * Runs against the real database, real scheduler code, a real Web Push request (to a local
 * push endpoint) and a mock OpenAI-compatible server for the AI path.
 *
 *   npm run verify
 */
import "dotenv/config";
import assert from "node:assert/strict";
import { createECDH, randomBytes } from "node:crypto";
import { createServer as createHttpServer, type Server } from "node:http";
import { createServer as createHttpsServer, globalAgent } from "node:https";
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getPool, query, queryOne } from "../src/lib/db";
import { hashPassword } from "../src/lib/auth-hash";
import { runDailyTick } from "../src/lib/scheduler/daily";
import { ensureLesson, getStats, markSection } from "../src/lib/lessons/service";
import { buildFallbackLesson } from "../src/lib/lessons/generate";
import { buildLearnerContext, normalize } from "../src/lib/lessons/context";
import { buildQuiz, getReviewItems, recordReview } from "../src/lib/review";
import { getFeedback } from "../src/lib/ai/feedback";
import { localDate } from "../src/lib/time";
import { SECTIONS } from "../src/lib/types";

const servers: Server[] = [];
const TEST_DOMAIN = "@verify.dailyspeak.test";
let passed = 0;
const ok = (msg: string) => { passed++; console.log(`  ✔ ${msg}`); };
const section = (t: string) => console.log(`\n▶ ${t}`);

function listen(server: Server): Promise<number> {
  servers.push(server);
  return new Promise((res) => server.listen(0, "127.0.0.1", () => res((server.address() as { port: number }).port)));
}

async function createUser(name: string, timezone: string, preferred: string, level = "beginner", lang = "english_sinhala") {
  const email = `${name.toLowerCase()}${TEST_DOMAIN}`;
  const u = await queryOne<{ id: string }>("INSERT INTO users (email, password_hash, name) VALUES ($1,$2,$3) RETURNING id", [email, await hashPassword("password123"), name]);
  const id = Number(u!.id);
  await query(
    `INSERT INTO profiles (user_id, profession, domain, level, goal, explanation_language, daily_minutes, preferred_time, timezone, interests, notify_push, notify_email, onboarded)
     VALUES ($1,'Software Engineer','software_development',$2,'Speak confidently in meetings',$3,15,$4,$5,'{Cricket}',true,true,true)`,
    [id, level, lang, preferred, timezone],
  );
  return { id, email };
}

async function cleanup() {
  await query(`DELETE FROM users WHERE email LIKE '%' || $1`, [TEST_DOMAIN]);
}

async function main() {
  await cleanup();
  const outboxBefore = safeReaddir(join(process.cwd(), "outbox")).length;
  delete process.env.OPENAI_API_KEY; // start with the no-AI / fallback path

  // ---------- Local Web Push endpoint ----------
  const pushHits: { headers: Record<string, unknown>; bytes: number }[] = [];
  // web-push only speaks HTTPS: run the fake push service with a throw-away self-signed cert,
  // trusted only by this test process.
  const certDir = mkdtempSync(join(tmpdir(), "ds-push-"));
  execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1", "-subj", "/CN=127.0.0.1",
    "-addext", "subjectAltName=IP:127.0.0.1", "-keyout", join(certDir, "key.pem"), "-out", join(certDir, "cert.pem")], { stdio: "ignore" });
  const cert = readFileSync(join(certDir, "cert.pem"));
  (globalAgent.options as { ca?: Buffer }).ca = cert;
  const pushServer = createHttpsServer({ key: readFileSync(join(certDir, "key.pem")), cert }, (req, res) => {
    let bytes = 0;
    req.on("data", (c) => (bytes += c.length));
    req.on("end", () => { pushHits.push({ headers: req.headers, bytes }); res.writeHead(201).end(); });
  });
  const pushPort = await listen(pushServer);

  section("Setup: two users in different timezones");
  // 2026-11-09 02:30 UTC  →  08:00 in Colombo (UTC+5:30), 21:30 on Nov 8 in New York (UTC-5)
  const T1 = new Date("2026-11-09T02:30:00Z");
  const colombo = await createUser("Nimal", "Asia/Colombo", "08:30");
  const newyork = await createUser("Emily", "America/New_York", "07:00", "intermediate", "english");
  const ecdh = createECDH("prime256v1"); ecdh.generateKeys();
  await query("INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES ($1,$2,$3,$4)", [
    colombo.id, `https://127.0.0.1:${pushPort}/push/nimal`, ecdh.getPublicKey().toString("base64url"), randomBytes(16).toString("base64url"),
  ]);
  ok(`created users ${colombo.email} (Asia/Colombo) and ${newyork.email} (America/New_York)`);

  section("Tick 1 – lessons are pre-generated for each user's LOCAL date, before reminder time");
  const s1 = await runDailyTick(T1);
  console.log("   summary:", JSON.stringify(s1));
  const cLesson = await queryOne<{ lesson_date: Date; status: string; source: string; content: { words: { word: string; sinhala: string }[] } }>(
    "SELECT * FROM lessons WHERE user_id=$1", [colombo.id]);
  const nLesson = await queryOne<{ lesson_date: Date; source: string; content: { words: { word: string; sinhala: string }[] } }>(
    "SELECT * FROM lessons WHERE user_id=$1", [newyork.id]);
  assert.equal(localDate("Asia/Colombo", T1), "2026-11-09");
  assert.equal(localDate("America/New_York", T1), "2026-11-08");
  assert.ok(cLesson && cLesson.status === "ready", "Colombo lesson ready");
  assert.equal(String(await queryOne<{ d: string }>("SELECT lesson_date::text d FROM lessons WHERE user_id=$1", [colombo.id]).then((r) => r!.d)), "2026-11-09");
  assert.equal(String(await queryOne<{ d: string }>("SELECT lesson_date::text d FROM lessons WHERE user_id=$1", [newyork.id]).then((r) => r!.d)), "2026-11-08");
  ok("Colombo user got a lesson for 2026-11-09, New York user for 2026-11-08 (their local dates)");
  assert.equal(cLesson!.source, "fallback");
  assert.equal(cLesson!.content.words.length, 5);
  ok(`no OpenAI key → curated fallback lesson used (words: ${cLesson!.content.words.map((w) => w.word).join(", ")})`);
  assert.ok(cLesson!.content.words.every((w) => w.sinhala.length > 0));
  assert.ok(nLesson!.content.words.every((w) => w.sinhala === ""));
  ok("Sinhala meanings follow each user's explanation-language preference");
  const cNotes1 = await query("SELECT * FROM notifications WHERE user_id=$1", [colombo.id]);
  assert.equal(cNotes1.length, 0);
  ok("Colombo: no notification yet (local time 08:00 is before the preferred 08:30)");
  const nNotes1 = await query<{ channel: string; status: string; detail: string }>("SELECT channel, status, detail FROM notifications WHERE user_id=$1 ORDER BY channel", [newyork.id]);
  assert.deepEqual(nNotes1.map((n) => `${n.channel}:${n.status}`), ["email:sent", "in_app:sent", "push:skipped"]);
  assert.match(nNotes1.find((n) => n.channel === "in_app")!.detail, /^Good evening!/);
  ok("New York: local time 21:30 is past 07:00 → notified (in-app + email; push skipped: no device subscribed; greeting adapts: \"Good evening!\")");

  section("Tick 2 – running again does not duplicate anything");
  const s2 = await runDailyTick(T1);
  assert.equal(s2.generated, 0);
  const count = await queryOne<{ n: string }>("SELECT count(*) n FROM lessons WHERE user_id = ANY($1)", [[colombo.id, newyork.id]]);
  assert.equal(Number(count!.n), 2);
  ok("still exactly one lesson per user per date");

  section("Concurrency – 6 simultaneous requests for the same user/date");
  const date = "2026-11-10";
  const results = await Promise.all(Array.from({ length: 6 }, () => ensureLesson(colombo.id, date)));
  const created = results.filter((r) => r.created).length;
  const rows = await queryOne<{ n: string }>("SELECT count(*) n FROM lessons WHERE user_id=$1 AND lesson_date=$2", [colombo.id, date]);
  assert.equal(created, 1);
  assert.equal(Number(rows!.n), 1);
  assert.ok(results.every((r) => r.lesson.status === "ready"));
  ok("exactly 1 generation, all 6 callers received the same ready lesson");
  await query("DELETE FROM lessons WHERE user_id=$1 AND lesson_date=$2", [colombo.id, date]);
  await query("DELETE FROM learning_items WHERE user_id=$1 AND lesson_id IS NULL", [colombo.id]);

  section("Tick 3 – after the preferred time, notifications are sent once on every enabled channel");
  const T2 = new Date("2026-11-09T03:15:00Z"); // 08:45 Colombo
  const s3 = await runDailyTick(T2);
  console.log("   summary:", JSON.stringify(s3));
  const cNotes = await query<{ channel: string; status: string; detail: string }>("SELECT channel, status, detail FROM notifications WHERE user_id=$1 ORDER BY channel", [colombo.id]);
  console.table(cNotes);
  assert.deepEqual(cNotes.map((n) => n.channel), ["email", "in_app", "push"]);
  assert.ok(cNotes.every((n) => n.status === "sent"), "all channels sent");
  assert.equal(pushHits.length, 1, "push endpoint received exactly one request");
  assert.equal(pushHits[0].headers["content-encoding"], "aes128gcm");
  assert.match(String(pushHits[0].headers["authorization"]), /^vapid t=/);
  ok(`Web Push delivered: encrypted (${pushHits[0].bytes} bytes, aes128gcm) with VAPID auth`);
  const mails = safeReaddir(join(process.cwd(), "outbox")).sort();
  assert.ok(mails.length > outboxBefore);
  const mail = JSON.parse(readFileSync(join(process.cwd(), "outbox", mails.filter((m) => m.includes("nimal")).pop()!), "utf8"));
  assert.match(mail.text, /Your new English practice lesson is ready/);
  ok(`email written (subject: "${mail.subject}") → ${mail.to}`);
  const inApp = cNotes.find((n) => n.channel === "in_app")!;
  assert.match(inApp.detail, /^Good morning! Your new English practice lesson is ready\. Learn 5 new words, 5 useful phrases, and practise today's conversations\.$/);
  ok(`in-app message: "${inApp.detail}"`);

  const s4 = await runDailyTick(new Date("2026-11-09T04:00:00Z")) // 09:30 Colombo, 23:00 NY (still Nov 8);
  const after = await queryOne<{ n: string }>("SELECT count(*) n FROM notifications WHERE user_id=$1", [colombo.id]);
  assert.equal(Number(after!.n), 3);
  assert.equal(pushHits.length, 1);
  assert.equal(s4.generated, 0);
  ok("later ticks the same day send nothing new (no duplicate notifications)");

  section("Learning progress → spaced repetition → next day avoids repeats");
  const lesson1 = await queryOne<{ id: string }>("SELECT id FROM lessons WHERE user_id=$1 AND lesson_date='2026-11-09'", [colombo.id]);
  for (const s of SECTIONS) await markSection(colombo.id, Number(lesson1!.id), s.id);
  const done = await queryOne<{ completed_at: Date | null }>("SELECT completed_at FROM lessons WHERE id=$1", [lesson1!.id]);
  assert.ok(done!.completed_at);
  ok("all 6 sections completed → lesson marked complete");
  const learned = await queryOne<{ n: string }>("SELECT count(*) n FROM learning_items WHERE user_id=$1 AND learned_at IS NOT NULL", [colombo.id]);
  assert.equal(Number(learned!.n), 10);
  ok("5 words + 5 phrases entered spaced repetition (first review = tomorrow)");

  const T3 = new Date("2026-11-10T03:00:00Z"); // next morning in Colombo
  await runDailyTick(T3);
  const day2 = await queryOne<{ content: { words: { word: string }[]; phrases: { phrase: string }[]; itConversation: { scenario: string } } }>(
    "SELECT content FROM lessons WHERE user_id=$1 AND lesson_date='2026-11-10'", [colombo.id]);
  const day1 = await queryOne<{ content: { words: { word: string }[]; phrases: { phrase: string }[]; itConversation: { scenario: string } } }>(
    "SELECT content FROM lessons WHERE user_id=$1 AND lesson_date='2026-11-09'", [colombo.id]);
  const overlapW = day2!.content.words.filter((w) => day1!.content.words.some((x) => normalize(x.word) === normalize(w.word)));
  const overlapP = day2!.content.phrases.filter((p) => day1!.content.phrases.some((x) => normalize(x.phrase) === normalize(p.phrase)));
  assert.equal(overlapW.length + overlapP.length, 0);
  assert.notEqual(day2!.content.itConversation.scenario, day1!.content.itConversation.scenario);
  ok(`day 2 has 5 new words (${day2!.content.words.map((w) => w.word).join(", ")}) and a new scenario ("${day2!.content.itConversation.scenario}")`);

  const tz = "Asia/Colombo";
  const realToday = localDate(tz);
  await query("UPDATE learning_items SET due_date=$2 WHERE user_id=$1 AND learned_at IS NOT NULL", [colombo.id, realToday]);
  const { items, dueCount } = await getReviewItems(colombo.id, tz, 10);
  assert.equal(dueCount, 10);
  const quiz = await buildQuiz(colombo.id, items);
  assert.equal(quiz.length, 10);
  const types = new Set(quiz.map((q) => q.type));
  ok(`revision quiz built: ${quiz.length} questions (${[...types].join(", ")})`);
  const r1 = await recordReview(colombo.id, quiz[0].itemId, true, tz);
  const r2 = await recordReview(colombo.id, quiz[1].itemId, false, tz);
  assert.equal(r1!.interval, 1);
  assert.equal(r2!.interval, 1);
  const r1b = await recordReview(colombo.id, quiz[0].itemId, true, tz);
  assert.equal(r1b!.interval, 3);
  ok("SM-2 scheduling: correct answers push the next review further out (1 → 3 days)");
  const stats = await getStats(colombo.id, tz);
  ok(`stats: ${stats.words} words, ${stats.phrases} phrases, ${stats.completed} lesson(s) completed`);

  section("Speaking feedback (basic checker, no AI key)");
  const fb = await getFeedback({ text: "yesterday night i did finished the login api and today morning i am discuss about the bug", mode: "answer", level: "beginner", profession: "Software Engineer" });
  assert.ok(fb.grammar.length >= 3);
  console.log("   corrected:", fb.corrected);
  ok(`found ${fb.grammar.length} issues; score ${fb.score}`);
  const pr = await getFeedback({ text: "I investigated the production issue and identify the root", mode: "read_aloud", expected: "I investigated the production issue and identified the root cause.", level: "beginner", profession: "Software Engineer" });
  assert.deepEqual(pr.pronunciationReport!.missed, ["identified", "cause"]);
  ok(`read-aloud pronunciation check: ${pr.pronunciationReport!.accuracy}% matched, practise: ${pr.pronunciationReport!.missed.join(", ")}`);

  section("AI path – mock OpenAI-compatible server");
  let mode: "good" | "bad" = "good";
  let aiCalls = 0;
  const ctx = await buildLearnerContext(newyork.id, "2026-11-20");
  const aiLesson = { ...buildFallbackLesson(ctx), theme: "AI-generated: Talking about performance" };
  aiLesson.words = aiLesson.words.map((w, i) => ({ ...w, word: ["latency", "benchmark", "refactor", "throughput", "rollback"][i] }));
  aiLesson.words[4].word = cLesson!.content.words[0].word; // simulate the model repeating a known word (for NY user it's not known)
  const aiServer = createHttpServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      aiCalls++;
      const parsed = JSON.parse(body);
      assert.equal(req.headers.authorization, "Bearer test-key");
      assert.ok(parsed.messages[1].content.includes("DO NOT USE THESE AS NEW WORDS"));
      const content = mode === "good" ? JSON.stringify(aiLesson) : '{"theme": "broken"}';
      res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ choices: [{ message: { content } }] }));
    });
  });
  const aiPort = await listen(aiServer);
  process.env.OPENAI_API_KEY = "test-key";
  process.env.OPENAI_BASE_URL = `http://127.0.0.1:${aiPort}/v1`;

  const known = await query<{ text: string }>("SELECT text FROM learning_items WHERE user_id=$1 AND kind='word'", [newyork.id]);
  aiLesson.words[4].word = known[0].text; // the model "repeats" a word this user already has
  const g = await ensureLesson(newyork.id, "2026-11-20");
  assert.equal(g.lesson.source, "ai");
  assert.equal(g.lesson.content!.theme, aiLesson.theme);
  assert.ok(!g.lesson.content!.words.some((w) => normalize(w.word) === normalize(known[0].text)));
  ok(`AI lesson stored (source=ai, theme "${g.lesson.content!.theme}")`);
  ok(`repeated word "${known[0].text}" from the model was automatically replaced with "${g.lesson.content!.words[4].word}"`);

  mode = "bad";
  aiCalls = 0;
  const g2 = await ensureLesson(newyork.id, "2026-11-21");
  assert.equal(aiCalls, 2, "one retry with the validation error");
  assert.equal(g2.lesson.source, "fallback");
  assert.equal(g2.lesson.status, "ready");
  const err = await queryOne<{ error: string }>("SELECT error FROM lessons WHERE id=$1", [g2.lesson.id]);
  ok(`invalid AI output → retried once, then fallback lesson used (logged: "${err!.error.slice(0, 70)}…")`);

  process.env.OPENAI_BASE_URL = "http://127.0.0.1:9/v1"; // nothing listening
  const g3 = await ensureLesson(newyork.id, "2026-11-22");
  assert.equal(g3.lesson.source, "fallback");
  ok("AI service unreachable → fallback lesson used, user still gets a lesson");

  aiServer.close();
  pushServer.close();
  await cleanup();
  console.log(`\n✅ All ${passed} checks passed. Test users removed.`);
}

function safeReaddir(dir: string): string[] {
  try { return readdirSync(dir); } catch { return []; }
}

main()
  .catch(async (e) => {
    console.error("\n❌ Verification failed:", e);
    process.exitCode = 1;
    await cleanup().catch(() => {});
  })
  .finally(() => {
    servers.forEach((s) => s.close());
    return getPool().end();
  });
