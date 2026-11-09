"use client";
import { useRef, useState } from "react";
import type { Conversation } from "@/lib/types";
import { speak, SpeakButton } from "../SpeakButton";
import { SpeechPractice } from "../SpeechPractice";
import { DoneButton, SectionHeader } from "./parts";

const COLORS = ["bg-brand-600 text-white", "bg-white text-slate-800 border border-slate-200", "bg-emerald-600 text-white", "bg-amber-100 text-amber-900"];

function highlight(text: string, expressions: string[]) {
  const cleaned = expressions
    .map((e) => e.replace(/\.\.\.|…/g, "").replace(/[“”"]/g, "").replace(/\+.*$/, "").trim().replace(/[.,!?]+$/, "").trim())
    .filter((e) => e.length > 3);
  if (!cleaned.length) return text;
  const re = new RegExp(`(${cleaned.map((e) => e.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  return text.split(re).map((part, i) => (i % 2 === 1 ? <mark key={i} className="hl">{part}</mark> : part));
}

export function ConversationCard({
  id, badge, conv, lessonId, done, onDone,
}: { id: "itConversation" | "everydayConversation"; badge: string; conv: Conversation; lessonId: number; done: boolean; onDone: () => void }) {
  const [playing, setPlaying] = useState<number | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [roleLine, setRoleLine] = useState(0);
  const stopRef = useRef(false);
  const speakerIdx = (s: string) => Math.max(0, conv.speakers.indexOf(s));
  const exprs = conv.keyExpressions.map((k) => k.expression);

  function playAll(from = 0) {
    stopRef.current = false;
    const step = (i: number) => {
      if (stopRef.current || i >= conv.lines.length) return setPlaying(null);
      setPlaying(i);
      speak(conv.lines[i].text, 0.92, () => setTimeout(() => step(i + 1), 350));
    };
    step(from);
  }
  function stop() {
    stopRef.current = true;
    window.speechSynthesis?.cancel();
    setPlaying(null);
  }

  const myLines = role ? conv.lines.filter((l) => l.speaker === role) : [];

  return (
    <section className="card p-4 sm:p-5 space-y-4">
      <SectionHeader id={id} title={`${badge}: ${conv.title}`} subtitle={conv.scenario} done={done} />
      <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700"><b>Situation:</b> {conv.situation}</p>

      <div className="flex flex-wrap gap-2">
        {playing === null ? (
          <button className="btn-secondary" onClick={() => playAll()}>▶ Listen to the conversation</button>
        ) : (
          <button className="btn-secondary" onClick={stop}>■ Stop</button>
        )}
      </div>

      <div className="space-y-2.5">
        {conv.lines.map((l, i) => {
          const idx = speakerIdx(l.speaker);
          const right = idx % 2 === 1;
          return (
            <div key={i} className={`flex ${right ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm shadow-sm ${COLORS[idx % COLORS.length]} ${playing === i ? "ring-4 ring-amber-300" : ""} ${role === l.speaker ? "outline-2 outline-dashed outline-amber-400" : ""}`}>
                <p className="text-[11px] font-semibold opacity-75">{l.speaker}</p>
                <p className="leading-relaxed">{highlight(l.text, exprs)}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-3">
        <p className="mb-1.5 text-sm font-semibold text-amber-900">🔑 Useful expressions</p>
        <ul className="space-y-1.5 text-sm">
          {conv.keyExpressions.map((k) => (
            <li key={k.expression} className="flex items-start gap-1">
              <span><b className="text-slate-900">{k.expression}</b> <span className="text-slate-600">— {k.explanation}</span></span>
              <SpeakButton text={k.expression.replace(/\.\.\.|…/g, "")} />
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-xl border border-slate-100 p-3 space-y-3">
        <p className="text-sm font-semibold text-slate-800">🎭 Read it aloud — take a role</p>
        <div className="flex flex-wrap gap-2">
          {conv.speakers.map((s) => (
            <button key={s} onClick={() => { setRole(s); setRoleLine(0); }} className={`chip py-1.5! px-3! ${role === s ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-700"}`}>{s}</button>
          ))}
        </div>
        {role && myLines.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Line {roleLine + 1} of {myLines.length}</span>
              <span className="flex gap-1">
                <button className="btn-ghost px-2! py-1!" disabled={roleLine === 0} onClick={() => setRoleLine(roleLine - 1)}>← Prev</button>
                <button className="btn-ghost px-2! py-1!" disabled={roleLine >= myLines.length - 1} onClick={() => setRoleLine(roleLine + 1)}>Next →</button>
              </span>
            </div>
            <p className="rounded-lg bg-brand-50 p-2.5 text-[15px] font-medium text-brand-900">“{myLines[roleLine].text}” <SpeakButton text={myLines[roleLine].text} /></p>
            <SpeechPractice key={`${role}-${roleLine}`} mode="read_aloud" expected={myLines[roleLine].text} lessonId={lessonId} placeholder="Read the line above aloud…" />
          </div>
        )}
      </div>

      <div className="rounded-xl border border-brand-100 bg-brand-50/40 p-3 space-y-3">
        <p className="text-sm font-semibold text-brand-900">🗣️ Your turn</p>
        <p className="text-sm text-slate-700">{conv.practice.prompt}</p>
        <details className="text-sm text-slate-500">
          <summary className="cursor-pointer select-none">Show a sample answer</summary>
          <p className="mt-1 italic">{conv.practice.sampleAnswer} <SpeakButton text={conv.practice.sampleAnswer} /></p>
        </details>
        <SpeechPractice mode="answer" prompt={conv.practice.prompt} lessonId={lessonId} onDone={onDone} />
      </div>
      <DoneButton done={done} onDone={onDone} />
    </section>
  );
}
