"use client";
import { useState } from "react";
import type { Word } from "@/lib/types";
import { SpeakButton } from "../SpeakButton";
import { DoneButton, SectionHeader } from "./parts";

export function WordsCard({ words, showSinhala, done, onDone }: { words: Word[]; showSinhala: boolean; done: boolean; onDone: () => void }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="card p-4 sm:p-5 space-y-4">
      <SectionHeader id="words" title="📘 Today's 5 Words" subtitle="Tap a word to see its meaning and examples. Listen and repeat each one." done={done} />
      <ul className="space-y-2">
        {words.map((w, i) => (
          <li key={w.word} className="rounded-xl border border-slate-100 bg-slate-50/50">
            <button type="button" onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-center justify-between gap-3 p-3 text-left">
              <div>
                <span className="text-base font-bold text-slate-900">{w.word}</span>
                {w.partOfSpeech && <span className="ml-2 text-xs italic text-slate-400">{w.partOfSpeech}</span>}
                <p className="text-xs text-slate-500">{w.pronunciation}</p>
              </div>
              <span className="flex items-center gap-1">
                <span onClick={(e) => e.stopPropagation()}><SpeakButton text={w.word} slow /></span>
                <span className={`text-slate-400 transition ${open === i ? "rotate-180" : ""}`}>⌄</span>
              </span>
            </button>
            {open === i && (
              <div className="space-y-2 border-t border-slate-100 px-3 pb-3 pt-2 text-sm">
                <p><b className="text-slate-700">Meaning:</b> {w.definition}</p>
                {showSinhala && w.sinhala && <p className="text-slate-700"><b>සිංහල:</b> {w.sinhala}</p>}
                <Example tag="💼 IT" text={w.itExample} />
                <Example tag="🏠 Daily" text={w.dailyExample} />
              </div>
            )}
          </li>
        ))}
      </ul>
      <DoneButton done={done} onDone={onDone} label="I've learned these words" />
    </section>
  );
}

export function Example({ tag, text }: { tag: string; text: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-white p-2 border border-slate-100">
      <span className="chip shrink-0 bg-brand-50 text-brand-700">{tag}</span>
      <p className="flex-1 text-slate-700">{text}</p>
      <SpeakButton text={text} />
    </div>
  );
}
