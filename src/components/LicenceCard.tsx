"use client";

import { useState } from "react";
import type { Homologation } from "@/lib/geo/homologation";
import type { Track } from "@/lib/geo/types";

interface Props {
  track: Track;
  homologation: Homologation;
  /** Link that rebuilds this exact circuit. */
  shareUrl: string;
  year?: number;
}

export const DNA_COLORS = ["#e8322e", "#3dd68c", "#f5c542", "#60a5fa", "#c084fc", "#fb923c", "#2dd4bf", "#f472b6"] as const;

/** Copy with the Clipboard API when allowed, else the legacy selection route. Returns success. */
function copyText(text: string): boolean {
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    if (ok) {
      // Best effort: the async API may still succeed and is preferred when it does.
      navigator.clipboard?.writeText(text).catch(() => undefined);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    void navigator.clipboard?.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function challengeText(track: Track, h: Homologation): string {
  return `${track.name} is ${h.grade}, difficulty ${h.difficulty}/10 (${h.tags.join(", ").toLowerCase()}), ghost lap ${h.lapTime.formatted}. Beat it.`;
}

/** The reward: a licence card with grade, difficulty, character tags, DNA, ghost lap and badges. */
export default function LicenceCard({ track, homologation: h, shareUrl, year = new Date().getFullYear() }: Props) {
  const [shared, setShared] = useState<"idle" | "copied" | "shared" | "failed">("idle");

  const challenge = async () => {
    const text = challengeText(track, h);
    const payload = `${text} ${shareUrl}`;
    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share({ title: `${track.name} · Track Forge`, text, url: shareUrl });
        setShared("shared");
      } else {
        setShared(copyText(payload) ? "copied" : "failed");
      }
    } catch (e) {
      // An aborted share sheet is not a failure; anything else falls back to the clipboard.
      if (e instanceof DOMException && e.name === "AbortError") return;
      setShared(copyText(payload) ? "copied" : "failed");
    }
    setTimeout(() => setShared("idle"), 2600);
  };

  return (
    <article className="carbon relative rounded-3xl border border-line p-5 sm:p-6 shadow-2xl shadow-black/50 overflow-hidden" aria-label={`Licence card for ${track.name}`}>
      <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-accent via-accent-2 to-accent-3" />

      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-muted">Track Forge · Circuit licence</p>
          <h2 className="display text-4xl sm:text-5xl font-extrabold tracking-wide leading-none mt-1 break-words">{track.name}</h2>
          <p className="text-xs text-muted mt-1 tabular">No. {h.licence} · Homologated {year}</p>
        </div>
        <div className="shrink-0 -rotate-6 grid place-items-center size-20 rounded-full border-[3px] border-accent text-accent" aria-label={`${h.grade}`}>
          <div className="size-[66px] rounded-full border border-accent grid place-items-center text-center leading-none">
            <div>
              <div className="text-[8px] tracking-[0.2em] font-bold">GRADE</div>
              <div className="display text-3xl font-extrabold">{h.grade.replace(/\D/g, "") || "1"}</div>
            </div>
          </div>
        </div>
      </header>

      <section className="mt-5">
        <div className="flex items-baseline justify-between">
          <h3 className="text-[10px] uppercase tracking-[0.25em] text-muted">Difficulty</h3>
          <span className="display text-2xl font-bold leading-none">
            {h.difficulty}
            <span className="text-muted text-base">/10</span>
          </span>
        </div>
        <div className="mt-1.5 grid grid-cols-10 gap-1" role="meter" aria-valuemin={1} aria-valuemax={10} aria-valuenow={h.difficulty} aria-label="Difficulty">
          {Array.from({ length: 10 }, (_, i) => (
            <span
              key={i}
              className="h-2.5 rounded-sm"
              style={{
                background: i < h.difficulty ? (i < 4 ? "#3dd68c" : i < 7 ? "#f5c542" : "#e8322e") : "#26262e",
              }}
            />
          ))}
        </div>
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {h.tags.map((t) => (
            <li key={t} className="display text-sm font-semibold tracking-wide rounded-full border border-line bg-ink-3/80 px-2.5 py-0.5">
              {t}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-5">
        <h3 className="text-[10px] uppercase tracking-[0.25em] text-muted">Circuit DNA</h3>
        <div className="mt-1.5 flex h-3 w-full overflow-hidden rounded-full bg-ink-3" aria-hidden>
          {h.dna.map((d, i) => (
            <span key={d.country} style={{ width: `${d.share * 100}%`, background: DNA_COLORS[i % DNA_COLORS.length] }} />
          ))}
        </div>
        <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
          {h.dna.map((d, i) => (
            <li key={d.country} className="flex items-center gap-2 min-w-0">
              <span className="size-2 rounded-full shrink-0" style={{ background: DNA_COLORS[i % DNA_COLORS.length] }} />
              <span className="font-semibold">{d.country}</span>
              <span className="text-muted truncate">
                {Math.round(d.share * 100)}% · {d.letters.join("")}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-5 flex items-end justify-between gap-3 rounded-2xl border border-line bg-ink/60 px-4 py-3">
        <div>
          <h3 className="text-[10px] uppercase tracking-[0.25em] text-muted">Ghost lap</h3>
          <p className="text-[11px] text-muted">Model time at 215 km/h flat out. Fictional.</p>
        </div>
        <p className="display text-4xl font-extrabold leading-none tabular text-accent-2">{h.lapTime.formatted}</p>
      </section>

      {h.badges.length > 0 && (
        <section className="mt-5">
          <h3 className="text-[10px] uppercase tracking-[0.25em] text-muted">Rarity</h3>
          <ul className="mt-1.5 space-y-1.5">
            {h.badges.map((b) => (
              <li key={b.id} className="flex items-start gap-2.5 text-xs">
                <span className="display mt-0.5 shrink-0 rounded-md bg-accent-2/15 border border-accent-2/40 text-accent-2 px-1.5 py-0.5 text-[11px] font-bold tracking-wide uppercase">{b.label}</span>
                <span className="text-muted leading-snug">{b.detail}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <button
        onClick={challenge}
        className="display mt-6 w-full rounded-xl bg-zinc-100 text-zinc-900 hover:bg-white active:scale-[0.99] transition px-4 py-3 text-xl font-bold tracking-wide"
      >
        {shared === "copied" ? "Copied. Send it." : shared === "shared" ? "Sent." : shared === "failed" ? "Copy this by hand" : "Challenge a friend"}
      </button>
      {shared === "failed" && (
        <textarea readOnly value={`${challengeText(track, h)} ${shareUrl}`} onFocus={(e) => e.currentTarget.select()} rows={3} className="mt-2 w-full rounded-lg border border-line bg-ink/60 p-2 text-xs text-zinc-200" aria-label="Challenge text" />
      )}
      <p className="mt-3 text-[10px] text-muted leading-snug">Fictional grade and lap time. Not an FIA document; unofficial fan project.</p>
    </article>
  );
}
