import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { getProfile } from "@/lib/lessons/context";
import { localDate, toIsoDate } from "@/lib/time";
import type { Phrase, Word } from "@/lib/types";
import { LibraryTabs } from "./LibraryTabs";
import { SpeakButton } from "./SpeakButton";

export async function ItemLibrary({ kind, q }: { kind: "word" | "phrase"; q: string }) {
  const user = await requireUser();
  const profile = (await getProfile(user.id))!;
  const today = localDate(profile.timezone);
  const rows = await query<{ id: string; text: string; data: Word & Phrase; learned_at: Date | null; due_date: Date | null; correct_count: number; wrong_count: number; created_at: Date }>(
    `SELECT id, text, data, learned_at, due_date, correct_count, wrong_count, created_at FROM learning_items
     WHERE user_id=$1 AND kind=$2 AND ($3 = '' OR text ILIKE '%' || $3 || '%' OR data::text ILIKE '%' || $3 || '%')
     ORDER BY created_at DESC LIMIT 500`,
    [user.id, kind, q],
  );
  const sinhala = profile.explanation_language === "english_sinhala";
  return (
    <div className="space-y-4">
      <LibraryTabs active={kind === "word" ? "vocabulary" : "phrases"} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{kind === "word" ? "Vocabulary library" : "Phrase library"}</h1>
          <p className="text-sm text-slate-500">{rows.length} {kind === "word" ? "words" : "phrases"} from your lessons</p>
        </div>
        <form className="w-full sm:w-72"><input name="q" defaultValue={q} placeholder="Search…" className="input" /></form>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {rows.map((r) => {
          const d = r.data;
          const due = r.due_date ? toIsoDate(r.due_date) : null;
          return (
            <li key={r.id} className="card p-4 space-y-1.5 text-sm">
              <div className="flex items-start justify-between gap-2">
                <p className="text-base font-bold text-slate-900">{kind === "phrase" ? `“${r.text}”` : r.text}</p>
                <SpeakButton text={r.text} />
              </div>
              {kind === "word" && <p className="text-xs text-slate-500">{d.pronunciation} {d.partOfSpeech && `· ${d.partOfSpeech}`}</p>}
              <p className="text-slate-700">{kind === "word" ? d.definition : d.meaning}</p>
              {sinhala && d.sinhala && <p className="text-slate-600">සිංහල: {d.sinhala}</p>}
              <p className="text-slate-500 italic">“{d.itExample}”</p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {r.learned_at ? <span className="chip bg-emerald-50 text-emerald-700">Learned</span> : <span className="chip bg-slate-100 text-slate-600">New</span>}
                {due && <span className={`chip ${due <= today ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{due <= today ? "Review due" : `Next review ${due}`}</span>}
                {r.correct_count + r.wrong_count > 0 && <span className="chip bg-slate-100 text-slate-600">Quiz {r.correct_count}/{r.correct_count + r.wrong_count}</span>}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
