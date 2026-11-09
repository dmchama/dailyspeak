"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    const data = Object.fromEntries(new FormData(e.currentTarget));
    const r = await fetch(`/api/auth/${mode}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    const d = await r.json();
    setLoading(false);
    if (!r.ok) return setErr(d.error || "Something went wrong");
    router.push(d.next);
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-brand-50 to-white px-4">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-4 p-6">
        <Link href="/" className="flex items-center gap-2 font-bold"><img src="/icon.svg" className="h-8 w-8" alt="" /> DailySpeak</Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{mode === "login" ? "Welcome back 👋" : "Create your account"}</h1>
          <p className="text-sm text-slate-500">{mode === "login" ? "Continue your daily English practice." : "It takes less than a minute."}</p>
        </div>
        {mode === "signup" && (
          <div><label className="label" htmlFor="name">Your name</label><input id="name" name="name" className="input" required autoComplete="given-name" /></div>
        )}
        <div><label className="label" htmlFor="email">Email</label><input id="email" name="email" type="email" className="input" required autoComplete="email" /></div>
        <div><label className="label" htmlFor="password">Password</label><input id="password" name="password" type="password" className="input" required minLength={mode === "signup" ? 8 : 1} autoComplete={mode === "login" ? "current-password" : "new-password"} /></div>
        {err && <p className="rounded-lg bg-rose-50 p-2.5 text-sm text-rose-700">{err}</p>}
        <button className="btn-primary w-full py-3!" disabled={loading}>{loading ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}</button>
        <p className="text-center text-sm text-slate-500">
          {mode === "login" ? <>New here? <Link className="font-semibold text-brand-600" href="/signup">Create an account</Link></> : <>Already have an account? <Link className="font-semibold text-brand-600" href="/login">Sign in</Link></>}
        </p>
      </form>
    </div>
  );
}
