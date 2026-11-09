"use client";
import Link from "next/link";
import { useState } from "react";
import type { QuizQuestion } from "@/lib/review";
import { SpeakButton } from "./SpeakButton";

export function ReviewQuiz({ questions }: { questions: QuizQuestion[] }) {
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [built, setBuilt] = useState<number[]>([]);
  const [checked, setChecked] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const q = questions[i];

  async function submit(correct: boolean) {
    setChecked(correct);
    if (correct) setScore((s) => s + 1);
    fetch("/api/review/answer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemId: q.itemId, correct }) });
  }
  function next() {
    if (i + 1 >= questions.length) return setFinished(true);
    setI(i + 1); setPicked(null); setBuilt([]); setChecked(null);
  }

  if (finished) {
    const pct = Math.round((score / questions.length) * 100);
    return (
      <div className="card p-8 text-center space-y-2">
        <p className="text-4xl">{pct >= 80 ? "🌟" : pct >= 50 ? "👍" : "💪"}</p>
        <p className="text-xl font-bold text-slate-900">{score} / {questions.length} correct</p>
        <p className="text-sm text-slate-500">{pct >= 80 ? "Excellent memory! These items will come back less often." : "Good practice! Items you missed will come back tomorrow."}</p>
        <div className="flex justify-center gap-2 pt-2">
          <button className="btn-secondary" onClick={() => location.reload()}>Practise again</button>
          <Link className="btn-primary" href="/dashboard">Done</Link>
        </div>
      </div>
    );
  }

  const typeLabel = q.type === "meaning" ? "Meaning" : q.type === "fill_blank" ? "Fill in the blank" : "Sentence building";

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span className="chip bg-brand-50 text-brand-700">{typeLabel}</span>
        <span>Question {i + 1} of {questions.length}</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-100"><div className="h-1.5 rounded-full bg-brand-500" style={{ width: `${(i / questions.length) * 100}%` }} /></div>
      <p className="text-lg font-semibold text-slate-900">{q.prompt}</p>

      {q.type === "fill_blank" && <p className="rounded-xl bg-slate-50 p-3 text-[15px] text-slate-800">{q.sentence}</p>}

      {(q.type === "meaning" || q.type === "fill_blank") && (
        <div className="space-y-2">
          {q.options.map((o) => {
            const isAnswer = o === q.answer;
            const state = checked === null ? (picked === o ? "border-brand-500 bg-brand-50" : "border-slate-200") : isAnswer ? "border-emerald-500 bg-emerald-50" : picked === o ? "border-rose-400 bg-rose-50" : "border-slate-200 opacity-60";
            return (
              <button key={o} disabled={checked !== null} onClick={() => setPicked(o)} className={`w-full rounded-xl border p-3 text-left text-sm ${state}`}>{o}</button>
            );
          })}
          {checked === null && <button className="btn-primary" disabled={!picked} onClick={() => submit(picked === q.answer)}>Check</button>}
        </div>
      )}

      {q.type === "build_sentence" && (
        <div className="space-y-3">
          <div className="min-h-12 rounded-xl border-2 border-dashed border-slate-200 p-2 flex flex-wrap gap-1.5">
            {built.map((ti, k) => (
              <button key={k} disabled={checked !== null} onClick={() => setBuilt(built.filter((_, x) => x !== k))} className="rounded-lg bg-brand-600 px-2.5 py-1 text-sm text-white">{q.tokens[ti]}</button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {q.tokens.map((t, ti) => !built.includes(ti) && (
              <button key={ti} disabled={checked !== null} onClick={() => setBuilt([...built, ti])} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-sm">{t}</button>
            ))}
          </div>
          {checked === null && (
            <button className="btn-primary" disabled={built.length !== q.tokens.length} onClick={() => submit(built.map((b) => q.tokens[b]).join(" ").toLowerCase() === q.answer.toLowerCase())}>Check</button>
          )}
        </div>
      )}

      {checked !== null && (
        <div className={`rounded-xl p-3 text-sm ${checked ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>
          <p className="font-semibold">{checked ? "Correct! 🎉" : "Not quite — that's okay!"}</p>
          {!checked && q.type === "build_sentence" && <p className="mt-1">Correct order: <b>{q.answer}</b></p>}
          {!checked && q.type !== "build_sentence" && <p className="mt-1">Answer: <b>{q.answer}</b></p>}
          <p className="mt-1 opacity-90">{q.explanation} <SpeakButton text={q.explanation} /></p>
          <button className="btn-primary mt-3" onClick={next}>{i + 1 >= questions.length ? "See results" : "Next question"}</button>
        </div>
      )}
    </div>
  );
}
