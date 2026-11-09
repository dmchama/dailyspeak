"use client";
import type { Challenge } from "@/lib/types";
import { SpeechPractice } from "../SpeechPractice";
import { DoneButton, SectionHeader } from "./parts";

export function ChallengeCard({ challenge, lessonId, done, onDone }: { challenge: Challenge; lessonId: number; done: boolean; onDone: () => void }) {
  return (
    <section className="card overflow-hidden">
      <div className="bg-gradient-to-br from-brand-600 to-violet-600 p-4 sm:p-5 text-white">
        <div id="challenge" className="scroll-mt-44 flex items-center justify-between">
          <span className="chip bg-white/20 text-white">🏆 Daily Challenge</span>
          {done && <span className="chip bg-emerald-400/90 text-emerald-950">✓ Done</span>}
        </div>
        <h2 className="mt-2 text-xl font-bold">{challenge.title}</h2>
        <p className="mt-1 text-white/90">{challenge.instructions}</p>
      </div>
      <div className="p-4 sm:p-5 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 text-sm">
          <div>
            <p className="font-semibold text-slate-800 mb-1">Tips</p>
            <ul className="list-disc pl-5 text-slate-600 space-y-0.5">{challenge.tips.map((t) => <li key={t}>{t}</li>)}</ul>
          </div>
          {challenge.usefulPhrases.length > 0 && (
            <div>
              <p className="font-semibold text-slate-800 mb-1">Useful phrases</p>
              <div className="flex flex-wrap gap-1.5">{challenge.usefulPhrases.map((p) => <span key={p} className="chip bg-brand-50 text-brand-700">{p}</span>)}</div>
            </div>
          )}
        </div>
        <p className="text-sm text-slate-600">🎤 Try to <b>speak</b> rather than type — that&apos;s how confidence grows.</p>
        <SpeechPractice mode="challenge" prompt={`${challenge.title}: ${challenge.instructions}`} lessonId={lessonId} targetSeconds={challenge.targetSeconds} onDone={onDone} />
        <DoneButton done={done} onDone={onDone} label="I completed the challenge" />
      </div>
    </section>
  );
}
