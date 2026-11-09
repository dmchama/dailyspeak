import { query, queryOne } from "../db";
import { DOMAINS, EVERYDAY_SCENARIOS, IT_SCENARIOS, type Level, type Profile } from "../types";

export type LearnerContext = {
  profile: Profile;
  lessonNumber: number; // 1-based index of the lesson being generated
  completedLessons: number;
  knownWords: string[];
  knownPhrases: string[];
  weakItems: string[];
  commonMistakes: string[];
  avgSpeakingScore: number | null;
  difficulty: string;
  itScenario: string;
  everydayScenario: string;
  domainTopics: string;
};

export async function getProfile(userId: number): Promise<Profile | null> {
  const row = await queryOne<Profile>("SELECT * FROM profiles WHERE user_id=$1", [userId]);
  return row ? { ...row, user_id: Number(row.user_id) } : null;
}

const LEVEL_ORDER: Level[] = ["beginner", "elementary", "intermediate", "upper_intermediate"];

/**
 * Content gradually becomes more challenging: the learner's chosen level is the base,
 * and good speaking scores over many completed lessons nudge difficulty upward.
 */
export function effectiveDifficulty(level: Level, completed: number, avgScore: number | null): string {
  let idx = LEVEL_ORDER.indexOf(level);
  if (completed >= 10 && (avgScore ?? 0) >= 75) idx += 1;
  if (completed >= 30 && (avgScore ?? 0) >= 85) idx += 1;
  idx = Math.min(idx, LEVEL_ORDER.length - 1);
  const labels: Record<Level, string> = {
    beginner: "Beginner (A2): very common words, short sentences, present/past simple, no idioms that are hard to guess",
    elementary: "Elementary/pre-intermediate (A2–B1): common workplace words, simple compound sentences",
    intermediate: "Intermediate (B1–B2): practical workplace vocabulary, natural phrasal verbs, polite structures",
    upper_intermediate: "Upper-intermediate (B2): nuanced professional vocabulary, diplomatic language, natural idioms",
  };
  return labels[LEVEL_ORDER[idx]];
}

export async function buildLearnerContext(userId: number, lessonDate: string): Promise<LearnerContext> {
  const profile = await getProfile(userId);
  if (!profile) throw new Error(`No profile for user ${userId}`);

  const [counts, items, weak, attempts] = await Promise.all([
    queryOne<{ total: string; completed: string }>(
      `SELECT count(*) FILTER (WHERE lesson_date < $2) AS total,
              count(*) FILTER (WHERE completed_at IS NOT NULL) AS completed
       FROM lessons WHERE user_id=$1 AND status='ready'`,
      [userId, lessonDate],
    ),
    query<{ kind: string; text: string }>("SELECT kind, text FROM learning_items WHERE user_id=$1 ORDER BY created_at DESC LIMIT 400", [userId]),
    query<{ text: string }>(
      `SELECT text FROM learning_items WHERE user_id=$1 AND wrong_count > correct_count ORDER BY wrong_count DESC LIMIT 8`,
      [userId],
    ),
    query<{ feedback: { grammar?: { original: string; correction: string; explanation: string }[] }; score: number | null }>(
      "SELECT feedback, score FROM speech_attempts WHERE user_id=$1 ORDER BY created_at DESC LIMIT 30",
      [userId],
    ),
  ]);

  const mistakes = new Map<string, number>();
  for (const a of attempts) for (const g of a.feedback.grammar ?? []) {
    const key = g.explanation.slice(0, 120);
    mistakes.set(key, (mistakes.get(key) ?? 0) + 1);
  }
  const scores = attempts.map((a) => a.score).filter((s): s is number => typeof s === "number");
  const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  const total = Number(counts?.total ?? 0);
  const completed = Number(counts?.completed ?? 0);

  const domain = DOMAINS.find((d) => d.id === profile.domain) ?? DOMAINS[0];
  return {
    profile,
    lessonNumber: total + 1,
    completedLessons: completed,
    knownWords: items.filter((i) => i.kind === "word").map((i) => i.text),
    knownPhrases: items.filter((i) => i.kind === "phrase").map((i) => i.text),
    weakItems: weak.map((w) => w.text),
    commonMistakes: [...mistakes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([m]) => m),
    avgSpeakingScore: avg,
    difficulty: effectiveDifficulty(profile.level, completed, avg),
    itScenario: IT_SCENARIOS[total % IT_SCENARIOS.length],
    everydayScenario: EVERYDAY_SCENARIOS[total % EVERYDAY_SCENARIOS.length],
    domainTopics: domain.topics,
  };
}

export const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9' ]/g, "").replace(/\s+/g, " ").trim();
