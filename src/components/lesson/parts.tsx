"use client";

export function SectionHeader({ id, title, subtitle, done }: { id: string; title: string; subtitle?: string; done: boolean }) {
  return (
    <div id={id} className="scroll-mt-44 flex items-start justify-between gap-3">
      <div>
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
      </div>
      {done && <span className="chip shrink-0 bg-emerald-50 text-emerald-700">✓ Done</span>}
    </div>
  );
}

export function DoneButton({ done, onDone, label = "Mark as done" }: { done: boolean; onDone: () => void; label?: string }) {
  return (
    <button type="button" onClick={onDone} disabled={done} className={done ? "btn bg-emerald-50 text-emerald-700" : "btn-primary"}>
      {done ? "✓ Completed" : label}
    </button>
  );
}
