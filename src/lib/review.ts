import { query, queryOne } from "./db";
import { addDays, localDate } from "./time";
import type { Phrase, Word } from "./types";

export type ReviewItem = { id: number; kind: "word" | "phrase"; text: string; data: Word | Phrase };

export type QuizQuestion =
  | { type: "meaning"; itemId: number; prompt: string; options: string[]; answer: string; explanation: string }
  | { type: "fill_blank"; itemId: number; prompt: string; sentence: string; options: string[]; answer: string; explanation: string }
  | { type: "build_sentence"; itemId: number; prompt: string; tokens: string[]; answer: string; explanation: string };

const shuffle = <T,>(arr: T[], seed = Math.random()): T[] => {
  const a = [...arr];
  let s = Math.floor(seed * 2 ** 31) || 1;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 48271) % 2147483647;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const meaningOf = (it: ReviewItem) => ("definition" in it.data ? it.data.definition : it.data.meaning);
const itExample = (it: ReviewItem) => it.data.itExample;

/** Items due for spaced-repetition review today (learned items only). Falls back to recent items so practice is always possible. */
export async function getReviewItems(userId: number, timezone: string, limit = 10): Promise<{ items: ReviewItem[]; dueCount: number }> {
  const today = localDate(timezone);
  const due = await query<{ id: string; kind: "word" | "phrase"; text: string; data: Word | Phrase }>(
    `SELECT id, kind, text, data FROM learning_items
     WHERE user_id=$1 AND learned_at IS NOT NULL AND due_date <= $2::date
     ORDER BY due_date, wrong_count DESC LIMIT $3`,
    [userId, today, limit],
  );
  let items = due.map((r) => ({ ...r, id: Number(r.id) }));
  const dueCount = items.length;
  if (items.length < 4) {
    const extra = await query<{ id: string; kind: "word" | "phrase"; text: string; data: Word | Phrase }>(
      `SELECT id, kind, text, data FROM learning_items WHERE user_id=$1 AND learned_at IS NOT NULL AND NOT (id = ANY($2::bigint[]))
       ORDER BY last_reviewed NULLS FIRST, created_at DESC LIMIT $3`,
      [userId, items.map((i) => i.id), limit - items.length],
    );
    items = [...items, ...extra.map((r) => ({ ...r, id: Number(r.id) }))];
  }
  return { items, dueCount };
}

/** Build a varied quiz from review items: meaning (MCQ), fill-in-the-blank and sentence building. */
export async function buildQuiz(userId: number, items: ReviewItem[]): Promise<QuizQuestion[]> {
  if (!items.length) return [];
  const distractorPool = await query<{ kind: string; text: string; data: Word | Phrase }>(
    "SELECT kind, text, data FROM learning_items WHERE user_id=$1 ORDER BY random() LIMIT 40",
    [userId],
  );
  const qs: QuizQuestion[] = [];
  items.forEach((it, idx) => {
    const type = idx % 3;
    const sameKind = distractorPool.filter((d) => d.kind === it.kind && d.text !== it.text);
    if (type === 0) {
      const correct = meaningOf(it);
      const others = shuffle(sameKind.map((d) => ("definition" in d.data ? d.data.definition : (d.data as Phrase).meaning)).filter((m) => m !== correct)).slice(0, 3);
      qs.push({ type: "meaning", itemId: it.id, prompt: `What does “${it.text}” mean?`, options: shuffle([correct, ...others]), answer: correct, explanation: itExample(it) });
      return;
    }
    const sentence = itExample(it);
    const target = it.kind === "word" ? findWordForm(sentence, it.text) : null;
    if (type === 1 && target) {
      const others = shuffle(sameKind.map((d) => d.text)).slice(0, 3);
      qs.push({
        type: "fill_blank",
        itemId: it.id,
        prompt: "Choose the word that completes the sentence.",
        sentence: sentence.replace(target, "_____"),
        options: shuffle([target, ...others.map((o) => o.toLowerCase())]),
        answer: target,
        explanation: `${it.text}: ${meaningOf(it)}`,
      });
      return;
    }
    const tokens = sentence.replace(/[.!?]$/, "").split(/\s+/);
    if (tokens.length <= 14) {
      qs.push({ type: "build_sentence", itemId: it.id, prompt: `Put the words in the right order (uses “${it.text}”).`, tokens: shuffle(tokens), answer: tokens.join(" "), explanation: sentence });
    } else {
      const correct = meaningOf(it);
      const others = shuffle(sameKind.map((d) => ("definition" in d.data ? d.data.definition : (d.data as Phrase).meaning))).slice(0, 3);
      qs.push({ type: "meaning", itemId: it.id, prompt: `What does “${it.text}” mean?`, options: shuffle([correct, ...others]), answer: correct, explanation: sentence });
    }
  });
  return qs;
}

/** Find the inflected form of a word in a sentence (investigate → investigated). */
function findWordForm(sentence: string, word: string): string | null {
  const stem = word.toLowerCase().replace(/e$/, "").slice(0, Math.max(4, word.length - 2));
  const m = sentence.match(new RegExp(`\\b(${stem.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}[a-z-]*)\\b`, "i"));
  return m ? m[1] : null;
}

/** SM-2 spaced-repetition update. quality: 0–5 (we use 5 = correct first time, 2 = wrong). */
export async function recordReview(userId: number, itemId: number, correct: boolean, timezone: string) {
  const it = await queryOne<{ ease: number; interval_days: number; repetitions: number }>(
    "SELECT ease, interval_days, repetitions FROM learning_items WHERE id=$1 AND user_id=$2",
    [itemId, userId],
  );
  if (!it) return null;
  const q = correct ? 5 : 2;
  let { ease, interval_days: interval, repetitions: reps } = it;
  if (q < 3) {
    reps = 0;
    interval = 1;
  } else {
    reps += 1;
    interval = reps === 1 ? 1 : reps === 2 ? 3 : Math.round(interval * ease);
  }
  ease = Math.max(1.3, ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
  const due = addDays(localDate(timezone), interval);
  await query(
    `UPDATE learning_items SET ease=$3, interval_days=$4, repetitions=$5, due_date=$6, last_reviewed=now(),
       correct_count = correct_count + $7, wrong_count = wrong_count + $8 WHERE id=$1 AND user_id=$2`,
    [itemId, userId, ease, interval, reps, due, correct ? 1 : 0, correct ? 0 : 1],
  );
  return { nextReview: due, interval };
}
