import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { getProfile } from "@/lib/lessons/context";
import { pushConfigured } from "@/lib/notify";
import { ProfileForm } from "@/components/ProfileForm";
import { NotificationTools } from "@/components/NotificationTools";
import { toIsoDate } from "@/lib/time";

export default async function SettingsPage() {
  const user = await requireUser();
  const profile = (await getProfile(user.id))!;
  const log = await query<{ lesson_date: Date; channel: string; status: string; detail: string | null; created_at: Date }>(
    "SELECT lesson_date, channel, status, detail, created_at FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 9",
    [user.id],
  );
  const { user_id: _u, onboarded: _o, ...initial } = profile;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500">Signed in as {user.email}</p>
      </div>
      <NotificationTools vapidReady={pushConfigured()} />
      {log.length > 0 && (
        <section className="card p-4 sm:p-5">
          <h2 className="font-bold text-slate-900 mb-2">Recent notifications</h2>
          <ul className="divide-y divide-slate-100 text-sm">
            {log.map((n, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2 py-2">
                <span className="w-24 text-slate-500">{toIsoDate(n.lesson_date)}</span>
                <span className="chip bg-slate-100 text-slate-700">{n.channel}</span>
                <span className={`chip ${n.status === "sent" ? "bg-emerald-50 text-emerald-700" : n.status === "failed" ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-600"}`}>{n.status}</span>
                <span className="flex-1 truncate text-xs text-slate-400">{n.detail}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <ProfileForm variant="settings" initial={initial} />
    </div>
  );
}
