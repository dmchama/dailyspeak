"use client";
import { useState } from "react";
import { SECTIONS, type LessonContent, type SectionId } from "@/lib/types";
import { WordsCard } from "./WordsCard";
import { PhrasesCard } from "./PhrasesCard";
import { ConversationCard } from "./ConversationCard";
import { SpeakingCard } from "./SpeakingCard";
import { ChallengeCard } from "./ChallengeCard";

export function LessonView({
  lessonId, content, initialProgress, showSinhala, isToday,
}: {
  lessonId: number; content: LessonContent; initialProgress: Partial<Record<SectionId, boolean>>; showSinhala: boolean; isToday: boolean;
}) {
  const [progress, setProgress] = useState(initialProgress);
  const [celebrate, setCelebrate] = useState(false);
  const done = SECTIONS.filter((s) => progress[s.id]).length;

  async function complete(section: SectionId) {
    if (progress[section]) return;
    setProgress((p) => ({ ...p, [section]: true }));
    const r = await fetch(`/api/lessons/${lessonId}/progress`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ section }),
    });
    if (r.ok) {
      const d = await r.json();
      setProgress(d.progress);
      if (d.completed) setCelebrate(true);
    }
  }

  const sectionProps = (id: SectionId) => ({ done: !!progress[id], onDone: () => complete(id) });

  return (
    <div className="space-y-5">
      <div className="card sticky top-16 z-20 p-3.5">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-slate-800">Today&apos;s progress</span>
          <span className="text-slate-500">{done}/{SECTIONS.length} sections</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-emerald-500 transition-all" style={{ width: `${(done / SECTIONS.length) * 100}%` }} />
        </div>
        <div className="mt-2.5 flex gap-1.5 overflow-x-auto pb-0.5 text-xs">
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`} className={`chip shrink-0 py-1! ${progress[s.id] ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
              {progress[s.id] ? "✓ " : ""}{s.label.replace("Today's ", "")}
            </a>
          ))}
        </div>
      </div>

      {celebrate && (
        <div className="card border-emerald-200 bg-emerald-50 p-5 text-center">
          <p className="text-3xl">🎉</p>
          <p className="mt-1 text-lg font-bold text-emerald-800">Lesson complete!</p>
          <p className="text-sm text-emerald-700">Great job. Your streak is growing — see you tomorrow!</p>
        </div>
      )}

      <WordsCard words={content.words} showSinhala={showSinhala} {...sectionProps("words")} />
      <PhrasesCard phrases={content.phrases} showSinhala={showSinhala} {...sectionProps("phrases")} />
      <ConversationCard id="itConversation" badge="💼 IT Conversation" conv={content.itConversation} lessonId={lessonId} {...sectionProps("itConversation")} />
      <ConversationCard id="everydayConversation" badge="☕ Everyday Conversation" conv={content.everydayConversation} lessonId={lessonId} {...sectionProps("everydayConversation")} />
      <SpeakingCard speaking={content.speaking} lessonId={lessonId} {...sectionProps("speaking")} />
      <ChallengeCard challenge={content.challenge} lessonId={lessonId} {...sectionProps("challenge")} />
      {!isToday && <p className="text-center text-xs text-slate-400">You are viewing a past lesson. Practising it still counts toward your review.</p>}
    </div>
  );
}
