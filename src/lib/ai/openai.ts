/**
 * Minimal server-side OpenAI client (fetch based, no SDK).
 * The API key is read from the server environment only and is never sent to the browser.
 */
import type { ZodType, ZodTypeDef } from "zod";

export function aiEnabled(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

const baseUrl = () => (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
const model = () => process.env.OPENAI_MODEL || "gpt-4o-mini";

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export async function chat(messages: ChatMessage[], opts: { json?: boolean; temperature?: number; timeoutMs?: number } = {}): Promise<string> {
  if (!aiEnabled()) throw new Error("OPENAI_API_KEY is not configured");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? Number(process.env.OPENAI_TIMEOUT_MS || 45_000));
  try {
    const res = await fetch(`${baseUrl()}/chat/completions`, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: model(),
        messages,
        temperature: opts.temperature ?? 0.8,
        ...(opts.json ? { response_format: { type: "json_object" } } : {}),
      }),
    });
    if (!res.ok) throw new Error(`OpenAI error ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("OpenAI returned an empty response");
    return content;
  } finally {
    clearTimeout(timer);
  }
}

/** Ask for JSON and validate it against a zod schema. Retries once with the validation error. */
export async function chatJSON<T>(messages: ChatMessage[], schema: ZodType<T, ZodTypeDef, unknown>, opts: { temperature?: number } = {}): Promise<T> {
  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const msgs = attempt === 0 ? messages : [...messages, { role: "user" as const, content: `Your previous JSON was invalid: ${lastError}. Return the full corrected JSON only.` }];
    const raw = await chat(msgs, { json: true, temperature: opts.temperature });
    try {
      const parsed = schema.safeParse(JSON.parse(raw));
      if (parsed.success) return parsed.data;
      lastError = parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    } catch (e) {
      lastError = `JSON parse error: ${(e as Error).message}`;
    }
  }
  throw new Error(`AI output failed validation: ${lastError}`);
}

export async function transcribe(audio: Blob, filename = "speech.webm"): Promise<string> {
  if (!aiEnabled()) throw new Error("OPENAI_API_KEY is not configured");
  const form = new FormData();
  form.append("file", audio, filename);
  form.append("model", process.env.OPENAI_TRANSCRIBE_MODEL || "whisper-1");
  form.append("language", "en");
  const res = await fetch(`${baseUrl()}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Transcription failed ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { text?: string };
  return (data.text || "").trim();
}
