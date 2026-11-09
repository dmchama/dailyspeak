import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function Landing() {
  if (await getCurrentUser()) redirect("/dashboard");
  const features = [
    ["📘", "5 words a day", "Practical vocabulary with IT and everyday examples, pronunciation and optional Sinhala meanings."],
    ["💬", "5 useful phrases", "Expressions fluent speakers use in stand-ups, code reviews and daily life."],
    ["🎭", "2 real conversations", "One IT workplace scene and one everyday scene, with audio and role-play."],
    ["🎙️", "Speak & get feedback", "Record your voice and get friendly feedback on grammar, structure, vocabulary and pronunciation."],
    ["🔁", "Smart revision", "Spaced repetition quizzes bring words back right before you forget them."],
    ["⏰", "Fresh lesson every day", "A new personalised lesson is ready every morning in your own timezone."],
  ];
  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50 via-white to-white">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <div className="flex items-center gap-2 font-bold"><img src="/icon.svg" className="h-8 w-8" alt="" /> DailySpeak</div>
        <Link href="/login" className="btn-ghost">Sign in</Link>
      </header>
      <section className="mx-auto max-w-3xl px-4 pt-10 pb-12 text-center">
        <span className="chip bg-brand-100 text-brand-700">English practice for IT professionals</span>
        <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">Speak English with confidence — <span className="text-brand-600">15 minutes a day</span>.</h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-slate-600">Real workplace English for software engineers, QA engineers, BAs and project managers. No boring grammar lessons — just small, practical daily practice.</p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/signup" className="btn-primary px-6! py-3! text-base!">Start for free</Link>
          <Link href="/login" className="btn-secondary px-6! py-3! text-base!">I have an account</Link>
        </div>
      </section>
      <section className="mx-auto grid max-w-5xl gap-4 px-4 pb-20 sm:grid-cols-2 lg:grid-cols-3">
        {features.map(([icon, title, text]) => (
          <div key={title} className="card p-5">
            <div className="text-2xl">{icon}</div>
            <h3 className="mt-2 font-bold text-slate-900">{title}</h3>
            <p className="mt-1 text-sm text-slate-600">{text}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
