import { z } from "zod";

export const LEVELS = [
  { id: "beginner", label: "Beginner", hint: "I know basic words and can make simple sentences." },
  { id: "elementary", label: "Elementary", hint: "I can talk about familiar topics but often pause." },
  { id: "intermediate", label: "Intermediate", hint: "I can join meetings but want to sound more natural." },
  { id: "upper_intermediate", label: "Upper-intermediate", hint: "I speak well but want polish and confidence." },
] as const;
export type Level = (typeof LEVELS)[number]["id"];

export const DOMAINS = [
  { id: "software_development", label: "Software development", topics: "programming, debugging, APIs, databases, cloud services, code reviews, deployments" },
  { id: "quality_assurance", label: "Quality assurance / testing", topics: "test cases, bug reports, regression, UAT, automation, release sign-off" },
  { id: "business_analysis", label: "Business analysis", topics: "requirements, user stories, stakeholders, workshops, acceptance criteria" },
  { id: "project_management", label: "Project / delivery management", topics: "timelines, risks, status reports, sprint planning, client updates, escalations" },
  { id: "devops_cloud", label: "DevOps / cloud", topics: "CI/CD pipelines, infrastructure, monitoring, incidents, on-call, cloud costs" },
  { id: "data", label: "Data / analytics", topics: "dashboards, data pipelines, SQL, reports, data quality, insights" },
] as const;

export const PROFESSIONS = [
  "Software Engineer",
  "Software Developer",
  "QA Engineer",
  "Technical Lead",
  "Business Analyst",
  "IT Project Manager",
  "DevOps Engineer",
  "Data Engineer / Analyst",
  "UI/UX Designer",
  "Other IT professional",
];

export const GOALS = [
  "Speak confidently in meetings",
  "Explain technical work clearly",
  "Prepare for job interviews",
  "Talk with foreign clients",
  "Improve everyday conversation",
  "Write and speak more naturally",
];

export const INTERESTS = ["Cricket", "Travel", "Movies", "Music", "Food", "Technology news", "Fitness", "Gaming", "Books", "Family"];

export const IT_SCENARIOS = [
  "Daily stand-up meeting",
  "Discussing an assigned task with your lead",
  "Explaining development progress",
  "Reporting a technical issue",
  "Code review discussion",
  "Discussing a bug with a QA engineer",
  "Client meeting",
  "Sprint planning",
  "Deployment discussion",
  "UAT discussion with the client",
  "Asking a team member for help",
  "Technical interview",
  "Discussing project requirements",
];

export const EVERYDAY_SCENARIOS = [
  "Introducing yourself",
  "Talking with friends",
  "Shopping",
  "Ordering food",
  "Asking for directions",
  "Making a phone call",
  "Booking an appointment",
  "Travelling",
  "Talking about hobbies",
  "Expressing opinions",
  "Making requests",
  "Handling an unexpected situation",
];

export type Profile = {
  user_id: number;
  profession: string;
  domain: string;
  level: Level;
  goal: string;
  explanation_language: "english" | "english_sinhala";
  daily_minutes: number;
  preferred_time: string;
  timezone: string;
  interests: string[];
  notify_push: boolean;
  notify_email: boolean;
  onboarded: boolean;
};

// ---------- Lesson content schema (validated for AI output) ----------

export const WordSchema = z.object({
  word: z.string().min(1),
  partOfSpeech: z.string().default(""),
  definition: z.string().min(1),
  sinhala: z.string().default(""),
  pronunciation: z.string().min(1),
  itExample: z.string().min(1),
  dailyExample: z.string().min(1),
});

export const PhraseSchema = z.object({
  phrase: z.string().min(1),
  meaning: z.string().min(1),
  sinhala: z.string().default(""),
  whenToUse: z.string().min(1),
  itExample: z.string().min(1),
  dailyExample: z.string().min(1),
});

export const ConversationSchema = z.object({
  title: z.string().min(1),
  scenario: z.string().min(1),
  situation: z.string().min(1),
  speakers: z.array(z.string()).min(2),
  lines: z.array(z.object({ speaker: z.string(), text: z.string() })).min(4),
  keyExpressions: z.array(z.object({ expression: z.string(), explanation: z.string() })).min(1),
  practice: z.object({
    prompt: z.string().min(1),
    sampleAnswer: z.string().min(1),
  }),
});

export const ChallengeSchema = z.object({
  title: z.string().min(1),
  instructions: z.string().min(1),
  tips: z.array(z.string()).min(1),
  usefulPhrases: z.array(z.string()).default([]),
  targetSeconds: z.number().int().min(20).max(300).default(60),
});

export const SpeakingSchema = z.object({
  readAloud: z.array(z.string()).min(1),
  questions: z.array(z.object({ question: z.string(), hint: z.string().default("") })).min(1),
});

export const LessonContentSchema = z.object({
  theme: z.string().min(1),
  greeting: z.string().default(""),
  words: z.array(WordSchema).length(5),
  phrases: z.array(PhraseSchema).length(5),
  itConversation: ConversationSchema,
  everydayConversation: ConversationSchema,
  speaking: SpeakingSchema,
  challenge: ChallengeSchema,
});

export type Word = z.infer<typeof WordSchema>;
export type Phrase = z.infer<typeof PhraseSchema>;
export type Conversation = z.infer<typeof ConversationSchema>;
export type Challenge = z.infer<typeof ChallengeSchema>;
export type LessonContent = z.infer<typeof LessonContentSchema>;

export const SECTIONS = [
  { id: "words", label: "Today's 5 Words" },
  { id: "phrases", label: "Today's 5 Phrases" },
  { id: "itConversation", label: "IT Conversation" },
  { id: "everydayConversation", label: "Everyday Conversation" },
  { id: "speaking", label: "Speaking Practice" },
  { id: "challenge", label: "Daily Challenge" },
] as const;
export type SectionId = (typeof SECTIONS)[number]["id"];

export type LessonRow = {
  id: number;
  user_id: number;
  lesson_date: string;
  status: "generating" | "ready" | "failed";
  source: "ai" | "fallback" | null;
  content: LessonContent | null;
  progress: Partial<Record<SectionId, boolean>>;
  completed_at: string | null;
};

// ---------- Speaking feedback ----------

export const FeedbackSchema = z.object({
  overall: z.string(),
  score: z.number().min(0).max(100),
  corrected: z.string(),
  natural: z.string(),
  grammar: z.array(z.object({ original: z.string(), correction: z.string(), explanation: z.string() })).default([]),
  sentenceStructure: z.string().default(""),
  vocabulary: z.string().default(""),
  naturalness: z.string().default(""),
  pronunciation: z.string().default(""),
  encouragement: z.string().default(""),
});
export type Feedback = z.infer<typeof FeedbackSchema> & { engine: "ai" | "basic" };
