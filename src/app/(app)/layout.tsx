import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { requireUser } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { getProfile } from "@/lib/lessons/context";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const profile = await getProfile(user.id);
  if (!profile?.onboarded) redirect("/onboarding");
  const unread = await queryOne<{ n: string }>(
    "SELECT count(*) AS n FROM notifications WHERE user_id=$1 AND channel='in_app' AND read_at IS NULL",
    [user.id],
  );
  return <AppShell unread={Number(unread?.n ?? 0)}>{children}</AppShell>;
}
