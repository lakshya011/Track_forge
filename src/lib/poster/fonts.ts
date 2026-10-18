/**
 * The display font for posters. In the browser the next/font Barlow Condensed faces are fetched once,
 * base64-encoded and returned as an @font-face block for the SVG <style>, so exports and thumbnails
 * carry the same type as the page. Anywhere that fails, the stack falls through to condensed system
 * fonts.
 */

export const DISPLAY_FAMILY = "TrackForgeDisplay";
export const DISPLAY_FALLBACK = "'Arial Narrow', 'Helvetica Neue Condensed', 'Roboto Condensed', Impact, sans-serif";
export const DISPLAY_STACK = `'${DISPLAY_FAMILY}', ${DISPLAY_FALLBACK}`;
export const BODY_STACK = "'Helvetica Neue', Helvetica, Arial, sans-serif";

/** Weights the posters use; only these faces are embedded. */
export const DISPLAY_WEIGHTS = [700, 800] as const;

/** First url(...) in a CSS `src` descriptor, unquoted. */
export function parseFontSrcUrl(src: string): string | null {
  const m = /url\(\s*(['"]?)([^'")]+)\1\s*\)/.exec(src);
  return m ? m[2] : null;
}

/** Weight as a number when the descriptor is a single value (or a range, in which case the lower bound). */
export function parseFontWeight(weight: string): number {
  const m = /(\d{3})/.exec(weight);
  return m ? Number(m[1]) : 400;
}

/** Resolve a stylesheet-relative url against the sheet's own URL (falls back to the page). */
export function resolveUrl(url: string, base?: string): string {
  try {
    return new URL(url, base ?? (typeof location !== "undefined" ? location.href : "http://localhost/")).toString();
  } catch {
    return url;
  }
}

/** One embedded @font-face rule. */
export function fontFaceCss(family: string, weight: number, base64: string, format = "woff2"): string {
  return `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};font-display:block;src:url(data:font/${format};base64,${base64}) format('${format}')}`;
}

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** The family name next/font assigned, read from the --font-barlow custom property. */
function nextFontFamily(): string | null {
  const raw = getComputedStyle(document.documentElement).getPropertyValue("--font-barlow").trim();
  const first = raw.split(",")[0]?.trim().replace(/^['"]|['"]$/g, "");
  return first || null;
}

export interface FaceCandidate {
  weight: number;
  src: string;
  unicodeRange: string;
  /** The stylesheet's URL, which relative src urls resolve against. */
  base?: string;
}

/** True when a unicode-range descriptor covers basic Latin (or is absent, meaning the whole font). */
export function coversLatin(unicodeRange: string): boolean {
  const r = unicodeRange.trim();
  if (!r) return true;
  return r
    .split(",")
    .map((t) => t.trim().toUpperCase())
    .some((t) => {
      const m = /^U\+([0-9A-F?]+)(?:-([0-9A-F]+))?$/.exec(t);
      if (!m) return false;
      if (m[1].includes("?")) return parseInt(m[1].replace(/\?/g, "0"), 16) <= 0x41;
      const lo = parseInt(m[1], 16);
      const hi = m[2] ? parseInt(m[2], 16) : lo;
      return lo <= 0x41 && hi >= 0x5a;
    });
}

/**
 * next/font emits one @font-face per unicode subset and weight. Pick, for each wanted weight, the
 * face that covers Latin letters, so the base64 we embed can actually draw the title.
 */
export function pickLatinFaces(faces: FaceCandidate[], weights: readonly number[] = DISPLAY_WEIGHTS): Map<number, string> {
  const out = new Map<number, string>();
  for (const w of weights) {
    const mine = faces.filter((f) => f.weight === w);
    const latin = mine.filter((f) => coversLatin(f.unicodeRange));
    const pick = latin.find((f) => /-s\.p\./.test(f.src)) ?? latin[latin.length - 1] ?? mine[mine.length - 1];
    const url = pick ? parseFontSrcUrl(pick.src) : null;
    if (url) out.set(w, resolveUrl(url, pick?.base));
  }
  return out;
}

function fontFaceCandidates(family: string): FaceCandidate[] {
  const out: FaceCandidate[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue; // cross-origin sheet
    }
    for (const rule of Array.from(rules)) {
      if (rule instanceof CSSFontFaceRule) {
        const fam = rule.style.getPropertyValue("font-family").trim().replace(/^['"]|['"]$/g, "");
        if (fam !== family) continue;
        out.push({
          weight: parseFontWeight(rule.style.getPropertyValue("font-weight")),
          src: rule.style.getPropertyValue("src"),
          unicodeRange: rule.style.getPropertyValue("unicode-range"),
          base: sheet.href ?? undefined,
        });
      }
    }
  }
  return out;
}

let cached: Promise<string> | null = null;

/**
 * The @font-face block to embed in poster SVGs, or "" when the faces cannot be found or fetched
 * (server side, tests, offline). Resolved once per page and cached.
 */
export function displayFontStyle(): Promise<string> {
  if (cached) return cached;
  cached = (async () => {
    try {
      if (typeof document === "undefined") return "";
      const family = nextFontFamily();
      if (!family) return "";
      const byWeight = pickLatinFaces(fontFaceCandidates(family));
      if (byWeight.size === 0) return "";
      const faces = await Promise.all(
        [...byWeight.entries()].map(async ([weight, url]) => {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`font ${res.status}`);
          return fontFaceCss(DISPLAY_FAMILY, weight, toBase64(await res.arrayBuffer()));
        }),
      );
      return faces.join("\n");
    } catch {
      return "";
    }
  })();
  return cached;
}
