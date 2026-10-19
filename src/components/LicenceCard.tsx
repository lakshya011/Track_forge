"use client";

import ShareMenu, { useImageShare } from "@/components/ShareMenu";
import { slug } from "@/lib/download";
import type { Homologation } from "@/lib/geo/homologation";
import { svgToPng } from "@/lib/geo/svg";
import type { Track } from "@/lib/geo/types";
import { DNA_COLORS, LICENCE_FORMAT_LABELS, buildLicenceCardSvg, type LicenceFormat } from "@/lib/poster/licence";

export { DNA_COLORS };

interface Props {
  track: Track;
  homologation: Homologation;
  /** Link that rebuilds this exact circuit. */
  shareUrl: string;
  year?: number;
  /** Embedded display @font-face so the shared PNG matches the page. */
  fontFace?: string;
}

export function challengeText(track: Track, h: Homologation): string {
  return `${track.name} is ${h.grade}, difficulty ${h.difficulty}/10 (${h.tags.join(", ").toLowerCase()}), ghost lap ${h.lapTime.formatted}. Beat it.`;
}

/** The reward: a licence card with grade, difficulty, character tags, DNA, ghost lap and badges. */
export default function LicenceCard({ track, homologation: h, shareUrl, year = new Date().getFullYear(), fontFace = "" }: Props) {
  const share = useImageShare();

  // Challenge a friend sends the card itself as a story-sized PNG with the dare and the link; the
  // small row underneath offers the other two sizes.
  const sendCard = (format: LicenceFormat) =>
    share.start({
      render: () => svgToPng(buildLicenceCardSvg(track, h, { format, fontFace, shareUrl, year }), 1),
      filename: `${slug(track.name)}-licence-${format}.png`,
      title: `${track.name} · Track Forge`,
      text: challengeText(track, h),
      url: shareUrl,
    });

  const button =
    share.status === "rendering" ? "Preparing the card…" : share.status === "shared" ? "Sent." : share.status === "copied" ? "Copied. Send it." : share.status === "failed" ? "Could not prepare the card" : "Challenge a friend";

  return (
    <article className="carbon relative rounded-3xl border border-line p-5 sm:p-6 shadow-2xl shadow-black/50" aria-label={`Licence card for ${track.name}`}>
      <div className="absolute inset-x-0 top-0 h-1.5 rounded-t-3xl bg-gradient-to-r from-accent via-accent-2 to-accent-3" />

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

      <div className="relative mt-6">
        <button
          type="button"
          onClick={() => sendCard("story")}
          disabled={share.status === "rendering"}
          aria-haspopup="dialog"
          aria-expanded={share.menu !== null}
          className="display w-full rounded-xl bg-zinc-100 text-zinc-900 hover:bg-white active:scale-[0.99] disabled:opacity-70 transition px-4 py-3 text-xl font-bold tracking-wide"
        >
          {button}
        </button>
        {share.menu && <ShareMenu image={share.menu} title={`${track.name}'s licence`} text={share.menu.text} url={share.menu.url} onClose={share.close} onCopied={() => share.flash("copied")} align="end" />}
      </div>
      <p className="mt-2 text-[11px] text-muted leading-snug">
        Sends the card as a picture with the dare and the link.
        <span className="whitespace-nowrap">
          {" "}
          Also as{" "}
          {(["square", "wide"] as const).map((f, i) => (
            <span key={f}>
              {i > 0 && " · "}
              <button type="button" onClick={() => sendCard(f)} disabled={share.status === "rendering"} title={LICENCE_FORMAT_LABELS[f].hint} className="underline decoration-dotted underline-offset-2 hover:text-zinc-100 disabled:opacity-60">
                {LICENCE_FORMAT_LABELS[f].label.toLowerCase()}
              </button>
            </span>
          ))}
          .
        </span>
      </p>
      <p className="mt-3 text-[10px] text-muted leading-snug">Fictional grade and lap time. Not an FIA document; unofficial fan project.</p>
    </article>
  );
}
