"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ICONS: Record<string, React.ReactNode> = {
  home: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  lesson: <><path d="M4 19.5V5a2 2 0 0 1 2-2h14v16H6a2 2 0 0 0-2 2" /><path d="M8 7h8M8 11h6" /></>,
  practice: <><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0M12 17v4" /></>,
  review: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></>,
  library: <><path d="M4 4h4v16H4zM10 4h4v16h-4z" /><path d="m16 5 3.5-1 3 15.5-3.5 1z" /></>,
  progress: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
};

const LINKS = [
  { href: "/dashboard", label: "Home", icon: "home" },
  { href: "/lesson/today", label: "Lesson", icon: "lesson", match: "/lesson" },
  { href: "/practice", label: "Speak", icon: "practice" },
  { href: "/review", label: "Review", icon: "review" },
  { href: "/vocabulary", label: "Library", icon: "library", alsoMatch: ["/phrases", "/history"] },
  { href: "/progress", label: "Progress", icon: "progress" },
];

export function NavLinks({ variant }: { variant: "top" | "bottom" }) {
  const path = usePathname();
  const active = (l: (typeof LINKS)[number]) =>
    path.startsWith(l.match ?? l.href) || (l.alsoMatch ?? []).some((m) => path.startsWith(m));

  if (variant === "top")
    return (
      <nav className="hidden items-center gap-1 md:flex">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${active(l) ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100"}`}>
            {l.label}
          </Link>
        ))}
      </nav>
    );

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur md:hidden">
      <div className="mx-auto grid max-w-lg grid-cols-6 pb-[env(safe-area-inset-bottom)]">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${active(l) ? "text-brand-600" : "text-slate-500"}`}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{ICONS[l.icon]}</svg>
            {l.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
