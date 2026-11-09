import type { Feedback } from "@/lib/types";
import { SpeakButton } from "./SpeakButton";

export function FeedbackCard({ feedback, original }: { feedback: Feedback & { pronunciationReport?: { accuracy: number; missed: string[] } }; original: string }) {
  const color = feedback.score >= 80 ? "text-emerald-600 bg-emerald-50" : feedback.score >= 60 ? "text-amber-600 bg-amber-50" : "text-rose-600 bg-rose-50";
  const rows: [string, string][] = [
    ["Sentence structure", feedback.sentenceStructure],
    ["Vocabulary", feedback.vocabulary],
    ["Naturalness", feedback.naturalness],
    ["Pronunciation", feedback.pronunciation],
  ].filter(([, v]) => v) as [string, string][];

  return (
    <div className="rounded-2xl border border-brand-100 bg-gradient-to-b from-brand-50/60 to-white p-4 space-y-4">
      <div className="flex items-start gap-3">
        <div className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl font-bold ${color}`}>
          <span className="text-lg leading-none">{Math.round(feedback.score)}</span>
          <span className="text-[10px] font-medium opacity-80">/100</span>
        </div>
        <div>
          <p className="font-semibold text-slate-900">{feedback.overall}</p>
          {feedback.encouragement && <p className="text-sm text-slate-600">{feedback.encouragement}</p>}
          {feedback.engine === "basic" && <p className="mt-1 text-[11px] text-slate-400">Basic checker (add an OpenAI key for full AI feedback)</p>}
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-xl bg-white p-3 border border-slate-100">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">You said</p>
          <p className="mt-1 text-sm text-slate-700">{original}</p>
        </div>
        <div className="rounded-xl bg-emerald-50 p-3 border border-emerald-100">
          <p className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
            More natural <SpeakButton text={feedback.natural} />
          </p>
          <p className="mt-1 text-sm font-medium text-emerald-900">{feedback.natural}</p>
          {feedback.corrected && feedback.corrected !== feedback.natural && (
            <p className="mt-2 text-xs text-emerald-800/80"><b>Grammar fixed:</b> {feedback.corrected}</p>
          )}
        </div>
      </div>

      {feedback.grammar.length > 0 && (
        <div>
          <p className="mb-1.5 text-sm font-semibold text-slate-800">Grammar</p>
          <ul className="space-y-1.5">
            {feedback.grammar.map((g, i) => (
              <li key={i} className="rounded-xl bg-white p-2.5 text-sm border border-slate-100">
                <span className="text-rose-600 line-through decoration-rose-300">{g.original}</span> →{" "}
                <span className="font-semibold text-emerald-700">{g.correction}</span>
                <p className="text-xs text-slate-500 mt-0.5">{g.explanation}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <dl className="grid gap-2 sm:grid-cols-2">
        {rows.map(([k, v]) => (
          <div key={k} className="rounded-xl bg-white p-2.5 border border-slate-100">
            <dt className="text-xs font-semibold text-slate-500">{k}</dt>
            <dd className="text-sm text-slate-700">{v}</dd>
          </div>
        ))}
      </dl>
      {feedback.pronunciationReport && feedback.pronunciationReport.missed.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-sm">
          <span className="text-slate-500">Practise saying:</span>
          {feedback.pronunciationReport.missed.slice(0, 8).map((w) => (
            <span key={w} className="chip bg-amber-100 text-amber-800 gap-1">{w}<SpeakButton text={w} slow className="px-0! py-0!" /></span>
          ))}
        </div>
      )}
    </div>
  );
}
