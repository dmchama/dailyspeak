import Link from "next/link";

export function LibraryTabs({ active }: { active: "vocabulary" | "phrases" | "history" }) {
  const tabs = [
    { id: "vocabulary", href: "/vocabulary", label: "📘 Words" },
    { id: "phrases", href: "/phrases", label: "💬 Phrases" },
    { id: "history", href: "/history", label: "🗓️ Lessons" },
  ];
  return (
    <div className="inline-flex rounded-xl bg-slate-100 p-1 text-sm">
      {tabs.map((t) => (
        <Link key={t.id} href={t.href} className={`rounded-lg px-3 py-1.5 font-medium ${active === t.id ? "bg-white shadow-sm text-slate-900" : "text-slate-600"}`}>{t.label}</Link>
      ))}
    </div>
  );
}
