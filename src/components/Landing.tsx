"use client";

import { useState } from "react";
import Garage from "@/components/Garage";
import { MAX_NAME_LENGTH, sanitizeName } from "@/lib/geo";

interface Props {
  initialName?: string;
  onSubmit: (name: string) => void;
  onReopen: (name: string, seed: number, len?: string) => void;
  error?: string | null;
}

const EXAMPLES = ["LEWIS", "AYRTON", "NIKI"];

/** Pit-wall hero: one giant input and a submit-for-homologation button. */
export default function Landing({ initialName = "", onSubmit, onReopen, error }: Props) {
  const [input, setInput] = useState(initialName);
  const [localError, setLocalError] = useState<string | null>(null);

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const name = sanitizeName(input);
    if (!name) {
      setLocalError("Type at least one letter A–Z.");
      return;
    }
    setLocalError(null);
    onSubmit(name);
  };

  return (
    <section className="space-y-10">
      <div className="space-y-4">
        <p className="text-xs uppercase tracking-[0.3em] text-accent">Circuit homologation office</p>
        <h1 className="display text-5xl sm:text-7xl lg:text-8xl font-extrabold leading-[0.92] tracking-tight max-w-4xl">
          Submit a name.
          <br />
          Get a <span className="text-accent">licensed</span> Grand Prix circuit.
        </h1>
        <p className="text-muted max-w-2xl text-base sm:text-lg">
          Every letter is a real stretch of a real circuit: La Source at Spa reads as an A, the Parabolica as a J. We stitch them into one lap,
          inspect it, and hand you a licence card with a grade, a difficulty score and a ghost lap to dare your friends with.
        </p>
      </div>

      <form onSubmit={submit} className="carbon rounded-3xl border border-line p-5 sm:p-8 shadow-2xl shadow-black/40">
        <label className="block">
          <span className="text-xs uppercase tracking-[0.25em] text-muted">Circuit name</span>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value.toUpperCase())}
            placeholder="YOUR NAME"
            maxLength={MAX_NAME_LENGTH}
            autoFocus
            autoComplete="off"
            spellCheck={false}
            aria-label="Circuit name"
            className="display mt-2 w-full bg-transparent border-b-2 border-line focus:border-accent outline-none text-5xl sm:text-7xl font-bold tracking-[0.08em] py-2 placeholder:text-zinc-700 caret-accent"
          />
        </label>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button type="submit" className="display rounded-xl bg-accent hover:bg-red-500 active:scale-[0.98] transition px-7 py-3.5 text-2xl font-bold tracking-wide shadow-lg shadow-red-950/40">
            Submit for homologation
          </button>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
            <span className="hidden sm:inline">or try</span>
            {EXAMPLES.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => {
                  setInput(n);
                  onSubmit(n);
                }}
                className="display rounded-full border border-line bg-ink-3/80 hover:border-zinc-500 hover:text-zinc-100 px-3.5 py-1.5 text-lg font-semibold tracking-wide"
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        {(localError ?? error) && <p className="mt-3 text-sm text-red-400">{localError ?? error}</p>}
        <p className="mt-4 text-xs text-muted">
          Letters A–Z and spaces, up to {MAX_NAME_LENGTH} characters. Lap length follows the name: one letter laps like Monaco, eleven like Spa.
        </p>
      </form>

      <Garage onReopen={onReopen} />

      <dl className="grid grid-cols-3 gap-3 sm:gap-4 text-center">
        {[
          ["26", "letters, each a real stretch of track"],
          ["94", "curated sections to draw from"],
          ["40", "circuits, from Monza 1922 to Madrid 2026"],
        ].map(([n, label]) => (
          <div key={label} className="rounded-2xl border border-line bg-ink-2/60 px-3 py-4">
            <dt className="display text-4xl sm:text-5xl font-extrabold leading-none">{n}</dt>
            <dd className="text-[11px] sm:text-xs text-muted mt-1.5 leading-snug">{label}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
