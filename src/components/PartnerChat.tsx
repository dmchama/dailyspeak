"use client";
import { useEffect, useRef, useState } from "react";
import { speak, SpeakButton } from "./SpeakButton";

type Msg = { role: "partner" | "learner"; text: string; tip?: string; corrected?: string };
type Scenario = { id: string; title: string; role: string; opener: string };

type SR = { lang: string; continuous: boolean; interimResults: boolean; start(): void; stop(): void; onresult: ((e: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null };

export function PartnerChat({ scenarios, ai }: { scenarios: Scenario[]; ai: boolean }) {
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const srRef = useRef<SR | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [msgs]);

  function begin(s: Scenario) {
    setScenario(s);
    setMsgs([{ role: "partner", text: s.opener }]);
    if (voiceOn) speak(s.opener);
  }

  function listen() {
    const C = (window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => SR }).webkitSpeechRecognition;
    if (!C) { alert("Speech recognition isn't available in this browser. Please type your answer (Chrome or Edge support voice)."); return; }
    if (listening) { srRef.current?.stop(); return; }
    const sr = new C();
    sr.lang = "en-US"; sr.continuous = true; sr.interimResults = true;
    let base = input ? input + " " : "";
    sr.onresult = (e) => {
      let t = "";
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
      setInput(base + t);
    };
    sr.onend = () => { setListening(false); base = ""; };
    sr.onerror = () => setListening(false);
    sr.start();
    srRef.current = sr;
    setListening(true);
  }

  async function send() {
    const text = input.trim();
    if (!text || !scenario || busy) return;
    srRef.current?.stop();
    const history: Msg[] = [...msgs, { role: "learner", text }];
    setMsgs(history); setInput(""); setBusy(true);
    try {
      const r = await fetch("/api/partner", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario: scenario.id, history: history.map(({ role, text }) => ({ role, text })) }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setMsgs((m) => {
        const copy = [...m];
        copy[copy.length - 1] = { ...copy[copy.length - 1], tip: d.quickTip, corrected: d.corrected };
        return [...copy, { role: "partner", text: d.reply }];
      });
      if (voiceOn) speak(d.reply);
    } catch (e) {
      setMsgs((m) => [...m, { role: "partner", text: `(${(e as Error).message || "Connection problem"} — please try again.)` }]);
    } finally { setBusy(false); }
  }

  if (!scenario) {
    return (
      <section className="card p-4 sm:p-5 space-y-3">
        <h2 className="font-bold text-slate-900">🤖 Choose a conversation</h2>
        {!ai && <p className="text-xs text-slate-400">Running in guided mode. Add an OpenAI API key on the server for fully open AI conversations.</p>}
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {scenarios.map((s) => (
            <button key={s.id} onClick={() => begin(s)} className="rounded-xl border border-slate-200 bg-white p-3 text-left hover:border-brand-300 hover:bg-brand-50/40">
              <p className="font-semibold text-slate-900">{s.title}</p>
              <p className="text-xs text-slate-500">Partner: {s.role}</p>
            </button>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="card flex flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-100 p-3">
        <div>
          <p className="font-semibold text-slate-900">{scenario.title}</p>
          <p className="text-xs text-slate-500">Talking with {scenario.role}</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-xs text-slate-500"><input type="checkbox" checked={voiceOn} onChange={(e) => setVoiceOn(e.target.checked)} className="accent-brand-600" /> Voice</label>
          <button className="btn-ghost px-2! py-1! text-xs!" onClick={() => { setScenario(null); setMsgs([]); }}>Change</button>
        </div>
      </div>
      <div className="max-h-[55vh] min-h-[260px] space-y-3 overflow-y-auto bg-slate-50/60 p-3">
        {msgs.map((m, i) => (
          <div key={i} className={`flex flex-col ${m.role === "learner" ? "items-end" : "items-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm shadow-sm ${m.role === "learner" ? "bg-brand-600 text-white" : "bg-white text-slate-800 border border-slate-200"}`}>
              {m.text} {m.role === "partner" && <SpeakButton text={m.text} className="py-0!" />}
            </div>
            {m.role === "learner" && (m.corrected || m.tip) && (
              <div className="mt-1 max-w-[85%] rounded-xl bg-emerald-50 px-3 py-1.5 text-xs text-emerald-900 border border-emerald-100">
                {m.corrected && <p>💡 <b>More natural:</b> {m.corrected}</p>}
                {m.tip && <p className="opacity-80">{m.tip}</p>}
              </div>
            )}
          </div>
        ))}
        {busy && <p className="text-xs text-slate-400">typing…</p>}
        <div ref={endRef} />
      </div>
      <div className="flex items-end gap-2 border-t border-slate-100 p-3">
        <button onClick={listen} className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${listening ? "bg-rose-600 text-white animate-pulse" : "bg-brand-50 text-brand-700"}`} aria-label="Speak">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0M12 17v4" /></svg>
        </button>
        <textarea
          value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          rows={1} placeholder={listening ? "Listening… speak now" : "Tap the mic and speak, or type…"} className="input min-h-11 resize-none"
        />
        <button className="btn-primary h-11" onClick={send} disabled={busy || !input.trim()}>Send</button>
      </div>
    </section>
  );
}
