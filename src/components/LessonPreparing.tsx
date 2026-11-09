"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/** Shown while today's lesson is being generated; asks the server to ensure it exists, then refreshes. */
export function LessonPreparing() {
  const router = useRouter();
  const [err, setErr] = useState("");
  useEffect(() => {
    let cancelled = false;
    fetch("/api/lessons/today", { method: "POST" })
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error);
        if (!cancelled) router.refresh();
      })
      .catch((e) => setErr(e.message || "Could not prepare the lesson"));
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
