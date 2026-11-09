import Link from "next/link";
import { NavLinks } from "./NavLinks";

export function AppShell({ children, unread }: { children: React.ReactNode; unread: number }) {
  return (
    <div className="min-h-screen pb-24 md:pb-10">
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Link href="/dashboard" className="flex items-center gap-2 font-bold text-slate-900">
            <img src="/icon.svg" alt="" className="h-7 w-7" />
            <span>DailySpeak</span>
          </Link>
          <NavLinks variant="top" />
          <Link href="/settings" className="relative rounded-full p-2 text-slate-500 hover:bg-slate-100" aria-label="Settings and notifications">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
            {unread > 0 && <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-white" />}
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-5">{children}</main>
      <NavLinks variant="bottom" />
    </div>
  );
}
