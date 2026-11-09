"use client";
import { useState } from "react";
import type { LessonContent } from "@/lib/types";
import { SpeakButton } from "../SpeakButton";
import { SpeechPractice } from "../SpeechPractice";
import { DoneButton, SectionHeader } from "./parts";

export function SpeakingCard({ speaking, lessonId, done, onDone }: { speaking: LessonContent["speaking"]; lessonId: number; done: boolean; onDone: () => void }) {
  const [tab, setTab] = useState<"read" | "answer">("read");
  const [ri, setRi] = useState(0);
  const [qi, setQi] = useState(0);
  return (
    <section className="card p-4 sm:p-5 space-y-4">
      <SectionHeader id="speaking" title="🎙️ Speaking Practice" subtitle="Speak out loud — you'll get friendly feedback on grammar, structure, vocabulary and pronunciation." done={done} />
      <div className="inline-flex rounded-xl bg-slate-100 p-1 text-sm">
        <button className={`rounded-lg px-3 py-1.5 font-medium ${tab === "read" ? "bg-white shadow-sm" : "text-slate-600"}`} onClick={() => setTab("read")}>Read aloud</button>
        <button className={`rounded-lg px-3 py-1.5 font-medium ${tab === "answer" ? "bg-white shadow-sm" : "text-slate-600"}`} onClick={() => setTab("answer")}>Answer questions</button>
      </div>

      {tab === "read" ? (
        <div className="space-y-3">
          <div className="flex gap-1.5">
            {speaking.readAloud.map((_, i) => (
              <button key={i} onClick={() => setRi(i)} className={`h-8 w-8 rounded-full text-sm font-semibold ${ri === i ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600"}`}>{i + 1}</button>
            ))}
          </div>
          <p className="rounded-xl bg-brand-50 p-3 text-base font-medium text-brand-900">“{speaking.readAloud[ri]}” <SpeakButton text={speaking.readAloud[ri]} label="Listen" /></p>
          <p className="text-xs text-slate-500">Listen first, then press Start and read the sentence clearly. We&apos;ll show which words were hard to recognise.</p>
          <SpeechPractice key={`r${ri}`} mode="read_aloud" expected={speaking.readAloud[ri]} lessonId={lessonId} onDone={onDone} />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex gap-1.5">
            {speaking.questions.map((_, i) => (
              <button key={i} onClick={() => setQi(i)} className={`h-8 w-8 rounded-full text-sm font-semibold ${qi === i ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600"}`}>{i + 1}</button>
            ))}
          </div>
          <p className="text-base font-semibold text-slate-900">{speaking.questions[qi].question} <SpeakButton text={speaking.questions[qi].question} /></p>
          {speaking.questions[qi].hint && (
            <details className="text-sm text-slate-500"><summary className="cursor-pointer">Need a hint?</summary><p className="mt-1 italic">{speaking.questions[qi].hint}</p></details>
          )}
          <SpeechPractice key={`q${qi}`} mode="answer" prompt={speaking.questions[qi].question} lessonId={lessonId} onDone={onDone} />
        </div>
      )}
      <DoneButton done={done} onDone={onDone} />
    </section>
  );
}
