"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function NotificationTools({ vapidReady }: { vapidReady: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<"unsupported" | "off" | "on" | "denied" | "loading">("loading");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) return setState("unsupported");
      if (Notification.permission === "denied") return setState("denied");
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setState(sub ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, []);

  async function enable() {
    setMsg("");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return setState(perm === "denied" ? "denied" : "off");
      const { publicKey } = await (await fetch("/api/push/subscribe")).json();
      if (!publicKey) return setMsg("Push is not configured on the server (VAPID keys missing).");
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });
      const r = await fetch("/api/push/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sub.toJSON()) });
      if (!r.ok) throw new Error((await r.json()).error);
      setState("on");
      setMsg("Push notifications enabled on this device ✓");
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  async function disable() {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await fetch("/api/push/subscribe", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
      await sub.unsubscribe();
    }
    setState("off");
  }

  async function test() {
    setMsg("Sending…");
    const r = await fetch("/api/notifications/test", { method: "POST" });
    const d = await r.json();
    setMsg(Object.entries(d.results ?? {}).map(([k, v]) => `${k}: ${(v as { status: string; detail: string }).status} (${(v as { detail: string }).detail})`).join(" · ") || "No channels enabled.");
    router.refresh();
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <section className="card p-4 sm:p-5 space-y-3">
      <h2 className="font-bold text-slate-900">Notifications on this device</h2>
      <div className="flex flex-wrap items-center gap-2">
        {state === "on" && <><span className="chip bg-emerald-50 text-emerald-700">Push enabled</span><button className="btn-secondary" onClick={disable}>Turn off</button></>}
        {state === "off" && <button className="btn-primary" onClick={enable} disabled={!vapidReady}>🔔 Enable push notifications</button>}
        {state === "denied" && <span className="text-sm text-amber-700">Notifications are blocked in your browser settings.</span>}
        {state === "unsupported" && <span className="text-sm text-slate-500">Push isn&apos;t supported in this browser. On iPhone, add DailySpeak to your Home Screen first.</span>}
        <button className="btn-secondary" onClick={test}>Send test notification</button>
        <button className="btn-ghost ml-auto" onClick={logout}>Sign out</button>
      </div>
      {!vapidReady && <p className="text-xs text-slate-400">Server push keys are not configured (run <code>npm run vapid</code>).</p>}
      {msg && <p className="text-sm text-slate-600 break-words">{msg}</p>}
    </section>
  );
}
