"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/** Shown while today's lesson is being generated; asks the server to ensure it exists, then refreshes. */
export function LessonPreparing() {
  const router = useRouter();
  const [err, setErr] = useState("");
  useEffect(() => {
    let cancelled = false;
    // Keep asking until the lesson is ready (another request may still be generating it).
    const attempt = async (n: number): Promise<void> => {
      const r = await fetch("/api/lessons/today", { method: "POST" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Could not prepare the lesson");
      if (cancelled) return;
      if (d.lesson?.status === "ready") return router.refresh();
      if (n >= 6) throw new Error("Your lesson is taking longer than usual. Please try again in a minute.");
      await new Promise((res) => setTimeout(res, 4000));
      return attempt(n + 1);
    };
    attempt(1).catch((e) => !cancelled && setErr(e.message || "Could not prepare the lesson"));
    return () => { cancelled = true; };
  }, [router]);
  return (
    <div className="card flex flex-col items-center gap-3 p-8 text-center">
      {!err ? (
        <>
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-100 border-t-brand-600" />
          <p className="font-semibold text-slate-800">Preparing today&apos;s lesson…</p>
          <p className="text-sm text-slate-500">We&apos;re creating fresh words, phrases and conversations for you. This takes a few seconds.</p>
        </>
      ) : (
        <><p className="font-semibold text-rose-700">{err}</p><button className="btn-secondary" onClick={() => location.reload()}>Try again</button></>
      )}
    </div>
  );
}
