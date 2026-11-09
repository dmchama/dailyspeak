import { error, json, withUser } from "@/lib/api";
import { aiEnabled, transcribe } from "@/lib/ai/openai";

/** Server-side speech-to-text (OpenAI). The browser falls back to its built-in recogniser when unavailable. */
export const POST = withUser(async (_user, _p, req) => {
  if (!aiEnabled()) return error("Server transcription is not configured", 501);
  const form = await req.formData();
  const file = form.get("audio");
  if (!(file instanceof Blob)) return error("No audio uploaded");
  if (file.size > 10 * 1024 * 1024) return error("Recording is too long", 413);
  const text = await transcribe(file, (file as File).name || "speech.webm");
  return json({ text });
});

export async function GET() {
  return json({ available: aiEnabled() });
}
