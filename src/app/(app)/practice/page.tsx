import { PARTNER_SCENARIOS } from "@/lib/ai/partner";
import { aiEnabled } from "@/lib/ai/openai";
import { PartnerChat } from "@/components/PartnerChat";
import { SpeechPractice } from "@/components/SpeechPractice";

export default function PracticePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Speaking practice</h1>
        <p className="text-sm text-slate-500">Talk with your AI conversation partner. Speak your answers — you&apos;ll get a quick tip after each one.</p>
      </div>
      <PartnerChat scenarios={PARTNER_SCENARIOS.map(({ id, title, role, opener }) => ({ id, title, role, opener }))} ai={aiEnabled()} />
      <section className="card p-4 sm:p-5 space-y-3">
        <h2 className="font-bold text-slate-900">🎤 Free speaking</h2>
        <p className="text-sm text-slate-500">Talk about anything — your day, your project, or a problem you solved — and get detailed feedback.</p>
        <SpeechPractice mode="answer" prompt="Free speaking practice" />
      </section>
    </div>
  );
}
