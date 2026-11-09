"use client";
import { useState } from "react";

/** Reads text aloud using the browser's built-in text-to-speech. */
export function speak(text: string, rate = 0.9, onEnd?: () => void) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-US";
  u.rate = rate;
  const voice = window.speechSynthesis.getVoices().find((v) => /en-(US|GB)/.test(v.lang) && /Google|Samantha|Daniel|Natural/i.test(v.name));
  if (voice) u.voice = voice;
  if (onEnd) u.onend = onEnd;
  window.speechSynthesis.speak(u);
}

export function SpeakButton({ text, label, slow = false, className = "" }: { text: string; label?: string; slow?: boolean; className?: string }) {
  const [playing, setPlaying] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        setPlaying(true);
        speak(text, slow ? 0.7 : 0.92, () => setPlaying(false));
        setTimeout(() => setPlaying(false), 15000);
      }}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50 ${className}`}
      aria-label={`Listen: ${text}`}
      title="Listen"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 5 6 9H2v6h4l5 4z" />{playing ? <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" /> : <path d="M15.5 8.5a5 5 0 0 1 0 7" />}</svg>
      {label}
    </button>
  );
}
