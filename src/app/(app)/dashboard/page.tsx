import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { getProfile } from "@/lib/lessons/context";
import { getLesson, getStats } from "@/lib/lessons/service";
import { localDate, localMinutes, prettyDate } from "@/lib/time";
import { SECTIONS } from "@/lib/types";
import { LessonPreparing } from "@/components/LessonPreparing";
import { MarkNotificationsRead } from "@/components/MarkNotificationsRead";

export default async function Dashboard() {
  const user = await requireUser();
  const profile = (await getProfile(user.id))!;
  const today = localDate(profile.timezone);
  const [lesson, stats, notes] = await Promise.all([
    getLesson(user.id, today),
    getStats(user.id, profile.timezone),
    query<{ detail: string; created_at: Date }>(
      "SELECT detail, created_at FROM notifications WHERE user_id=$1 AND channel='in_app' AND read_at IS NULL ORDER BY created_at DESC LIMIT 1",
      [user.id],
    ),
  ]);
  const mins = localMinutes(profile.timezone);
  const hello = mins < 720 ? "Good morning" : mins < 1020 ? "Good afternoon" : "Good evening";
  const ready = lesson?.status === "ready" && lesson.content;
  const done = ready ? SECTIONS.filter((s) => lesson!.progress[s.id]).length : 0;
  const pct = Math.round((done / SECTIONS.length) * 100);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-slate-500">{prettyDate(today)}</p>
        <h1 className="text-2xl font-bold text-slate-900">{hello}, {user.name.split(" ")[0]} 👋</h1>
      </div>

      {notes[0] && (
        <div className="flex items-start gap-3 rounded-2xl border border-brand-200 bg-brand-50 p-3.5 text-sm text-brand-900">
          <span className="text-lg">🔔</span>
          <p className="flex-1">{notes[0].detail}</p>
          <MarkNotificationsRead />
        </div>
      )}

      {!ready ? (
        <LessonPreparing />
      ) : (
        <section className="card overflow-hidden">
          <div className="bg-gradient-to-br from-brand-600 to-violet-600 p-5 text-white">
            <p className="text-xs font-semibold uppercase tracking-wider text-white/70">Today&apos;s lesson</p>
            <h2 className="mt-1 text-xl font-bold">{lesson!.content!.theme}</h2>
            {lesson!.content!.greeting && <p className="mt-1 text-sm text-white/85">{lesson!.content!.greeting}</p>}
            <div className="mt-4 flex flex-wrap gap-1.5">
              {lesson!.content!.words.map((w) => <span key={w.word} className="chip bg-white/15 text-white">{w.word}</span>)}
            </div>
            <div className="mt-5">
              <div className="flex justify-between text-xs text-white/80"><span>{done} of {SECTIONS.length} sections</span><span>{pct}%</span></div>
              <div className="mt-1.5 h-2 rounded-full bg-white/20"><div className="h-2 rounded-full bg-emerald-300" style={{ width: `${pct}%` }} /></div>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 p-4">
            <p className="text-sm text-slate-600">⏱️ About {profile.daily_minutes} minutes · 5 words · 5 phrases · 2 conversations</p>
            <Link href="/lesson/today" className="btn-primary px-6!">{done === 0 ? "Start today's practice" : done === SECTIONS.length ? "Review today's lesson" : "Continue practice"} →</Link>
          </div>
        </section>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon="🔥" label="Day streak" value={stats.streak} />
        <Stat icon="📘" label="Words learned" value={stats.words} />
        <Stat icon="💬" label="Phrases learned" value={stats.phrases} />
        <Stat icon="✅" label="Lessons completed" value={stats.completed} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/review" className="card flex items-center gap-4 p-4 hover:border-brand-200">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-2xl">🔁</span>
          <div className="flex-1">
            <p className="font-semibold text-slate-900">Daily revision quiz</p>
            <p className="text-sm text-slate-500">{stats.due > 0 ? `${stats.due} item${stats.due > 1 ? "s" : ""} due for review today` : "Nothing due — practise anyway!"}</p>
          </div>
          <span className="text-slate-400">→</span>
        </Link>
        <Link href="/practice" className="card flex items-center gap-4 p-4 hover:border-brand-200">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-2xl">🤖</span>
          <div className="flex-1">
            <p className="font-semibold text-slate-900">AI conversation partner</p>
            <p className="text-sm text-slate-500">Practise a stand-up, an interview or small talk</p>
          </div>
          <span className="text-slate-400">→</span>
        </Link>
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: string; label: string; value: number }) {
  return (
    <div className="card p-4">
      <p className="text-xl">{icon}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}
