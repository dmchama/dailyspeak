import { chatJSON, aiEnabled } from "../ai/openai";
import { LessonContentSchema, type Conversation, type LessonContent } from "../types";
import { normalize, type LearnerContext } from "./context";
import { BANK_CHALLENGES, BANK_EVERYDAY_CONVERSATIONS, BANK_IT_CONVERSATIONS, BANK_PHRASES, BANK_THEMES, BANK_WORDS } from "./fallback-bank";

export const LESSON_SYSTEM_PROMPT = `You are an expert English teacher who designs short daily speaking lessons for IT professionals in Sri Lanka and South Asia.
Rules:
- Use simple, natural, conversational English that fluent speakers really use. Prefer practical words over rare academic words.
- Every example sentence must be grammatically correct.
- Use realistic IT workplace scenarios and common everyday situations.
- Avoid complicated grammar explanations. Be warm and encouraging.
- The whole lesson must be achievable in 15–20 minutes.
- Never repeat words or phrases the learner already knows (you will be given a list).
- Return ONLY valid JSON matching the requested shape.`;

function lessonUserPrompt(ctx: LearnerContext): string {
  const p = ctx.profile;
  const sinhala = p.explanation_language === "english_sinhala";
  return `Create lesson #${ctx.lessonNumber} for this learner.

LEARNER
- Profession: ${p.profession}
- Domain topics: ${ctx.domainTopics}
- Level / difficulty: ${ctx.difficulty}
- Main goal: ${p.goal}
- Interests: ${p.interests.join(", ") || "general"}
- Daily time: ${p.daily_minutes} minutes
- Completed lessons so far: ${ctx.completedLessons}
- Average speaking score: ${ctx.avgSpeakingScore ?? "not yet measured"}
- Common mistakes to gently target in examples and challenge: ${ctx.commonMistakes.join(" | ") || "none recorded yet"}
- Words/phrases they find difficult (you may reuse ONE in a conversation for revision, but not as a new item): ${ctx.weakItems.join(", ") || "none"}

DO NOT USE THESE AS NEW WORDS: ${ctx.knownWords.slice(0, 200).join(", ") || "(none)"}
DO NOT USE THESE AS NEW PHRASES: ${ctx.knownPhrases.slice(0, 150).join(" | ") || "(none)"}

TODAY'S SCENARIOS
- IT conversation scenario: "${ctx.itScenario}" (tailor it to a ${p.profession})
- Everyday conversation scenario: "${ctx.everydayScenario}"

JSON SHAPE
{
  "theme": "short theme for today",
  "greeting": "one friendly motivating sentence",
  "words": [ 5 x { "word", "partOfSpeech", "definition" (simple English), "sinhala" (${sinhala ? "accurate Sinhala meaning in Sinhala script" : "empty string"}), "pronunciation" (stress-marked respelling + IPA, e.g. "in-VES-ti-gate /ɪnˈves.tɪ.ɡeɪt/"), "itExample" (IT workplace sentence), "dailyExample" (everyday sentence) } ],
  "phrases": [ 5 x { "phrase", "meaning", "sinhala" (${sinhala ? "Sinhala meaning" : "empty string"}), "whenToUse", "itExample", "dailyExample" } ],
  "itConversation": { "title", "scenario", "situation" (2 sentences), "speakers": [names with roles], "lines": [6–10 x { "speaker", "text" }], "keyExpressions": [3–4 x { "expression", "explanation" }], "practice": { "prompt" (a question asking the learner to respond in their own words), "sampleAnswer" } },
  "everydayConversation": { same shape as itConversation },
  "speaking": { "readAloud": [3 useful sentences from today's lesson to read aloud], "questions": [3 x { "question" (open question for the learner to answer by speaking, linked to today's words/phrases), "hint" }] },
  "challenge": { "title", "instructions" (a small practical speaking task), "tips": [2–3], "usefulPhrases": [2–4], "targetSeconds": 45–120 }
}
Use some of today's words and phrases inside the conversations. Speakers in the "lines" must exactly match names in "speakers".`;
}

/** Generate with the AI model. Throws on failure so the caller can fall back. */
export async function generateLessonWithAI(ctx: LearnerContext): Promise<LessonContent> {
  if (!aiEnabled()) throw new Error("AI not configured");
  const content = await chatJSON(
    [
      { role: "system", content: LESSON_SYSTEM_PROMPT },
      { role: "user", content: lessonUserPrompt(ctx) },
    ],
    LessonContentSchema,
    { temperature: 0.9 },
  );
  return dedupeAgainstKnown(content, ctx);
}

/** Replace any word/phrase the learner already knows with an unseen one from the curated bank. */
function dedupeAgainstKnown(content: LessonContent, ctx: LearnerContext): LessonContent {
  const knownW = new Set(ctx.knownWords.map(normalize));
  const knownP = new Set(ctx.knownPhrases.map(normalize));
  const level = levelNum(ctx);
  const sinhala = ctx.profile.explanation_language === "english_sinhala";
  const usedW = new Set<string>();
  const words = content.words.map((w) => {
    const n = normalize(w.word);
    if (!knownW.has(n) && !usedW.has(n)) { usedW.add(n); return w; }
    const rep = BANK_WORDS.find((b) => b.lvl <= level + 1 && !knownW.has(normalize(b.word)) && !usedW.has(normalize(b.word)));
    if (!rep) return w;
    usedW.add(normalize(rep.word));
    const { lvl: _l, ...rest } = rep;
    return { ...rest, sinhala: sinhala ? rest.sinhala : "" };
  });
  const usedP = new Set<string>();
  const phrases = content.phrases.map((p) => {
    const n = normalize(p.phrase);
    if (!knownP.has(n) && !usedP.has(n)) { usedP.add(n); return p; }
    const rep = BANK_PHRASES.find((b) => !knownP.has(normalize(b.phrase)) && !usedP.has(normalize(b.phrase)));
    if (!rep) return p;
    usedP.add(normalize(rep.phrase));
    const { lvl: _l, ...rest } = rep;
    return { ...rest, sinhala: sinhala ? rest.sinhala : "" };
  });
  if (!sinhala) {
    words.forEach((w) => (w.sinhala = ""));
    phrases.forEach((p) => (p.sinhala = ""));
  }
  return { ...content, words, phrases };
}

function levelNum(ctx: LearnerContext): 1 | 2 {
  return ctx.difficulty.startsWith("Beginner") || ctx.difficulty.startsWith("Elementary") ? 1 : 2;
}

/** Deterministic, offline lesson built from the curated bank. Never repeats delivered items while unseen ones remain. */
export function buildFallbackLesson(ctx: LearnerContext): LessonContent {
  const level = levelNum(ctx);
  const sinhala = ctx.profile.explanation_language === "english_sinhala";
  const knownW = new Set(ctx.knownWords.map(normalize));
  const knownP = new Set(ctx.knownPhrases.map(normalize));

  // Prefer unseen items at the learner's level, then unseen at any level, then least-recently seen.
  const pick = <T extends { lvl: 1 | 2 }>(pool: T[], key: (t: T) => string, known: Set<string>, recentOrder: string[]): T[] => {
    const unseen = pool.filter((x) => !known.has(normalize(key(x))));
    const ordered = [
      ...unseen.filter((x) => x.lvl <= level),
      ...unseen.filter((x) => x.lvl > level),
      ...pool
        .filter((x) => known.has(normalize(key(x))))
        .sort((a, b) => recentOrder.indexOf(normalize(key(b))) - recentOrder.indexOf(normalize(key(a)))),
    ];
    return ordered.slice(0, 5);
  };

  const words = pick(BANK_WORDS, (w) => w.word, knownW, ctx.knownWords.map(normalize)).map(({ lvl: _l, ...w }) => ({ ...w, sinhala: sinhala ? w.sinhala : "" }));
  const phrases = pick(BANK_PHRASES, (p) => p.phrase, knownP, ctx.knownPhrases.map(normalize)).map(({ lvl: _l, ...p }) => ({ ...p, sinhala: sinhala ? p.sinhala : "" }));

  const n = ctx.lessonNumber - 1;
  const chooseConv = (bank: (Conversation & { lvl: 1 | 2 })[], scenario: string): Conversation => {
    const exact = bank.find((c) => c.scenario === scenario);
    const levelled = bank.filter((c) => c.lvl <= level);
    const c = exact ?? (levelled.length ? levelled : bank)[n % (levelled.length || bank.length)];
    const { lvl: _l, ...rest } = c;
    return rest;
  };
  const itConversation = chooseConv(BANK_IT_CONVERSATIONS, ctx.itScenario);
  const everydayConversation = chooseConv(BANK_EVERYDAY_CONVERSATIONS, ctx.everydayScenario);
  const challenges = BANK_CHALLENGES.filter((c) => c.lvl <= level);
  const { lvl: _cl, ...challenge } = (challenges.length ? challenges : BANK_CHALLENGES)[n % (challenges.length || BANK_CHALLENGES.length)];

  return {
    theme: BANK_THEMES[n % BANK_THEMES.length],
    greeting: "Small steps every day build big confidence. Let's practise!",
    words,
    phrases,
    itConversation,
    everydayConversation,
    speaking: {
      readAloud: [words[0].itExample, phrases[0].itExample, itConversation.lines[1]?.text ?? phrases[1].itExample],
      questions: [
        { question: itConversation.practice.prompt, hint: itConversation.practice.sampleAnswer },
        { question: `Use the word "${words[1].word}" in a sentence about your work.`, hint: words[1].itExample },
        { question: `When would you say "${phrases[2].phrase}"? Give an example from your life.`, hint: phrases[2].dailyExample },
      ],
    },
    challenge,
  };
}
