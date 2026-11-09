import { aiEnabled, chatJSON } from "./openai";
import { FeedbackSchema, type Feedback, type Level } from "../types";

export type FeedbackMode = "read_aloud" | "answer" | "challenge" | "partner";

export type PronunciationReport = {
  accuracy: number; // % of expected words recognised
  missed: string[]; // expected words not recognised (possible pronunciation problems)
  extra: string[];
};

const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9' ]/g, " ").split(/\s+/).filter(Boolean);

/**
 * Compare what the learner was supposed to read with what speech recognition heard.
 * Words the recogniser didn't catch are a reliable signal of unclear pronunciation.
 */
export function comparePronunciation(expected: string, heard: string): PronunciationReport {
  const exp = words(expected);
  const got = words(heard);
  // LCS alignment
  const dp = Array.from({ length: exp.length + 1 }, () => new Array<number>(got.length + 1).fill(0));
  for (let i = exp.length - 1; i >= 0; i--)
    for (let j = got.length - 1; j >= 0; j--)
      dp[i][j] = exp[i] === got[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const missed: string[] = [];
  const extra: string[] = [];
  let i = 0, j = 0;
  while (i < exp.length && j < got.length) {
    if (exp[i] === got[j]) { i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) missed.push(exp[i++]);
    else extra.push(got[j++]);
  }
  while (i < exp.length) missed.push(exp[i++]);
  while (j < got.length) extra.push(got[j++]);
  const accuracy = exp.length ? Math.round((dp[0][0] / exp.length) * 100) : 0;
  return { accuracy, missed: [...new Set(missed)], extra: [...new Set(extra)] };
}

// ---------- Basic rule-based checker (works without AI) ----------

const PAST_TO_BASE: Record<string, string> = {
  finished: "finish", fixed: "fix", tested: "test", completed: "complete", worked: "work", started: "start", called: "call",
  checked: "check", deployed: "deploy", attended: "attend", asked: "ask", needed: "need", wanted: "want", received: "receive",
  solved: "solve", resolved: "resolve", reviewed: "review", joined: "join", updated: "update", closed: "close", changed: "change",
};

type Rule = { re: RegExp; fix: string | ((m: string, ...g: string[]) => string); why: string };

const RULES: Rule[] = [
  { re: /\bi\b/g, fix: "I", why: "" },
  { re: /\b(api|apis|ui|qa|uat|sql|aws|ci\/cd|pr|url|json)\b/g, fix: (m: string) => m.toUpperCase().replace("APIS", "APIs"), why: "" },
  { re: /\bdiscuss about\b/gi, fix: "discuss", why: "'Discuss' doesn't need 'about'. Say 'discuss the issue'." },
  { re: /\brevert back\b/gi, fix: "reply", why: "'Revert back' is not natural for replying. Say 'reply' or 'get back to you'." },
  { re: /\breturn back\b/gi, fix: "return", why: "'Return' already means 'go back', so 'back' is extra." },
  { re: /\bexplain me\b/gi, fix: "explain to me", why: "We 'explain something TO someone'." },
  { re: /\bdo the needful\b/gi, fix: "take care of it", why: "'Do the needful' sounds old-fashioned to many international colleagues. Try 'please take care of it'." },
  { re: /\btoday morning\b/gi, fix: "this morning", why: "Say 'this morning', not 'today morning'." },
  { re: /\btoday evening\b/gi, fix: "this evening", why: "Say 'this evening', not 'today evening'." },
  { re: /\byesterday night\b/gi, fix: "last night", why: "Say 'last night', not 'yesterday night'." },
  { re: /\bi am agree\b/gi, fix: "I agree", why: "'Agree' is a verb, so we don't need 'am'. Say 'I agree'." },
  { re: /\b(can|could) able to\b/gi, fix: (_m, g1) => `${g1}`, why: "'Can' and 'able to' mean the same. Use only one: 'I can do it' or 'I am able to do it'." },
  {
    re: /\b(did|didn't|didnt|did not) (finished|fixed|tested|completed|worked|started|called|checked|deployed|attended|asked|needed|wanted|received|solved|resolved|reviewed|joined|updated|closed|changed)\b/gi,
    fix: (_m, g1, g2) => (g1.toLowerCase() === "did" ? g2 : `${g1} ${PAST_TO_BASE[g2.toLowerCase()] ?? g2}`),
    why: "In positive past sentences just use the past form ('I finished'). After 'didn't', use the base verb ('I didn't finish').",
  },
  { re: /\bdid went\b/gi, fix: "went", why: "Use 'went' alone in positive sentences, or 'did go' for emphasis." },
  { re: /\b(he|she|it) don't\b/gi, fix: (_m, g1) => `${g1} doesn't`, why: "With he/she/it, use 'doesn't'." },
  { re: /\b(he|she|it) have\b/gi, fix: (_m, g1) => `${g1} has`, why: "With he/she/it, use 'has'." },
  { re: /\bi am having (a|an|two|three|some|many|\d+)\b/gi, fix: (_m, g1) => `I have ${g1}`, why: "For possession or experience, use 'I have', not 'I am having'." },
  { re: /\bmore better\b/gi, fix: "better", why: "'Better' is already comparative, so 'more' isn't needed." },
  { re: /\bprepone\b/gi, fix: "bring forward", why: "'Prepone' isn't understood everywhere. Say 'bring the meeting forward'." },
  { re: /\bpass out\b(?= of| from)/gi, fix: "graduate", why: "In international English, 'pass out' means to faint. Say 'graduate from'." },
  { re: /\bI have doubt\b/gi, fix: "I have a question", why: "For asking something, 'I have a question' is more natural than 'I have a doubt'." },
  { re: /\bsince (\d+) (years|months|days|weeks)\b/gi, fix: (_m, g1, g2) => `for ${g1} ${g2}`, why: "Use 'for' with a length of time and 'since' with a starting point." },
  { re: /\bwhat is the time\b/gi, fix: "what time is it", why: "Both work, but 'What time is it?' sounds more natural." },
];

function capitalise(s: string) {
  const t = s.trim();
  if (!t) return t;
  let out = t[0].toUpperCase() + t.slice(1);
  if (!/[.!?]$/.test(out)) out += ".";
  return out;
}

export function basicFeedback(text: string, opts: { expected?: string; pronunciation?: PronunciationReport } = {}): Feedback {
  let corrected = text.trim();
  const grammar: Feedback["grammar"] = [];
  for (const rule of RULES) {
    rule.re.lastIndex = 0;
    const matches = corrected.match(rule.re);
    if (!matches) continue;
    const replaced = corrected.replace(rule.re, rule.fix as string);
    if (replaced !== corrected) {
      if (rule.why) grammar.push({ original: matches[0], correction: matches[0].replace(new RegExp(rule.re.source, "i"), rule.fix as string), explanation: rule.why });
      corrected = replaced;
    }
  }
  corrected = corrected.split(/(?<=[.!?])\s+/).map(capitalise).join(" ");
  const wc = words(text).length;
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim()).length || 1;
  const avgLen = wc / sentences;

  let score = 85 - grammar.length * 8;
  if (wc < 5) score -= 15;
  if (opts.pronunciation) score = Math.round(score * 0.5 + opts.pronunciation.accuracy * 0.5);
  score = Math.max(30, Math.min(98, score));

  const structure =
    avgLen > 28 ? "Some sentences are very long. Try splitting them into two shorter sentences – it's easier to say and to understand."
    : wc < 6 ? "Try to say a little more – aim for two or three complete sentences."
    : "Your sentence length is good and easy to follow.";

  return {
    engine: "basic",
    overall: grammar.length ? "Good effort! I found a few small things you can improve." : "Nice work! Your answer is clear.",
    score,
    corrected,
    natural: corrected,
    grammar,
    sentenceStructure: structure,
    vocabulary: wc >= 12 ? "You used a good range of words." : "Try adding one of today's new words to your answer.",
    naturalness: grammar.length ? "Fixing the points above will make you sound more natural." : "This sounds natural.",
    pronunciation: opts.pronunciation
      ? opts.pronunciation.missed.length
        ? `About ${opts.pronunciation.accuracy}% of the words were recognised clearly. Practise these words slowly: ${opts.pronunciation.missed.slice(0, 6).join(", ")}.`
        : `Excellent – every word was recognised clearly (${opts.pronunciation.accuracy}%).`
      : "",
    encouragement: "Every time you speak, you get better. Keep going! 💪",
  };
}

// ---------- AI feedback ----------

export async function getFeedback(input: {
  text: string;
  mode: FeedbackMode;
  prompt?: string;
  expected?: string;
  level: Level;
  profession: string;
}): Promise<Feedback & { pronunciationReport?: PronunciationReport }> {
  const pron = input.expected ? comparePronunciation(input.expected, input.text) : undefined;
  if (!aiEnabled()) return { ...basicFeedback(input.text, { expected: input.expected, pronunciation: pron }), pronunciationReport: pron };

  try {
    const fb = await chatJSON(
      [
        {
          role: "system",
          content: `You are a kind, encouraging English speaking coach for a ${input.profession} at ${input.level} level.
Analyse the learner's spoken answer (a speech-to-text transcript, so ignore punctuation and capitalisation problems).
Never discourage the learner. Be specific, short and friendly. Use simple English.
Return JSON: {"overall": one-sentence friendly summary, "score": 0-100, "corrected": the learner's text with only grammar errors fixed,
"natural": a more natural way a fluent speaker would say it, "grammar": [{"original","correction","explanation"}] (max 5, only real errors),
"sentenceStructure": one or two sentences, "vocabulary": one or two sentences (suggest better words if useful),
"naturalness": one or two sentences, "pronunciation": ${pron ? "comment using the recognition data given" : "empty string"}, "encouragement": one short motivating line}`,
        },
        {
          role: "user",
          content: `Mode: ${input.mode}
${input.prompt ? `Question / task: ${input.prompt}\n` : ""}${input.expected ? `Text they were reading aloud: ${input.expected}\nWords the speech recogniser did not catch: ${pron?.missed.join(", ") || "none"} (accuracy ${pron?.accuracy}%)\n` : ""}Learner said: "${input.text}"`,
        },
      ],
      FeedbackSchema,
      { temperature: 0.3 },
    );
    return { ...fb, engine: "ai", pronunciationReport: pron };
  } catch (e) {
    console.warn("[feedback] AI failed, using basic checker:", (e as Error).message);
    return { ...basicFeedback(input.text, { expected: input.expected, pronunciation: pron }), pronunciationReport: pron };
  }
}
