"use client";

import { useEffect, useState } from "react";
import { clearGarage, removeFromGarage, useGarage } from "@/lib/garage";

interface Props {
  onReopen: (name: string, seed: number, len?: string) => void;
}

/** The visitor's last few circuits as chips, straight from localStorage. Renders nothing when empty. */
export default function Garage({ onReopen }: Props) {
  const entries = useGarage();
  const [confirming, setConfirming] = useState(false);

  // The inline "Clear N circuits?" question steps back on its own after a few seconds.
  useEffect(() => {
    if (!confirming) return;
    const t = setTimeout(() => setConfirming(false), 5000);
    return () => clearTimeout(t);
  }, [confirming]);

  if (entries.length === 0) return null;
  const n = entries.length;

  return (
    <section aria-label="Your garage" className="space-y-2">
      <div className="flex items-center justify-between gap-3 min-h-6">
        <h2 className="text-xs uppercase tracking-[0.25em] text-muted">Your garage</h2>
        {confirming ? (
          <p className="text-xs text-zinc-300 flex items-center gap-2" role="status">
            <span>
              Clear {n} circuit{n === 1 ? "" : "s"}?
            </span>
            <button
              onClick={() => {
                clearGarage();
                setConfirming(false);
              }}
              className="rounded-md border border-accent/60 text-accent hover:bg-accent hover:text-white px-2 py-0.5 font-semibold"
            >
              Yes, clear
            </button>
            <button onClick={() => setConfirming(false)} className="rounded-md border border-line text-muted hover:text-zinc-100 px-2 py-0.5">
              Keep
            </button>
          </p>
        ) : (
          <button onClick={() => setConfirming(true)} className="text-xs text-muted hover:text-zinc-100 underline-offset-2 hover:underline" aria-label="Clear your garage">
            Clear
          </button>
        )}
      </div>
      <ul className="flex flex-wrap gap-2">
        {entries.map((e) => (
          <li key={`${e.name}-${e.seed}-${e.len ?? ""}`} className="group relative">
            <button
              onClick={() => onReopen(e.name, e.seed, e.len)}
              className="flex items-center gap-3 rounded-xl border border-line bg-ink-2 hover:border-zinc-500 pl-3 pr-8 py-2 text-left"
              title={`Reopen ${e.name}`}
            >
              <span className="display text-2xl font-bold leading-none tracking-wide">{e.name}</span>
              <span className="text-[11px] text-muted leading-tight">
                <span className="block text-accent-2">
                  {e.grade} · {e.difficulty}/10
                </span>
                <span className="block tabular">{e.lapTime}</span>
              </span>
            </button>
            <button
              onClick={() => removeFromGarage(e.name, e.seed, e.len)}
              aria-label={`Remove ${e.name}`}
              title={`Remove ${e.name}`}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 grid size-6 place-items-center rounded-full text-muted hover:text-zinc-100 hover:bg-ink-3 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:focus-visible:opacity-100 transition-opacity"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
                <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
