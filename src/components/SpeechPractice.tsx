"use client";
import { useEffect, useRef, useState } from "react";
import type { Feedback } from "@/lib/types";
import { FeedbackCard } from "./FeedbackCard";

type Mode = "read_aloud" | "answer" | "challenge";

/* Minimal typing for the Web Speech API (not in TS DOM lib everywhere). */
type SR = {
  lang: string; continuous: boolean; interimResults: boolean; maxAlternatives: number;
  start(): void; stop(): void; abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string; confidence: number } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};
function getRecognizer(): SR | null {
  if (typeof window === "undefined") return null;
  const C = (window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR }).SpeechRecognition ||
    (window as unknown as { webkitSpeechRecognition?: new () => SR }).webkitSpeechRecognition;
  return C ? new C() : null;
}

let serverSttCache: boolean | null = null;

export function SpeechPractice({
  mode, prompt, expected, lessonId, targetSeconds, placeholder, onDone,
}: {
  mode: Mode; prompt?: string; expected?: string; lessonId?: number; targetSeconds?: number; placeholder?: string; onDone?: (f: Feedback) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<(Feedback & { pronunciationReport?: { accuracy: number; missed: string[] } }) | null>(null);
  const [serverStt, setServerStt] = useState<boolean>(false);
  const [supported, setSupported] = useState({ mic: true, recog: true });

  const recRef = useRef<MediaRecorder | null>(null);
  const srRef = useRef<SR | null>(null);
  const chunks = useRef<Blob[]>([]);
  const finalText = useRef("");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setSupported({ mic: !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined", recog: !!getRecognizer() });
    if (serverSttCache === null) {
      fetch("/api/speech/transcribe").then((r) => r.json()).then((d) => { serverSttCache = !!d.available; setServerStt(serverSttCache); }).catch(() => {});
    } else setServerStt(serverSttCache);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, []);

  async function start() {
    setFeedback(null); setStatus(""); setTranscript(""); setInterim(""); finalText.current = "";
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunks.current = [];
      rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks.current, { type: rec.mimeType || "audio/webm" });
        setAudioUrl(URL.createObjectURL(blob));
        if (serverStt) {
          setStatus("Transcribing your voice…");
          const fd = new FormData();
          fd.append("audio", blob, `speech.${(rec.mimeType || "audio/webm").includes("mp4") ? "mp4" : "webm"}`);
          try {
            const r = await fetch("/api/speech/transcribe", { method: "POST", body: fd });
            const d = await r.json();
            if (r.ok && d.text) setTranscript(d.text);
          } catch {}
          setStatus("");
        }
      };
      rec.start();
      recRef.current = rec;
    } catch {
      setStatus("Microphone permission was blocked. You can type your answer below instead.");
      return;
    }
    const sr = getRecognizer();
    if (sr) {
      sr.lang = "en-US"; sr.continuous = true; sr.interimResults = true; sr.maxAlternatives = 1;
      sr.onresult = (e) => {
        let inter = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) finalText.current += r[0].transcript.trim() + " ";
          else inter += r[0].transcript;
        }
        setTranscript(finalText.current.trim());
        setInterim(inter);
      };
      sr.onerror = (e) => { if (e.error !== "no-speech" && e.error !== "aborted") setStatus(`Speech recognition: ${e.error}. You can type or edit your answer.`); };
      sr.onend = () => { if (recRef.current?.state === "recording") try { sr.start(); } catch {} };
      try { sr.start(); } catch {}
      srRef.current = sr;
    }
    setSeconds(0);
    timer.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    setRecording(true);
  }

  function stop() {
    setRecording(false);
    if (timer.current) clearInterval(timer.current);
    const sr = srRef.current; srRef.current = null;
    if (sr) { sr.onend = null; try { sr.stop(); } catch {} }
    if (recRef.current?.state === "recording") recRef.current.stop();
    setInterim("");
  }

  async function getFeedback() {
    const text = transcript.trim();
    if (!text) { setStatus("Record or type your answer first."); return; }
    setLoading(true); setStatus("");
    try {
      const r = await fetch("/api/speech/feedback", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, mode, prompt, expected, lessonId }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setFeedback(d.feedback);
      onDone?.(d.feedback);
    } catch (e) {
      setStatus((e as Error).message || "Could not get feedback. Please try again.");
    } finally { setLoading(false); }
  }

  const mm = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {!recording ? (
          <button type="button" onClick={start} disabled={!supported.mic} className="btn-primary rounded-full! px-5!">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0M12 17v4" /></svg>
            {audioUrl ? "Record again" : "Start speaking"}
          </button>
        ) : (
          <button type="button" onClick={stop} className="btn rounded-full! bg-rose-600 px-5! text-white hover:bg-rose-700">
            <span className="h-3 w-3 animate-pulse rounded-sm bg-white" /> Stop · {mm}
          </button>
        )}
        {targetSeconds && <span className="text-xs text-slate-500">Target: about {targetSeconds} seconds</span>}
        {audioUrl && !recording && <audio src={audioUrl} controls className="h-9 max-w-full" />}
      </div>
      {!supported.mic && <p className="text-xs text-amber-700">Voice recording isn&apos;t supported in this browser. Type your answer instead.</p>}
      {supported.mic && !supported.recog && !serverStt && (
        <p className="text-xs text-slate-500">Tip: live speech-to-text works best in Chrome or Edge. You can also type what you said.</p>
      )}
      <div>
        <label className="label text-xs! text-slate-500!">{recording ? "Listening…" : "Your answer (you can edit the transcript)"}</label>
        <textarea
          className="input min-h-[84px] text-[15px]"
          value={transcript + (interim ? ` ${interim}` : "")}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder={placeholder ?? "Press “Start speaking”, or type your answer here…"}
          readOnly={recording}
        />
      </div>
      <div className="flex items-center gap-3">
        <button type="button" className="btn-secondary" onClick={getFeedback} disabled={loading || recording || !transcript.trim()}>
          {loading ? "Checking…" : "✨ Get feedback"}
        </button>
        {status && <span className="text-sm text-slate-600">{status}</span>}
      </div>
      {feedback && <FeedbackCard feedback={feedback} original={transcript} />}
    </div>
  );
}
