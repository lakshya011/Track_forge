"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import ShareMenu, { useImageShare } from "@/components/ShareMenu";
import { downloadBlob, slug } from "@/lib/download";
import type { Homologation } from "@/lib/geo/homologation";
import { svgToPng } from "@/lib/geo/svg";
import type { Circuit, Track } from "@/lib/geo/types";
import { POSTER_RATIOS, POSTER_STYLES, RATIO_LABELS, STYLES, buildPoster, exportScale, posterSize, type PosterRatio, type PosterStyle, type Wood } from "@/lib/poster";
import { buildCartography } from "@/lib/poster/cartography";
import { TEAMS, TEAM_IDS, defaultTeamId, isTeamId, type TeamId } from "@/lib/poster/teams";
import { setPosterPrefs, usePosterPrefs } from "@/lib/posterPrefs";
import { POSTER_SHARE_LINE } from "@/lib/share";

interface Props {
  track: Track;
  homologation: Homologation;
  lengthCircuit: Circuit | undefined;
  year?: number;
  style: PosterStyle;
  ratio: PosterRatio;
  /** Team livery from the link; null means the remembered or default team. */
  team: TeamId | null;
  /** The link that rebuilds this circuit; printed on every poster as a QR code and short link. */
  shareUrl: string;
  /** Embedded display @font-face so exports and thumbnails match the page. */
  fontFace: string;
  onStyle: (s: PosterStyle) => void;
  onRatio: (r: PosterRatio) => void;
  onTeam: (t: TeamId) => void;
}

const WOOD_SWATCH: Record<Wood, { label: string; color: string }> = {
  oak: { label: "Oak", color: "#d6b88a" },
  walnut: { label: "Walnut", color: "#64432a" },
  black: { label: "Black", color: "#1d1b19" },
};

const noop = () => () => {};
/** False during server rendering and hydration, true once the component is live in the browser. */
const useMounted = () => useSyncExternalStore(noop, () => true, () => false);

/** A blob: URL for an SVG string, revoked when it changes. */
function useSvgUrl(svg: string, enabled: boolean): string {
  const url = useMemo(() => (enabled ? URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" })) : ""), [svg, enabled]);
  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);
  return url;
}

/** Four live poster styles to pick from, a ratio switch, per-style options (wood, team livery, map details) and the export buttons. */
export default function PosterGallery({ track, homologation, lengthCircuit, year, style, ratio, team, shareUrl, fontFace, onStyle, onRatio, onTeam }: Props) {
  const mounted = useMounted();
  const prefs = usePosterPrefs();
  const [busy, setBusy] = useState<"png" | "svg" | null>(null);
  const share = useImageShare();

  const cartography = useMemo(() => buildCartography(track), [track]);
  const lengthReference = lengthCircuit ? `${lengthCircuit.name} · ${(lengthCircuit.length / 1000).toFixed(3)} km` : undefined;
  // The link wins, then the browser's remembered pick, then the circuit's own default team.
  const teamId: TeamId = team ?? (isTeamId(prefs.team) ? prefs.team : defaultTeamId(track.name, track.seed));

  const svgs = useMemo(() => {
    const meta = { homologation, homologatedYear: year, lengthReference, fontFace, cartography, shareUrl: shareUrl || undefined };
    const options = { ...prefs, team: teamId };
    return Object.fromEntries(POSTER_STYLES.map((s) => [s, buildPoster(track, { style: s, ratio, options }, meta)])) as Record<PosterStyle, string>;
  }, [track, homologation, year, lengthReference, fontFace, cartography, ratio, prefs, teamId, shareUrl]);

  const svg = svgs[style];
  const previewUrl = useSvgUrl(svg, mounted);
  const size = posterSize(ratio);
  const scale = exportScale(ratio);
  const pngW = size.width * scale;
  const pngH = size.height * scale;

  const exportPng = async () => {
    setBusy("png");
    try {
      const blob = await svgToPng(svg, scale);
      downloadBlob(blob, `${slug(track.name)}-${style}-poster.png`);
    } finally {
      setBusy(null);
    }
  };
  const exportSvg = () => {
    setBusy("svg");
    downloadBlob(new Blob([svg], { type: "image/svg+xml" }), `${slug(track.name)}-${style}-poster.svg`);
    setBusy(null);
  };
  // Shared copies go out at the sheet's own size (1200 wide): plenty for a feed or a story, and a
  // quarter of the download's bytes.
  const sharePoster = () =>
    share.start({
      render: () => svgToPng(svg, 1),
      filename: `${slug(track.name)}-${style}-poster.png`,
      title: `${track.name} · Track Forge`,
      text: POSTER_SHARE_LINE,
      url: shareUrl,
    });
  const shareLabel = share.status === "rendering" ? "Preparing…" : share.status === "shared" ? "Sent." : share.status === "copied" ? "Copied." : share.status === "failed" ? "Could not prepare" : "Share";

  const aspect = `${size.width} / ${size.height}`;

  return (
    <div className="space-y-5">
      <div role="radiogroup" aria-label="Poster style" className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {POSTER_STYLES.map((s) => {
          const def = STYLES[s];
          const selected = s === style;
          return (
            <button
              key={s}
              role="radio"
              aria-checked={selected}
              onClick={() => onStyle(s)}
              className={`group text-left rounded-xl border p-2 transition ${selected ? "border-accent ring-2 ring-accent/40 bg-ink-3" : "border-line bg-ink-2 hover:border-zinc-500"}`}
            >
              <div className="rounded-lg overflow-hidden bg-zinc-800" style={{ aspectRatio: aspect }}>
                {mounted ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgs[s])}`} alt="" className="w-full h-full block object-cover" loading="lazy" decoding="async" />
                ) : null}
              </div>
              <div className="mt-2 px-0.5">
                <div className={`display text-lg font-bold leading-none ${selected ? "text-zinc-50" : "text-zinc-200"}`}>{def.name}</div>
                <div className="text-[11px] text-muted leading-snug mt-1">{def.hint}</div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid md:grid-cols-[minmax(0,1fr)_260px] gap-6 items-start">
        <div className="rounded-xl overflow-hidden border border-line shadow-2xl bg-zinc-900 max-w-[560px] mx-auto w-full" style={{ aspectRatio: aspect }}>
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt={`${STYLES[style].name} poster of the ${track.name} circuit`} className="w-full h-full block" />
          ) : null}
        </div>

        <div className="space-y-4">
          <div>
            <h3 className="display text-2xl font-bold">{STYLES[style].name}</h3>
            <p className="text-sm text-muted">{STYLES[style].hint}.</p>
          </div>

          <fieldset>
            <legend className="text-xs uppercase tracking-[0.2em] text-muted mb-1.5">Ratio</legend>
            <div className="flex rounded-lg border border-line bg-ink-2 p-0.5 w-fit" role="radiogroup" aria-label="Poster ratio">
              {POSTER_RATIOS.map((r) => (
                <button key={r} role="radio" aria-checked={r === ratio} title={RATIO_LABELS[r].hint} onClick={() => onRatio(r)} className={`px-3 py-1 text-sm rounded-md ${r === ratio ? "bg-zinc-100 text-zinc-900 font-semibold" : "text-muted hover:text-zinc-100"}`}>
                  {RATIO_LABELS[r].label}
                  <span className="sr-only"> {RATIO_LABELS[r].hint}</span>
                </button>
              ))}
            </div>
          </fieldset>

          {style === "engraved" && (
            <fieldset>
              <legend className="text-xs uppercase tracking-[0.2em] text-muted mb-1.5">Wood</legend>
              <div className="flex gap-2" role="radiogroup" aria-label="Wood">
                {(Object.keys(WOOD_SWATCH) as Wood[]).map((w) => (
                  <button
                    key={w}
                    role="radio"
                    aria-checked={prefs.wood === w}
                    onClick={() => setPosterPrefs({ wood: w })}
                    className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm ${prefs.wood === w ? "border-accent bg-ink-3" : "border-line bg-ink-2 hover:border-zinc-500"}`}
                  >
                    <span className="size-4 rounded-full border border-black/40" style={{ background: WOOD_SWATCH[w].color }} aria-hidden />
                    {WOOD_SWATCH[w].label}
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          {style === "teamcar" && (
            <fieldset>
              <legend className="text-xs uppercase tracking-[0.2em] text-muted mb-1.5">
                Team livery <span className="normal-case tracking-normal text-zinc-300">· {TEAMS[teamId].name}</span>
              </legend>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Team livery">
                {TEAM_IDS.map((id) => {
                  const t = TEAMS[id];
                  const selected = id === teamId;
                  return (
                    <button
                      key={id}
                      role="radio"
                      aria-checked={selected}
                      aria-label={t.name}
                      title={t.name}
                      onClick={() => {
                        setPosterPrefs({ team: id });
                        onTeam(id);
                      }}
                      className={`size-9 rounded-full overflow-hidden border-2 transition ${selected ? "border-accent ring-2 ring-accent/40 scale-110" : "border-line hover:border-zinc-400"}`}
                    >
                      <span className="flex h-full w-full" aria-hidden>
                        <span className="flex-1" style={{ background: t.c1 }} />
                        <span className="flex-1" style={{ background: t.c2 }} />
                        <span className="flex-1" style={{ background: t.c3 }} />
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}

          {style === "cartographic" && (
            <fieldset className="space-y-1.5">
              <legend className="text-xs uppercase tracking-[0.2em] text-muted mb-1.5">Map details</legend>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={prefs.northArrow} onChange={(e) => setPosterPrefs({ northArrow: e.target.checked })} className="accent-[var(--accent)]" />
                North arrow
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={prefs.coordinates} onChange={(e) => setPosterPrefs({ coordinates: e.target.checked })} className="accent-[var(--accent)]" />
                Coordinates <span className="text-muted text-xs">(fictional)</span>
              </label>
            </fieldset>
          )}

          <div className="space-y-2 pt-1">
            <button onClick={exportPng} disabled={busy !== null} className="w-full rounded-lg bg-accent hover:bg-red-500 disabled:opacity-50 px-4 py-3 font-semibold">
              {busy === "png" ? "Rendering…" : `Download PNG (${pngW} × ${pngH})`}
            </button>
            <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                <button
                  type="button"
                  onClick={sharePoster}
                  disabled={share.status === "rendering" || !mounted}
                  aria-haspopup="dialog"
                  aria-expanded={share.menu !== null}
                  title="Share this poster to WhatsApp, Instagram stories, X and more"
                  className="w-full rounded-lg border border-line bg-ink-2 hover:bg-ink-3 disabled:opacity-50 px-3 py-3 text-sm font-semibold flex items-center justify-center gap-2"
                >
                  <svg className="size-4 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
                    <path d="M8 10V2.5m0 0L5.5 5M8 2.5 10.5 5M3.5 8.5v4a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1v-4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="truncate">{shareLabel}</span>
                </button>
                {share.menu && <ShareMenu image={share.menu} title={`the ${STYLES[style].name.toLowerCase()} poster`} text={share.menu.text} url={share.menu.url} onClose={share.close} onCopied={() => share.flash("copied")} align="start" />}
              </div>
              <button onClick={exportSvg} disabled={busy !== null} className="rounded-lg border border-line bg-ink-2 hover:bg-ink-3 px-3 py-3 text-sm font-semibold">
                Download SVG
              </button>
            </div>
          </div>
          <p className="text-xs text-muted">Every poster carries a small code and link back here, so whoever sees it can forge their own. The link in your address bar remembers the style, ratio and team. Surroundings on the map styles are fictional and generated from the name. Team liveries are fan colour schemes with the team name as plain text: unofficial, no logos, not affiliated with any team.</p>
        </div>
      </div>
    </div>
  );
}
