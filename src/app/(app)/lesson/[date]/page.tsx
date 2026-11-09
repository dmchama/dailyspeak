import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getProfile } from "@/lib/lessons/context";
import { getLesson } from "@/lib/lessons/service";
import { addDays, localDate, prettyDate } from "@/lib/time";
import { LessonView } from "@/components/lesson/LessonView";
import { LessonPreparing } from "@/components/LessonPreparing";

export default async function LessonPage({ params }: { params: Promise<{ date: string }> }) {
  const user = await requireUser();
  const profile = (await getProfile(user.id))!;
  const { date: raw } = await params;
  const today = localDate(profile.timezone);
  const date = raw === "today" ? today : raw;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > today) notFound();

  const lesson = await getLesson(user.id, date);
  if (!lesson || lesson.status !== "ready" || !lesson.content) {
    if (date === today) return <LessonPreparing />;
    return (
      <div className="card p-8 text-center">
        <p className="font-semibold text-slate-800">No lesson for {prettyDate(date)}.</p>
        <Link href="/history" className="btn-secondary mt-4">See all lessons</Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">{date === today ? "Today" : prettyDate(date)}</p>
          <h1 className="text-2xl font-bold text-slate-900">{lesson.content.theme}</h1>
        </div>
        <div className="flex gap-1 text-sm">
          <Link className="btn-ghost px-2.5!" href={`/lesson/${addDays(date, -1)}`}>← Prev</Link>
          {date !== today && <Link className="btn-ghost px-2.5!" href={`/lesson/${addDays(date, 1)}`}>Next →</Link>}
        </div>
      </div>
      <LessonView
        lessonId={lesson.id}
        content={lesson.content}
        initialProgress={lesson.progress}
        showSinhala={profile.explanation_language === "english_sinhala"}
        isToday={date === today}
      />
    </div>
  );
}
