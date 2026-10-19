import type { Homologation } from "../geo/homologation";
import { pathD } from "../geo/svg";
import type { Track } from "../geo/types";
import { BODY_STACK, DISPLAY_STACK } from "./fonts";
import { attributionRow, esc, f1, fitTitleSize, fitTrack, startFinishTick, text } from "./primitives";

/*
 * The licence card as a picture: the same carbon card the result screen shows (accent bar, grade
 * seal, difficulty meter, tags, DNA, ghost lap, rarity), drawn as SVG in three formats so it can
 * be shared as a PNG. "story" is the phone story the Challenge button sends, "square" is for
 * feeds and chats, "wide" is the link preview (Open Graph) and the one GitHub shows.
 */

export type LicenceFormat = "square" | "story" | "wide";
export const LICENCE_FORMATS: readonly LicenceFormat[] = ["story", "square", "wide"];
export const LICENCE_SIZES: Record<LicenceFormat, { width: number; height: number }> = {
  square: { width: 1080, height: 1080 },
  story: { width: 1080, height: 1920 },
  wide: { width: 1200, height: 630 },
};
export const LICENCE_FORMAT_LABELS: Record<LicenceFormat, { label: string; hint: string }> = {
  story: { label: "Story", hint: "1080 × 1920, for Instagram and WhatsApp stories" },
  square: { label: "Square", hint: "1080 × 1080, for feeds and chats" },
  wide: { label: "Wide", hint: "1200 × 630, the link preview size" },
};

/** The DNA bar colours, shared with the on-screen card. */
export const DNA_COLORS = ["#e8322e", "#3dd68c", "#f5c542", "#60a5fa", "#c084fc", "#fb923c", "#2dd4bf", "#f472b6"] as const;

const C = {
  page: "#0b0b0f",
  card: "#111116",
  weaveA: "#151519",
  weaveB: "#0f0f13",
  ink3: "#1c1c23",
  line: "#2a2a33",
  fg: "#f4f4f5",
  muted: "#8b8b94",
  accent: "#e8322e",
  accent2: "#f5c542",
  accent3: "#3dd68c",
  meterOff: "#26262e",
};

export interface LicenceCardOptions {
  format: LicenceFormat;
  /** Extra <style> content, normally the embedded display @font-face. */
  fontFace?: string;
  /** The link that rebuilds this circuit; with it the card carries the attribution row. */
  shareUrl?: string;
  year?: number;
  display?: string;
  body?: string;
}

interface Block {
  markup: string;
  height: number;
}

/** Rough text width for layout: Helvetica/Inter run about 0.55 em per character, condensed display type 0.5. */
const bodyWidth = (s: string, size: number, tracking = 0) => s.length * (size * 0.56 + tracking);

/** Tiny tracked caps, the card's section voice. */
function label(x: number, y: number, s: string, size: number, color = C.muted, anchor: "start" | "end" = "start"): string {
  return text(x, y, s.toUpperCase(), { fill: color, "font-size": f1(size), "font-weight": 600, "letter-spacing": f1(size * 0.25), "text-anchor": anchor });
}

function dash(x1: number, y1: number, x2: number, y2: number, color = C.line, width = 1): string {
  return `<line x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(x2)}" y2="${f1(y2)}" stroke="${color}" stroke-width="${width}"/>`;
}

/** Rounded pill with a label; returns its markup and width. */
function pill(x: number, y: number, s: string, size: number, o: { font: string; fill?: string; stroke?: string; color?: string; padX?: number; height?: number; weight?: number; tracking?: number }): { markup: string; width: number } {
  const padX = o.padX ?? size * 0.8;
  const w = bodyWidth(s, size, o.tracking ?? 0) * (o.font === "display" ? 0.86 : 1) + 2 * padX;
  const h = o.height ?? size * 1.9;
  return {
    width: w,
    markup:
      `<rect x="${f1(x)}" y="${f1(y)}" width="${f1(w)}" height="${f1(h)}" rx="${f1(h / 2)}" fill="${o.fill ?? C.ink3}" stroke="${o.stroke ?? C.line}" stroke-width="1"/>` +
      text(x + w / 2, y + h / 2 + size * 0.36, s, { fill: o.color ?? C.fg, "font-size": f1(size), "font-weight": o.weight ?? 600, "letter-spacing": o.tracking, "text-anchor": "middle" }),
  };
}

/** The grade seal: a tilted double ring with GRADE over the number, as on the screen card. */
function seal(cx: number, cy: number, r: number, grade: string, display: string, body: string): string {
  const n = grade.replace(/\D/g, "") || "1";
  return (
    `<g transform="rotate(-6 ${f1(cx)} ${f1(cy)})">` +
    `<circle cx="${f1(cx)}" cy="${f1(cy)}" r="${f1(r)}" fill="none" stroke="${C.accent}" stroke-width="${f1(r * 0.075)}"/>` +
    `<circle cx="${f1(cx)}" cy="${f1(cy)}" r="${f1(r * 0.82)}" fill="none" stroke="${C.accent}" stroke-width="1.5"/>` +
    text(cx, cy - r * 0.2, "GRADE", { fill: C.accent, "font-size": f1(r * 0.2), "font-weight": 700, "letter-spacing": f1(r * 0.05), "text-anchor": "middle", "font-family": body }) +
    text(cx, cy + r * 0.5, n, { fill: C.accent, "font-size": f1(r * 0.95), "font-weight": 800, "text-anchor": "middle", "font-family": display }) +
    `</g>`
  );
}

/** The circuit as a thin white line with its start tick, fitted into a box. */
function outline(track: Track, box: { x: number; y: number; width: number; height: number }, pad: number): string {
  const { fit } = fitTrack(track, box, pad);
  const sw = Math.max(3, Math.min(7, fit.width * 0.012));
  return (
    `<path d="${pathD(track.loop, fit)}" fill="none" stroke="${C.fg}" stroke-opacity="0.1" stroke-width="${f1(sw * 3)}" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="${pathD(track.loop, fit)}" fill="none" stroke="${C.fg}" stroke-width="${f1(sw)}" stroke-linecap="round" stroke-linejoin="round"/>` +
    startFinishTick(track, fit, sw * 1.6, C.fg, C.card)
  );
}

function difficulty(h: Homologation, x: number, y: number, w: number, k: number, display: string): Block {
  const out: string[] = [];
  out.push(label(x, y + 10 * k, "Difficulty", 11 * k));
  // The score, with "/10" hung after it in the muted voice.
  out.push(text(x + w - 36 * k, y + 12 * k, String(h.difficulty), { fill: C.fg, "font-size": f1(30 * k), "font-weight": 700, "text-anchor": "end", "font-family": display }));
  out.push(text(x + w - 34 * k, y + 12 * k, "/10", { fill: C.muted, "font-size": f1(18 * k), "font-weight": 600, "font-family": display }));
  const cellGap = 6 * k;
  const cellW = (w - 9 * cellGap) / 10;
  const cellY = y + 26 * k;
  const cellH = 12 * k;
  for (let i = 0; i < 10; i++) {
    const fill = i < h.difficulty ? (i < 4 ? C.accent3 : i < 7 ? C.accent2 : C.accent) : C.meterOff;
    out.push(`<rect x="${f1(x + i * (cellW + cellGap))}" y="${f1(cellY)}" width="${f1(cellW)}" height="${f1(cellH)}" rx="${f1(3 * k)}" fill="${fill}"/>`);
  }
  // Tags as pills, wrapping.
  let px = x;
  let py = cellY + cellH + 18 * k;
  const size = 15 * k;
  const ph = size * 1.9;
  for (const t of h.tags) {
    const p = pill(px, py, t, size, { font: "display", weight: 600, tracking: 0.5 });
    if (px + p.width > x + w && px > x) {
      px = x;
      py += ph + 8 * k;
    }
    out.push(pill(px, py, t, size, { font: "display", weight: 600, tracking: 0.5 }).markup.replace(/font-family="[^"]*"/, "").replace("<text ", `<text font-family="${esc(display)}" `));
    px += p.width + 8 * k;
  }
  return { markup: out.join(""), height: py + ph - y };
}

function dna(h: Homologation, x: number, y: number, w: number, k: number, columns = 2): Block {
  const out: string[] = [];
  out.push(label(x, y + 10 * k, "Circuit DNA", 11 * k));
  const barY = y + 22 * k;
  const barH = 12 * k;
  out.push(`<clipPath id="lc-dna"><rect x="${f1(x)}" y="${f1(barY)}" width="${f1(w)}" height="${f1(barH)}" rx="${f1(barH / 2)}"/></clipPath>`);
  out.push(`<rect x="${f1(x)}" y="${f1(barY)}" width="${f1(w)}" height="${f1(barH)}" rx="${f1(barH / 2)}" fill="${C.ink3}"/>`);
  let bx = x;
  out.push(`<g clip-path="url(#lc-dna)">`);
  h.dna.forEach((d, i) => {
    const bw = d.share * w;
    out.push(`<rect x="${f1(bx)}" y="${f1(barY)}" width="${f1(bw + 0.5)}" height="${f1(barH)}" fill="${DNA_COLORS[i % DNA_COLORS.length]}"/>`);
    bx += bw;
  });
  out.push(`</g>`);
  const colW = w / columns;
  const rowH = 22 * k;
  const size = 13 * k;
  let ly = barY + barH + 22 * k;
  h.dna.forEach((d, i) => {
    const cx = x + (i % columns) * colW;
    const cy = ly + Math.floor(i / columns) * rowH;
    const pct = `${Math.round(d.share * 100)}% · ${d.letters.join("")}`;
    out.push(`<circle cx="${f1(cx + 5 * k)}" cy="${f1(cy - size * 0.33)}" r="${f1(4.5 * k)}" fill="${DNA_COLORS[i % DNA_COLORS.length]}"/>`);
    out.push(text(cx + 16 * k, cy, d.country, { fill: C.fg, "font-size": f1(size), "font-weight": 600 }));
    out.push(text(cx + 16 * k + bodyWidth(d.country, size) + 8 * k, cy, pct, { fill: C.muted, "font-size": f1(size) }));
  });
  ly += Math.ceil(h.dna.length / columns) * rowH;
  return { markup: out.join(""), height: ly - y - 10 * k };
}

function ghost(h: Homologation, x: number, y: number, w: number, k: number, display: string): Block {
  const hgt = 74 * k;
  const out: string[] = [];
  out.push(`<rect x="${f1(x)}" y="${f1(y)}" width="${f1(w)}" height="${f1(hgt)}" rx="${f1(16 * k)}" fill="${C.page}" fill-opacity="0.6" stroke="${C.line}" stroke-width="1"/>`);
  out.push(label(x + 18 * k, y + 28 * k, "Ghost lap", 11 * k));
  out.push(text(x + 18 * k, y + 50 * k, "Model time at 215 km/h flat out. Fictional.", { fill: C.muted, "font-size": f1(12 * k) }));
  out.push(text(x + w - 18 * k, y + 52 * k, h.lapTime.formatted, { fill: C.accent2, "font-size": f1(44 * k), "font-weight": 800, "text-anchor": "end", "font-family": display }));
  return { markup: out.join(""), height: hgt };
}

function rarity(h: Homologation, x: number, y: number, w: number, k: number, display: string, max = 3): Block {
  if (h.badges.length === 0) return { markup: "", height: 0 };
  const out: string[] = [];
  out.push(label(x, y + 10 * k, "Rarity", 11 * k));
  let by = y + 22 * k;
  const size = 11 * k;
  for (const b of h.badges.slice(0, max)) {
    const p = pill(x, by, b.label.toUpperCase(), size, { font: "display", fill: "rgba(245,197,66,0.15)", stroke: "rgba(245,197,66,0.4)", color: C.accent2, weight: 700, tracking: 1, height: size * 1.8, padX: 6 * k });
    out.push(p.markup.replace("<text ", `<text font-family="${esc(display)}" `));
    // Keep the detail to the card's width.
    const maxChars = Math.floor((w - p.width - 10 * k) / (12 * k * 0.52));
    const detail = b.detail.length > maxChars ? b.detail.slice(0, Math.max(0, maxChars - 1)).trimEnd() + "…" : b.detail;
    out.push(text(x + p.width + 10 * k, by + size * 1.3, detail, { fill: C.muted, "font-size": f1(12 * k) }));
    by += size * 1.8 + 10 * k;
  }
  return { markup: out.join(""), height: by - y - 10 * k };
}

/** Card chrome: the carbon fill, hairline border and the accent bar along the top. */
function cardShell(x: number, y: number, w: number, h: number, r: number): string {
  return (
    `<clipPath id="lc-card"><rect x="${f1(x)}" y="${f1(y)}" width="${f1(w)}" height="${f1(h)}" rx="${f1(r)}"/></clipPath>` +
    `<g clip-path="url(#lc-card)">` +
    `<rect x="${f1(x)}" y="${f1(y)}" width="${f1(w)}" height="${f1(h)}" fill="${C.card}"/>` +
    `<rect x="${f1(x)}" y="${f1(y)}" width="${f1(w)}" height="${f1(h)}" fill="url(#lc-weave)"/>` +
    `<rect x="${f1(x)}" y="${f1(y)}" width="${f1(w)}" height="6" fill="url(#lc-bar)"/>` +
    `</g>` +
    `<rect x="${f1(x)}" y="${f1(y)}" width="${f1(w)}" height="${f1(h)}" rx="${f1(r)}" fill="none" stroke="${C.line}" stroke-width="1.5"/>`
  );
}

const DEFS = `<pattern id="lc-weave" patternUnits="userSpaceOnUse" width="20" height="20"><rect width="20" height="20" fill="${C.card}"/><rect width="10" height="10" fill="${C.weaveA}"/><rect x="10" y="10" width="10" height="10" fill="${C.weaveA}"/><rect x="10" width="10" height="10" fill="${C.weaveB}"/><rect y="10" width="10" height="10" fill="${C.weaveB}"/><line x1="0" y1="20" x2="20" y2="0" stroke="#1a1a20" stroke-width="1"/></pattern>
<linearGradient id="lc-bar" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${C.accent}"/><stop offset="0.5" stop-color="${C.accent2}"/><stop offset="1" stop-color="${C.accent3}"/></linearGradient>
<radialGradient id="lc-glow" cx="0.2" cy="0" r="0.9"><stop offset="0" stop-color="${C.accent}" stop-opacity="0.1"/><stop offset="1" stop-color="${C.accent}" stop-opacity="0"/></radialGradient>`;

/** Header: eyebrow, name, licence line on the left; the seal on the right. Returns its height. */
function header(track: Track, h: Homologation, year: number, x: number, y: number, w: number, k: number, display: string, body: string): Block {
  const sealR = 44 * k;
  const titleSize = fitTitleSize(track.name, w - 2 * sealR - 30 * k, 64 * k, 0.5, 0.02);
  const out: string[] = [];
  out.push(label(x, y + 12 * k, "Track Forge · Circuit licence", 10 * k));
  out.push(text(x, y + 22 * k + titleSize * 0.82, track.name, { fill: C.fg, "font-size": f1(titleSize), "font-weight": 800, "letter-spacing": f1(titleSize * 0.02), "font-family": display }));
  out.push(text(x, y + 22 * k + titleSize * 0.82 + 24 * k, `No. ${h.licence} · Homologated ${year}`, { fill: C.muted, "font-size": f1(12.5 * k) }));
  out.push(seal(x + w - sealR - 4 * k, y + sealR + 4 * k, sealR, h.grade, display, body));
  return { markup: out.join(""), height: Math.max(2 * sealR + 8 * k, 22 * k + titleSize * 0.82 + 32 * k) };
}

function footer(x: number, y: number, w: number, k: number, body: string): string {
  return text(x + w, y, "Fictional grade and lap time. Not an FIA document; unofficial fan project.", { fill: C.muted, "font-size": f1(10.5 * k), "text-anchor": "end", "font-family": body });
}

/** Build the licence card as an SVG string in one of the three formats. */
export function buildLicenceCardSvg(track: Track, h: Homologation, o: LicenceCardOptions): string {
  const { width: W, height: H } = LICENCE_SIZES[o.format];
  const display = o.display ?? DISPLAY_STACK;
  const body = o.body ?? BODY_STACK;
  const year = o.year ?? new Date().getFullYear();
  const ctx = { W, body, shareUrl: o.shareUrl };
  const parts: string[] = [];

  if (o.format === "wide") {
    // Two columns: the facts on the left, the lap and the outline on the right.
    const k = 0.9;
    const pad = 44;
    const cx = pad;
    const cy = pad;
    const cw = W - 2 * pad;
    const ch = H - 2 * pad;
    const inner = 34;
    const leftW = 560;
    const rightX = cx + inner + leftW + 44;
    const rightW = cx + cw - inner - rightX;
    parts.push(cardShell(cx, cy, cw, ch, 28));
    let y = cy + inner;
    const hd = header(track, h, year, cx + inner, y, leftW, k, display, body);
    parts.push(hd.markup);
    y += hd.height + 18;
    const df = difficulty(h, cx + inner, y, leftW, k, display);
    parts.push(df.markup);
    y += df.height + 22;
    const dn = dna(h, cx + inner, y, leftW, k, 2);
    parts.push(dn.markup);
    y += dn.height + 22;
    // Badges fill the column's foot when they fit above the attribution row.
    const rowTop = cy + ch - inner - 56;
    for (const max of [2, 1]) {
      const rr = rarity(h, cx + inner, y, leftW, k, display, max);
      if (rr.height && y + rr.height < rowTop - 6) {
        parts.push(rr.markup);
        break;
      }
    }
    // Right column: outline over the ghost lap.
    const gh = ghost(h, rightX, cy + ch - inner - 74 * k, rightW, k, display);
    parts.push(gh.markup);
    parts.push(outline(track, { x: rightX, y: cy + inner, width: rightW, height: ch - 2 * inner - gh.height - 18 }, 20));
    const row = attributionRow(ctx, { x: cx + inner, y: rowTop, align: "start", color: C.muted, qrColor: C.fg, qrOpacity: 0.85, side: 56, urlSize: 12, capsSize: 9 });
    parts.push(row.markup);
    parts.push(footer(rightX, cy + ch - inner + 24, rightW, k, body));
  } else {
    const story = o.format === "story";
    const k = story ? 1.3 : 1;
    const pad = story ? 72 : 60;
    const cw = W - 2 * pad;
    const inner = Math.round(34 * k);
    const x = pad + inner;
    const w = cw - 2 * inner;
    const blocks: Block[] = [];
    let total = inner;
    const hd = header(track, h, year, x, 0, w, k, display, body);
    blocks.push(hd);
    total += hd.height + 14 * k;
    const outlineH = story ? 420 : 230;
    blocks.push({ markup: "", height: outlineH });
    total += outlineH + 18 * k;
    const df = difficulty(h, x, 0, w, k, display);
    blocks.push(df);
    total += df.height + 26 * k;
    const dn = dna(h, x, 0, w, k, 2);
    blocks.push(dn);
    total += dn.height + 26 * k;
    const gh = ghost(h, x, 0, w, k, display);
    blocks.push(gh);
    total += gh.height + 26 * k;
    const rr = rarity(h, x, 0, w, k, display, story ? 5 : 2);
    blocks.push(rr);
    total += rr.height ? rr.height + 26 * k : 0;
    const rowSide = Math.round(56 * k);
    total += rowSide + inner;
    const ch = total;
    const cy = Math.max(pad, Math.round((H - ch) / 2));
    parts.push(cardShell(pad, cy, cw, ch, 32));
    // Lay the blocks out again at their real y.
    let y = cy + inner;
    parts.push(header(track, h, year, x, y, w, k, display, body).markup);
    y += hd.height + 14 * k;
    parts.push(dash(x, y - 4 * k, x + w, y - 4 * k));
    parts.push(outline(track, { x, y: y + 10 * k, width: w, height: outlineH - 20 * k }, 16));
    y += outlineH;
    parts.push(dash(x, y - 4 * k, x + w, y - 4 * k));
    y += 18 * k;
    parts.push(difficulty(h, x, y, w, k, display).markup);
    y += df.height + 26 * k;
    parts.push(dna(h, x, y, w, k, 2).markup);
    y += dn.height + 26 * k;
    parts.push(ghost(h, x, y, w, k, display).markup);
    y += gh.height + 26 * k;
    if (rr.height) {
      parts.push(rarity(h, x, y, w, k, display, story ? 5 : 2).markup);
      y += rr.height + 26 * k;
    }
    const row = attributionRow(ctx, { x, y, align: "start", color: C.muted, qrColor: C.fg, qrOpacity: 0.85, side: rowSide, urlSize: 13 * k, capsSize: 9.5 * k });
    parts.push(row.markup);
    parts.push(footer(x, y + rowSide - 2, w, k, body));
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${esc(body)}">
<style>${o.fontFace ?? ""}</style>
<defs>${DEFS}</defs>
<rect width="${W}" height="${H}" fill="${C.page}"/>
<rect width="${W}" height="${H}" fill="url(#lc-glow)"/>
${parts.join("\n")}
</svg>`;
}
