"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DOMAINS, GOALS, INTERESTS, LEVELS, PROFESSIONS, type Profile } from "@/lib/types";

type Values = Omit<Profile, "user_id" | "onboarded">;

const DEFAULTS: Values = {
  profession: "Software Engineer",
  domain: "software_development",
  level: "beginner",
  goal: GOALS[0],
  explanation_language: "english",
  daily_minutes: 15,
  preferred_time: "08:00",
  timezone: "Asia/Colombo",
  interests: [],
  notify_push: true,
  notify_email: true,
};

const PROFESSION_DOMAIN: Record<string, string> = {
  "QA Engineer": "quality_assurance",
  "Business Analyst": "business_analysis",
  "IT Project Manager": "project_management",
  "DevOps Engineer": "devops_cloud",
  "Data Engineer / Analyst": "data",
};

function Option({ active, onClick, title, hint }: { active: boolean; onClick: () => void; title: string; hint?: string }) {
  return (
    <button type="button" onClick={onClick} className={`w-full rounded-xl border p-3 text-left transition ${active ? "border-brand-500 bg-brand-50 ring-2 ring-brand-100" : "border-slate-200 bg-white hover:border-slate-300"}`}>
      <p className="font-semibold text-slate-900">{title}</p>
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </button>
  );
}

export function ProfileForm({ initial, variant }: { initial?: Partial<Values>; variant: "onboarding" | "settings" }) {
  const router = useRouter();
  const [v, setV] = useState<Values>({ ...DEFAULTS, ...initial });
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const set = <K extends keyof Values>(k: K, val: Values[K]) => setV((p) => ({ ...p, [k]: val }));

  useEffect(() => {
    if (variant === "onboarding") {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) setV((p) => ({ ...p, timezone: tz }));
    }
  }, [variant]);

  const timezones: string[] = (() => {
    try { return (Intl as unknown as { supportedValuesOf(k: string): string[] }).supportedValuesOf("timeZone"); } catch { return [v.timezone]; }
  })();

  async function save() {
    setSaving(true); setMsg("");
    const r = await fetch("/api/onboarding", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(v) });
    const d = await r.json();
    setSaving(false);
    if (!r.ok) return setMsg(d.error || "Could not save");
    if (variant === "onboarding") { router.push("/dashboard"); router.refresh(); }
    else { setMsg("Saved ✓"); router.refresh(); }
  }

  const steps = [
    {
      title: "What do you do?",
      sub: "We'll use vocabulary and conversations from your real work.",
      body: (
        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2">
            {PROFESSIONS.map((p) => (
              <Option key={p} title={p} active={v.profession === p} onClick={() => { set("profession", p); if (PROFESSION_DOMAIN[p]) set("domain", PROFESSION_DOMAIN[p]); }} />
            ))}
          </div>
          <div>
            <label className="label">Professional domain</label>
            <select className="input" value={v.domain} onChange={(e) => set("domain", e.target.value)}>
              {DOMAINS.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
            <p className="mt-1 text-xs text-slate-500">Topics: {DOMAINS.find((d) => d.id === v.domain)?.topics}</p>
          </div>
        </div>
      ),
    },
    {
      title: "What is your English level?",
      sub: "Don't worry — lessons get a little more challenging as you improve.",
      body: <div className="space-y-2">{LEVELS.map((l) => <Option key={l.id} title={l.label} hint={l.hint} active={v.level === l.id} onClick={() => set("level", l.id)} />)}</div>,
    },
    {
      title: "What is your main goal?",
      sub: "Pick one goal and a few interests for everyday conversations.",
      body: (
        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2">{GOALS.map((g) => <Option key={g} title={g} active={v.goal === g} onClick={() => set("goal", g)} />)}</div>
          <div>
            <label className="label">Interests (optional)</label>
            <div className="flex flex-wrap gap-2">
              {INTERESTS.map((i) => {
                const on = v.interests.includes(i);
                return <button type="button" key={i} onClick={() => set("interests", on ? v.interests.filter((x) => x !== i) : [...v.interests, i])} className={`chip px-3! py-1.5! ${on ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-700"}`}>{i}</button>;
              })}
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "How should we explain things?",
      sub: "Choose your explanation language and how long you want to practise each day.",
      body: (
        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <Option title="English only" hint="Simple English explanations" active={v.explanation_language === "english"} onClick={() => set("explanation_language", "english")} />
            <Option title="English + සිංහල" hint="Show Sinhala meanings for words and phrases" active={v.explanation_language === "english_sinhala"} onClick={() => set("explanation_language", "english_sinhala")} />
          </div>
          <div>
            <label className="label">Daily practice time</label>
            <div className="grid grid-cols-4 gap-2">
              {[10, 15, 20, 30].map((m) => <Option key={m} title={`${m} min`} active={v.daily_minutes === m} onClick={() => set("daily_minutes", m)} />)}
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "When should we remind you?",
      sub: "A fresh lesson is created every day. We'll notify you at your preferred time.",
      body: (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="label">Preferred learning time</label><input type="time" className="input" value={v.preferred_time} onChange={(e) => set("preferred_time", e.target.value)} /></div>
            <div>
              <label className="label">Your timezone</label>
              <select className="input" value={v.timezone} onChange={(e) => set("timezone", e.target.value)}>
                {(timezones.includes(v.timezone) ? timezones : [v.timezone, ...timezones]).map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
            <input type="checkbox" className="h-5 w-5 accent-brand-600" checked={v.notify_push} onChange={(e) => set("notify_push", e.target.checked)} />
            <span><b className="text-slate-900">Push notifications</b><span className="block text-xs text-slate-500">Browser / phone notification when your lesson is ready</span></span>
          </label>
          <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
            <input type="checkbox" className="h-5 w-5 accent-brand-600" checked={v.notify_email} onChange={(e) => set("notify_email", e.target.checked)} />
            <span><b className="text-slate-900">Email reminder</b><span className="block text-xs text-slate-500">A short daily email with today&apos;s words</span></span>
          </label>
        </div>
      ),
    },
  ];

  if (variant === "settings") {
    return (
      <div className="space-y-6">
        {steps.map((s) => (
          <section key={s.title} className="card p-4 sm:p-5">
            <h2 className="font-bold text-slate-900">{s.title}</h2>
            <p className="mb-3 text-sm text-slate-500">{s.sub}</p>
            {s.body}
          </section>
        ))}
        <div className="sticky bottom-20 md:bottom-4 flex items-center gap-3">
          <button className="btn-primary px-6!" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save settings"}</button>
          {msg && <span className="text-sm text-slate-600">{msg}</span>}
        </div>
      </div>
    );
  }

  const s = steps[step];
  return (
    <div className="space-y-5">
      <div className="flex gap-1.5">{steps.map((_, i) => <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-brand-600" : "bg-slate-200"}`} />)}</div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Step {step + 1} of {steps.length}</p>
        <h1 className="text-2xl font-bold text-slate-900">{s.title}</h1>
        <p className="text-sm text-slate-500">{s.sub}</p>
      </div>
      {s.body}
      {msg && <p className="rounded-lg bg-rose-50 p-2.5 text-sm text-rose-700">{msg}</p>}
      <div className="flex justify-between">
        <button type="button" className="btn-ghost" onClick={() => setStep(step - 1)} disabled={step === 0}>Back</button>
        {step < steps.length - 1 ? (
          <button type="button" className="btn-primary px-6!" onClick={() => setStep(step + 1)}>Continue</button>
        ) : (
          <button type="button" className="btn-primary px-6!" onClick={save} disabled={saving}>{saving ? "Creating your first lesson…" : "Start learning 🚀"}</button>
        )}
      </div>
    </div>
  );
}
