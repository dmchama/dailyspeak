"use client";
import { useRouter } from "next/navigation";

export function MarkNotificationsRead() {
  const router = useRouter();
  return (
    <button
      className="text-xs font-semibold text-brand-700 hover:underline"
      onClick={async () => {
        await fetch("/api/notifications/read", { method: "POST" });
        router.refresh();
      }}
    >
      Dismiss
    </button>
  );
}
