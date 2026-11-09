"use client";
import type { Phrase } from "@/lib/types";
import { SpeakButton } from "../SpeakButton";
import { DoneButton, SectionHeader } from "./parts";
import { Example } from "./WordsCard";

export function PhrasesCard({ phrases, showSinhala, done, onDone }: { phrases: Phrase[]; showSinhala: boolean; done: boolean; onDone: () => void }) {
  return (
    <section className="card p-4 sm:p-5 space-y-4">
      <SectionHeader id="phrases" title="💬 Today's 5 Phrases" subtitle="Expressions fluent speakers use every day." done={done} />
      <ul className="space-y-3">
        {phrases.map((p, i) => (
          <li key={p.phrase} className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 space-y-2 text-sm">
            <div className="flex items-start justify-between gap-2">
              <p className="text-base font-bold text-slate-900"><span className="mr-1.5 text-slate-400">{i + 1}.</span>“{p.phrase}”</p>
              <SpeakButton text={p.phrase} />
            </div>
            <p><b className="text-slate-700">Meaning:</b> {p.meaning}</p>
            {showSinhala && p.sinhala && <p className="text-slate-700"><b>සිංහල:</b> {p.sinhala}</p>}
            <p className="text-slate-600"><b className="text-slate-700">When to use it:</b> {p.whenToUse}</p>
            <Example tag="💼 IT" text={p.itExample} />
            <Example tag="🏠 Daily" text={p.dailyExample} />
          </li>
        ))}
      </ul>
      <DoneButton done={done} onDone={onDone} label="I've learned these phrases" />
    </section>
  );
}
