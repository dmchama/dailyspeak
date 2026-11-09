import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getProfile } from "@/lib/lessons/context";
import { buildQuiz, getReviewItems } from "@/lib/review";
import { ReviewQuiz } from "@/components/ReviewQuiz";

export default async function ReviewPage() {
  const user = await requireUser();
  const profile = (await getProfile(user.id))!;
  const { items, dueCount } = await getReviewItems(user.id, profile.timezone, 10);
  const quiz = await buildQuiz(user.id, items);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Revision</h1>
        <p className="text-sm text-slate-500">
          {dueCount > 0 ? `${dueCount} item${dueCount > 1 ? "s are" : " is"} due today (spaced repetition).` : "Nothing is due today, so here's some extra practice."}
        </p>
      </div>
      {quiz.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-3xl">📚</p>
          <p className="mt-2 font-semibold text-slate-800">Nothing to review yet</p>
          <p className="text-sm text-slate-500">Finish the words and phrases in today&apos;s lesson and they&apos;ll come back here for revision.</p>
          <Link href="/lesson/today" className="btn-primary mt-4">Go to today&apos;s lesson</Link>
        </div>
      ) : (
        <ReviewQuiz questions={quiz} />
      )}
    </div>
  );
}
