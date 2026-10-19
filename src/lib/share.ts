import { defaultTeamId, type TeamId } from "./poster/teams";
import type { PosterRatio, PosterStyle } from "./poster/types";

/*
 * Sharing a circuit: the link that rebuilds it, the text that goes with it, the Web Share route
 * into Instagram, WhatsApp and the rest (which only works with a file on phones), the fallback
 * targets for a desktop menu, and the clipboard. Everything here is pure except the two functions
 * that touch the browser, so the URL rules are tested.
 */

/** What a shared link carries besides the name and seed. */
export interface ShareParams {
  style: PosterStyle;
  ratio: PosterRatio;
  /** Team livery; null means the circuit's own default (then nothing is written). */
  team: TeamId | null;
  /** Explicit lap-length circuit id from an older link, kept so the link rebuilds the same lap. */
  len?: string | null;
}

export const DEFAULT_SHARE_PARAMS: ShareParams = { style: "sector", ratio: "2:3", team: null };

/**
 * Query string for a circuit. Defaults are omitted so the plain link stays short: no `poster`
 * for the Sector style, no `ratio` for 2:3, no `team` when it is the circuit's default.
 */
export function shareQuery(track: { name: string; seed: number }, p: Partial<ShareParams> = {}): URLSearchParams {
  const q = new URLSearchParams();
  q.set("name", track.name);
  if (track.seed) q.set("seed", String(track.seed));
  if (p.len) q.set("len", p.len);
  if (p.style && p.style !== "sector") q.set("poster", p.style);
  if (p.ratio && p.ratio !== "2:3") q.set("ratio", p.ratio);
  if (p.team && p.team !== defaultTeamId(track.name, track.seed)) q.set("team", p.team);
  return q;
}

/**
 * The full link for a circuit, built from the page's real location so a base path such as
 * GitHub Pages' `/<repo>/` survives (Next's `usePathname()` strips it). Only the search changes;
 * any hash is dropped.
 */
export function buildShareUrl(track: { name: string; seed: number }, p: Partial<ShareParams> = {}, location: { href: string } | undefined = typeof window === "undefined" ? undefined : window.location): string {
  if (!location) return "";
  const url = new URL(location.href);
  url.search = shareQuery(track, p).toString();
  url.hash = "";
  return url.toString();
}

/** The link as people read it under a poster: no scheme, no query, no trailing slash. */
export function shortUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.host}${u.pathname}`.replace(/\/+$/, "");
  } catch {
    return url.replace(/^https?:\/\//, "").split(/[?#]/)[0].replace(/\/+$/, "");
  }
}

/** The line that travels with a poster; the link follows it. */
export const POSTER_SHARE_LINE = "I turned my name into a Grand Prix circuit. Try yours:";
export function posterShareText(url: string): string {
  return `${POSTER_SHARE_LINE} ${url}`;
}

export type ShareOutcome = "shared" | "menu" | "aborted";

export interface ShareImageRequest {
  blob: Blob;
  filename: string;
  title: string;
  /** The message; the link is appended because iOS drops `url` when files are attached. */
  text: string;
  url: string;
}

/** True when this browser can hand an image to another app (phones: Instagram, WhatsApp, X…). */
export function canShareFiles(nav: Pick<Navigator, "canShare" | "share"> | undefined = typeof navigator === "undefined" ? undefined : navigator, file?: File): boolean {
  if (!nav || typeof nav.share !== "function" || typeof nav.canShare !== "function") return false;
  try {
    return nav.canShare({ files: [file ?? new File([new Uint8Array(1)], "probe.png", { type: "image/png" })] });
  } catch {
    return false;
  }
}

/**
 * Hand a PNG to the system share sheet. "shared" when the sheet took it, "aborted" when the
 * person closed the sheet (not an error), "menu" when this browser cannot share files and the
 * caller should show its own menu instead.
 */
export async function shareImage(req: ShareImageRequest, nav: Navigator | undefined = typeof navigator === "undefined" ? undefined : navigator): Promise<ShareOutcome> {
  const file = new File([req.blob], req.filename, { type: req.blob.type || "image/png" });
  if (!nav || !canShareFiles(nav, file)) return "menu";
  try {
    await nav.share({ files: [file], title: req.title, text: `${req.text} ${req.url}`.trim() });
    return "shared";
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return "aborted";
    return "menu";
  }
}

/** Web intents for the fallback menu. */
export function shareTargets(text: string, url: string): { whatsapp: string; x: string } {
  const message = text.includes(url) ? text : `${text} ${url}`;
  return {
    whatsapp: `https://wa.me/?text=${encodeURIComponent(message)}`,
    x: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text.replace(url, "").trim())}&url=${encodeURIComponent(url)}`,
  };
}

/** Copy with the Clipboard API when allowed, else the legacy selection route. Returns success. */
export function copyText(text: string): boolean {
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
