import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listLessons } from "@/lib/lessons/service";
import { prettyDate } from "@/lib/time";
import { SECTIONS } from "@/lib/types";
import { LibraryTabs } from "@/components/LibraryTabs";

export default async function HistoryPage() {
  const user = await requireUser();
  const lessons = await listLessons(user.id, 120);
  return (
    <div className="space-y-4">
      <LibraryTabs active="history" />
      <h1 className="text-2xl font-bold text-slate-900">Learning history</h1>
      {lessons.length === 0 && <p className="text-slate-500">No lessons yet.</p>}
      <ul className="space-y-2">
        {lessons.map((l) => {
          const done = SECTIONS.filter((s) => l.progress[s.id]).length;
          return (
            <li key={l.id}>
              <Link href={`/lesson/${l.lesson_date}`} className="card flex items-center gap-4 p-4 hover:border-brand-200">
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg ${l.completed_at ? "bg-emerald-50" : "bg-slate-100"}`}>{l.completed_at ? "✅" : "📗"}</div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-slate-500">{prettyDate(l.lesson_date)}</p>
                  <p className="truncate font-semibold text-slate-900">{l.content?.theme}</p>
                  <p className="truncate text-xs text-slate-500">{l.content?.words.map((w) => w.word).join(" · ")}</p>
                </div>
                <span className="text-xs text-slate-500">{done}/{SECTIONS.length}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
