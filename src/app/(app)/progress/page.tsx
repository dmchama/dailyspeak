import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { getProfile } from "@/lib/lessons/context";
import { getStats } from "@/lib/lessons/service";
import { addDays, localDate } from "@/lib/time";

export default async function ProgressPage() {
  const user = await requireUser();
  const profile = (await getProfile(user.id))!;
  const stats = await getStats(user.id, profile.timezone);
  const today = localDate(profile.timezone);
  const [scores, mistakes, practiced] = await Promise.all([
    query<{ d: string; avg: string; n: string }>(
      `SELECT to_char(date_trunc('day', created_at AT TIME ZONE $2), 'YYYY-MM-DD') AS d, round(avg(score)) AS avg, count(*) AS n
       FROM speech_attempts WHERE user_id=$1 AND created_at > now() - interval '30 days' GROUP BY 1 ORDER BY 1`,
      [user.id, profile.timezone],
    ),
    query<{ explanation: string; n: string }>(
      `SELECT g->>'explanation' AS explanation, count(*) AS n FROM speech_attempts, jsonb_array_elements(feedback->'grammar') g
       WHERE user_id=$1 GROUP BY 1 ORDER BY n DESC LIMIT 5`,
      [user.id],
    ),
    query<{ d: string }>(
      `SELECT DISTINCT to_char(created_at AT TIME ZONE $2, 'YYYY-MM-DD') AS d FROM speech_attempts WHERE user_id=$1 AND created_at > now() - interval '40 days'`,
      [user.id, profile.timezone],
    ),
  ]);
  const completed = new Set(stats.completedDates);
  const spoke = new Set(practiced.map((p) => p.d));
  const days = Array.from({ length: 35 }, (_, i) => addDays(today, i - 34));
  const maxN = Math.max(1, ...scores.map((s) => Number(s.n)));

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-slate-900">Your progress</h1>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["🔥", "Current streak", `${stats.streak} day${stats.streak === 1 ? "" : "s"}`],
          ["🏅", "Best streak", `${stats.bestStreak} days`],
          ["📘", "Words learned", stats.words],
          ["💬", "Phrases learned", stats.phrases],
          ["✅", "Lessons completed", `${stats.completed} / ${stats.lessons}`],
          ["🎙️", "Speaking attempts", stats.attempts],
          ["⭐", "Average speaking score", stats.avgScore ?? "—"],
          ["🔁", "Due for review", stats.due],
        ].map(([icon, label, value]) => (
          <div key={String(label)} className="card p-4"><p className="text-lg">{icon}</p><p className="mt-1 text-xl font-bold text-slate-900">{value}</p><p className="text-xs text-slate-500">{label}</p></div>
        ))}
      </div>

      <section className="card p-4 sm:p-5">
        <h2 className="font-bold text-slate-900">Last 5 weeks</h2>
        <p className="mb-3 text-xs text-slate-500">Green = lesson completed · Light green = practised speaking</p>
        <div className="grid grid-cols-7 gap-1.5 max-w-sm">
          {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <span key={i} className="text-center text-[10px] text-slate-400">{d}</span>)}
          {Array.from({ length: (new Date(`${days[0]}T12:00:00Z`).getUTCDay() + 6) % 7 }).map((_, i) => <span key={`pad${i}`} />)}
          {days.map((d) => (
            <span key={d} title={d} className={`aspect-square rounded-md ${completed.has(d) ? "bg-emerald-500" : spoke.has(d) ? "bg-emerald-200" : "bg-slate-100"} ${d === today ? "ring-2 ring-brand-500" : ""}`} />
          ))}
        </div>
      </section>

      <section className="card p-4 sm:p-5">
        <h2 className="mb-3 font-bold text-slate-900">Speaking scores (30 days)</h2>
        {scores.length === 0 ? <p className="text-sm text-slate-500">No speaking practice yet. Record your first answer in today&apos;s lesson!</p> : (
          <div className="flex h-40 items-end gap-1.5">
            {scores.map((s) => (
              <div key={s.d} className="group flex flex-1 flex-col items-center gap-1" title={`${s.d}: avg ${s.avg} (${s.n} attempts)`}>
                <span className="text-[10px] text-slate-500">{s.avg}</span>
                <div className="w-full max-w-8 rounded-t-md bg-brand-500" style={{ height: `${Number(s.avg) * 1.1}px`, opacity: 0.5 + (Number(s.n) / maxN) * 0.5 }} />
                <span className="text-[9px] text-slate-400">{s.d.slice(5)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card p-4 sm:p-5">
        <h2 className="mb-2 font-bold text-slate-900">Things to focus on</h2>
        {mistakes.length === 0 ? <p className="text-sm text-slate-500">No repeated mistakes found yet. Keep speaking!</p> : (
          <ul className="space-y-2 text-sm">
            {mistakes.map((m) => <li key={m.explanation} className="flex justify-between gap-3 rounded-xl bg-amber-50 p-2.5 text-amber-900"><span>{m.explanation}</span><span className="chip bg-white">{m.n}×</span></li>)}
          </ul>
        )}
        <p className="mt-3 text-xs text-slate-400">Your future lessons automatically include practice for these points.</p>
      </section>
    </div>
  );
}
