import { brakingBoards, drsDetection, grandstands, gravelTraps, kerbs, rangeSamples, sectorFlags } from "../geo/decor";
import { hashString, mulberry32 } from "../geo/rng";
import { fitToBox, outwardNormal, pathD, splitSectors, type Fit } from "../geo/svg";
import type { Pt2, Track } from "../geo/types";
import type { Palette, RenderContext } from "./types";

/*
 * Building blocks shared by every poster style: the furnished track layer, corner labels, title
 * fitting, stat grids, frames, the credit line, a north arrow and pseudo-coordinates. Everything
 * returns SVG markup strings; styles compose them inside their own layout.
 */

export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export const f1 = (n: number) => (Math.round(n * 10) / 10).toString();
export const f2 = (n: number) => (Math.round(n * 100) / 100).toString();

export const pts = (poly: Pt2[], fit: Fit) =>
  poly
    .map((p) => {
      const q = fit.map(p);
      return `${f1(q.x)},${f1(q.y)}`;
    })
    .join(" ");

export function attrs(a: Record<string, string | number | undefined>): string {
  return Object.entries(a)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${k}="${typeof v === "number" ? f2(v) : esc(String(v))}"`)
    .join(" ");
}

/** A <text> element. Content is escaped. */
export function text(x: number, y: number, content: string, a: Record<string, string | number | undefined> = {}): string {
  return `<text ${attrs({ x, y, ...a })}>${esc(content)}</text>`;
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Font size so `name` fits `maxWidth`, capped. `glyph` is the average advance as a fraction of the size. */
export function fitTitleSize(name: string, maxWidth: number, maxSize: number, glyph = 0.62, letterSpacing = 0): number {
  const n = Math.max(1, name.length);
  const perChar = glyph + letterSpacing;
  return Math.max(24, Math.min(maxSize, maxWidth / (n * perChar)));
}

/** Stroke width for the asphalt in a fitted box: scales with the drawn loop, clamped so thumbnails stay readable. */
export function trackStroke(fit: Fit, lo = 8, hi = 24): number {
  return Math.max(lo, Math.min(hi, Math.max(fit.width, fit.height) * 0.02));
}

export interface TrackLayerOptions {
  /** Asphalt stroke in px. */
  sw: number;
  /** Colour sectors (sector style) or one asphalt tone. */
  sectorColoured?: boolean;
  /** Numbered rings with optional place names, or no corner marks. */
  corners?: "numbered" | "none";
  /** Kerbs, gravel, boards, flags, DRS, grandstands. */
  furniture?: boolean;
  /** Grain filter over the asphalt. */
  grain?: boolean;
  /** Pattern/filter id prefix so two layers can share one document. */
  idPrefix?: string;
  /** Draw place names next to numbers when the track has at most this many corners. */
  maxNamedCorners?: number;
  /** Font for the labels. */
  font?: string;
  /** Start/finish tick. */
  startFinish?: boolean;
}

/** Patterns and filters the furnished layer references. */
export function trackDefs(sw: number, pal: Palette, prefix = "t"): string {
  const g = f1(sw * 0.5);
  const s = f1(sw * 0.36);
  return (
    `<filter id="${prefix}-grain" x="-2%" y="-2%" width="104%" height="104%"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="7" result="noise"/><feColorMatrix in="noise" type="matrix" values="0 0 0 0 0.62  0 0 0 0 0.62  0 0 0 0 0.68  0 0 0 0.5 0" result="tint"/><feComposite in="tint" in2="SourceGraphic" operator="in" result="clipped"/><feBlend in="clipped" in2="SourceGraphic" mode="overlay"/></filter>` +
    `<pattern id="${prefix}-gravel" patternUnits="userSpaceOnUse" width="${g}" height="${g}"><rect width="${g}" height="${g}" fill="${pal.gravel}" fill-opacity="0.28"/><circle cx="${f1(sw * 0.12)}" cy="${f1(sw * 0.12)}" r="${f1(sw * 0.06)}" fill="${pal.gravelDot}" fill-opacity="0.8"/><circle cx="${f1(sw * 0.37)}" cy="${f1(sw * 0.37)}" r="${f1(sw * 0.06)}" fill="${pal.gravelDot}" fill-opacity="0.8"/></pattern>` +
    `<pattern id="${prefix}-seats" patternUnits="userSpaceOnUse" width="${s}" height="${s}"><rect width="${s}" height="${s}" fill="${pal.stands}"/><rect width="${s}" height="${f1(sw * 0.12)}" fill="${pal.standsRow}"/></pattern>`
  );
}

/** The furnished circuit: asphalt with edges, sectors or plain, kerbs, gravel, boards, flags, DRS, stands, start line. */
export function trackLayer(track: Track, fit: Fit, pal: Palette, o: TrackLayerOptions): string {
  const sw = o.sw;
  const m = sw / fit.scale;
  const prefix = o.idPrefix ?? "t";
  const full = pathD(track.loop, fit);
  const out: string[] = [];
  const furniture = o.furniture ?? true;
  const asphaltHalf = 0.95 * m;

  if (furniture) {
    for (const b of grandstands(track, { offset: asphaltHalf + 0.55 * m, depth: 1.25 * m, block: 9 * m, gap: 2 * m }).flatMap((g) => g.blocks)) {
      out.push(`<polygon points="${pts(b, fit)}" fill="url(#${prefix}-seats)" stroke="${pal.standsEdge}" stroke-width="1"/>`);
    }
    for (const g of gravelTraps(track, { edge: asphaltHalf + 0.15 * m, depth: 2.4 * m })) {
      out.push(`<polygon points="${pts(g.polygon, fit)}" fill="url(#${prefix}-gravel)" stroke="${pal.gravel}" stroke-opacity="0.35" stroke-width="1" stroke-linejoin="round"/>`);
    }
  }
  out.push(`<path d="${full}" fill="none" stroke="${pal.edge}" stroke-opacity="0.9" stroke-width="${f1(sw * 2.05)}" stroke-linecap="round" stroke-linejoin="round"/>`);
  out.push(`<path d="${full}" fill="none" stroke="${pal.asphalt}" stroke-width="${f1(sw * 1.9)}" stroke-linecap="round" stroke-linejoin="round"${o.grain ?? true ? ` filter="url(#${prefix}-grain)"` : ""}/>`);
  if (o.sectorColoured ?? true) {
    splitSectors(track.loop, track.sectors).forEach((p, i) =>
      out.push(`<path class="sector" d="${pathD(p, fit)}" fill="none" stroke="${pal.sectors[i]}" stroke-width="${f1(sw * 0.95)}" stroke-linecap="round" stroke-linejoin="round"/>`),
    );
  }
  if (furniture) {
    const dash = sw * 0.55;
    for (const k of kerbs(track, 0.62 * m)) {
      const d = pathD(k.pts, fit);
      out.push(
        `<path d="${d}" fill="none" stroke="${pal.kerbB}" stroke-width="${f1(sw * 0.3)}"/><path d="${d}" fill="none" stroke="${pal.kerbA}" stroke-width="${f1(sw * 0.3)}" stroke-dasharray="${f1(dash)} ${f1(dash)}" stroke-dashoffset="${f1(dash / 2)}"/>`,
      );
    }
    const straightD = pathD(rangeSamples(track.loop, track.longestStraight.startDist, track.longestStraight.endDist), fit);
    out.push(`<path d="${straightD}" fill="none" stroke="${pal.edge}" stroke-opacity="0.85" stroke-width="${f1(sw * 0.22)}" stroke-dasharray="${f1(sw * 0.8)} ${f1(sw * 0.6)}" stroke-linecap="round"/>`);
    for (const b of brakingBoards(track)) {
      const a = fit.map({ x: b.p.x + b.n.x * 1.05 * m, y: b.p.y + b.n.y * 1.05 * m });
      const len = b.metres === 100 ? 0.55 : 0.38;
      const c = fit.map({ x: b.p.x + b.n.x * (1.05 + len) * m, y: b.p.y + b.n.y * (1.05 + len) * m });
      out.push(`<line x1="${f1(a.x)}" y1="${f1(a.y)}" x2="${f1(c.x)}" y2="${f1(c.y)}" stroke="${pal.fg}" stroke-opacity="0.75" stroke-width="${f1(Math.max(1.2, sw * 0.14))}" stroke-linecap="round"/>`);
    }
    sectorFlags(track).forEach((fl, i) => {
      const base = fit.map({ x: fl.p.x + fl.n.x * 1.3 * m, y: fl.p.y + fl.n.y * 1.3 * m });
      const top = fit.map({ x: fl.p.x + fl.n.x * 3.1 * m, y: fl.p.y + fl.n.y * 3.1 * m });
      const sx = top.x - base.x;
      const sy = top.y - base.y;
      const color = pal.sectors[i + 1];
      out.push(
        `<line x1="${f1(base.x)}" y1="${f1(base.y)}" x2="${f1(top.x)}" y2="${f1(top.y)}" stroke="${pal.fg}" stroke-width="${f1(Math.max(1.2, sw * 0.14))}" stroke-linecap="round"/>` +
          `<polygon points="${f1(top.x)},${f1(top.y)} ${f1(top.x - sy * 0.42)},${f1(top.y + sx * 0.42)} ${f1(top.x - sx * 0.42)},${f1(top.y - sy * 0.42)}" fill="${color}"/>` +
          text(top.x - sy * 0.6, top.y + sx * 0.6, `S${i + 2}`, { fill: color, "font-size": f1(sw * 1.05), "font-weight": 700, "text-anchor": "middle", "dominant-baseline": "middle", "font-family": o.font }),
      );
    });
    const drs = drsDetection(track);
    if (drs) {
      const a = fit.map({ x: drs.p.x + drs.n.x * 1.1 * m, y: drs.p.y + drs.n.y * 1.1 * m });
      const b = fit.map({ x: drs.p.x - drs.n.x * 1.1 * m, y: drs.p.y - drs.n.y * 1.1 * m });
      const l = fit.map({ x: drs.p.x + drs.n.x * 2.2 * m, y: drs.p.y + drs.n.y * 2.2 * m });
      out.push(
        `<line x1="${f1(a.x)}" y1="${f1(a.y)}" x2="${f1(b.x)}" y2="${f1(b.y)}" stroke="${pal.sectors[1]}" stroke-width="${f1(Math.max(1.5, sw * 0.18))}" stroke-dasharray="${f1(sw * 0.25)} ${f1(sw * 0.2)}"/>` +
          text(l.x, l.y, "DRS", { fill: pal.sectors[1], "font-size": f1(sw * 0.95), "font-weight": 700, "text-anchor": "middle", "dominant-baseline": "middle", "letter-spacing": 1, "font-family": o.font }),
      );
    }
  }
  if (o.startFinish ?? true) out.push(startFinishTick(track, fit, sw, pal.fg, pal.bg));
  if ((o.corners ?? "numbered") === "numbered") out.push(cornerRings(track, fit, pal, sw, { maxNamed: o.maxNamedCorners ?? 16, font: o.font }));
  return out.join("\n");
}

/** Chequered perpendicular tick at the start/finish line. */
export function startFinishTick(track: Track, fit: Fit, sw: number, fg: string, bg: string): string {
  const sf = fit.map(track.loop[0]);
  const n0 = outwardNormal(track.loop, 0);
  const tick = sw * 1.5;
  const x1 = f1(sf.x - n0.x * tick);
  const y1 = f1(sf.y + n0.y * tick);
  const x2 = f1(sf.x + n0.x * tick);
  const y2 = f1(sf.y - n0.y * tick);
  return (
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${fg}" stroke-width="${f1(sw * 0.5)}" stroke-linecap="round"/>` +
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${bg}" stroke-width="${f1(sw * 0.18)}" stroke-dasharray="${f1(sw * 0.3)} ${f1(sw * 0.3)}"/>`
  );
}

/** Place label for a corner: the curated corner name, else the source circuit's location. */
export function cornerPlace(track: Track, c: Track["corners"][number]): string {
  if (!c.source) return "";
  return c.source.label ?? track.sources[c.source.letterIndex]?.circuit.location ?? "";
}

/** Numbered rings outside each apex, blue for left-handers and orange for right-handers, with place names when the lap is not too busy. */
export function cornerRings(track: Track, fit: Fit, pal: Palette, sw: number, o: { maxNamed: number; font?: string; nameColor?: string }): string {
  const m = sw / fit.scale;
  const r = Math.max(11, sw * 1.1);
  const named = track.corners.length <= o.maxNamed;
  const midX = fit.map({ x: (minX(track.loop) + maxX(track.loop)) / 2, y: 0 }).x;
  return track.corners
    .map((c) => {
      const nrm = outwardNormal(track.loop, c.index);
      const p = fit.map({ x: c.apex.x + nrm.x * 2.5 * m, y: c.apex.y + nrm.y * 2.5 * m });
      const apex = fit.map(c.apex);
      const ring = c.direction === "L" ? pal.left : pal.right;
      let name = "";
      const place = named ? cornerPlace(track, c) : "";
      if (place) {
        const left = p.x > midX + fit.width * 0.2;
        name = text(left ? p.x - r - 6 : p.x + r + 6, p.y, place, {
          fill: o.nameColor ?? pal.muted,
          "font-size": f1(r * 0.95),
          "font-weight": 500,
          "text-anchor": left ? "end" : "start",
          "dominant-baseline": "middle",
          "font-family": o.font,
        });
      }
      return (
        `<circle cx="${f1(apex.x)}" cy="${f1(apex.y)}" r="${f1(sw * 0.42)}" fill="${pal.bg}" stroke="${pal.fg}" stroke-width="1.5"/>` +
        `<line x1="${f1(apex.x)}" y1="${f1(apex.y)}" x2="${f1(p.x)}" y2="${f1(p.y)}" stroke="${pal.fg}" stroke-opacity="0.25" stroke-width="1"/>` +
        `<circle cx="${f1(p.x)}" cy="${f1(p.y)}" r="${f1(r)}" fill="${pal.bg}" stroke="${ring}" stroke-width="2"/>` +
        text(p.x, p.y + 0.5, String(c.number), { class: "corner-no", fill: pal.fg, "font-size": f1(r * 1.1), "font-weight": 700, "text-anchor": "middle", "dominant-baseline": "middle", "font-family": o.font }) +
        name
      );
    })
    .join("\n");
}

export const minX = (p: Pt2[]) => p.reduce((a, q) => Math.min(a, q.x), Infinity);
export const maxX = (p: Pt2[]) => p.reduce((a, q) => Math.max(a, q.x), -Infinity);
export const minY = (p: Pt2[]) => p.reduce((a, q) => Math.min(a, q.y), Infinity);
export const maxY = (p: Pt2[]) => p.reduce((a, q) => Math.max(a, q.y), -Infinity);

export interface AlongPathOptions {
  /** Offset from the centreline in px (positive = outside the loop). */
  offset: number;
  fontSize: number;
  color: string;
  font?: string;
  /** Only label when the lap has at most this many corners. */
  maxCorners?: number;
  idPrefix?: string;
  weight?: number;
  letterSpacing?: number;
  /** "T3 · La Source" when true, else just the place. */
  numbered?: boolean;
  /** Above `maxCorners`, fall back to short "T3" labels up to this many corners (0 disables). */
  shortUpTo?: number;
}

/**
 * Corner names set along the road with <textPath>: each label rides a hidden path offset from the
 * centreline around its corner, reversed when needed so the text reads left to right. Returns defs
 * (the paths) and the text elements.
 */
export function cornerNamesAlongPath(track: Track, fit: Fit, o: AlongPathOptions): { defs: string; body: string } {
  const maxCorners = o.maxCorners ?? 16;
  const short = track.corners.length > maxCorners;
  if (short && track.corners.length > (o.shortUpTo ?? 0)) return { defs: "", body: "" };
  const prefix = o.idPrefix ?? "cn";
  const loop = track.loop;
  const n = loop.length - 1;
  const L = loop[n].dist;
  const defs: string[] = [];
  const body: string[] = [];
  const offM = o.offset / fit.scale;
  const step = loop[1].dist - loop[0].dist || 10;
  track.corners.forEach((c, k) => {
    const place = cornerPlace(track, c);
    if (!place && !short) return;
    const label = short ? `T${c.number}` : (o.numbered ?? true) ? `T${c.number} · ${place}` : place;
    const estWidth = label.length * o.fontSize * (0.52 + (o.letterSpacing ?? 0) / o.fontSize);
    const neededM = (estWidth * 1.25) / fit.scale;
    const span = c.endDist >= c.startDist ? c.endDist - c.startDist : c.endDist + L - c.startDist;
    const extra = Math.max(0, (neededM - span) / 2) + 2 * step;
    const start = c.dist - span / 2 - extra;
    const count = Math.max(4, Math.round((span + 2 * extra) / step));
    const raw: Pt2[] = [];
    for (let i = 0; i <= count; i++) {
      const d = (((start + i * step) % L) + L) % L;
      let idx = Math.round(d / step) % n;
      if (idx < 0) idx += n;
      const nrm = outwardNormal(loop, idx);
      raw.push({ x: loop[idx].x + nrm.x * offM, y: loop[idx].y + nrm.y * offM });
    }
    // Smooth the offset polyline a little so the text does not wobble on hairpins.
    const sm = raw.map((p, i) => {
      if (i === 0 || i === raw.length - 1) return p;
      return { x: (raw[i - 1].x + 2 * p.x + raw[i + 1].x) / 4, y: (raw[i - 1].y + 2 * p.y + raw[i + 1].y) / 4 };
    });
    const first = fit.map(sm[0]);
    const last = fit.map(sm[sm.length - 1]);
    const ordered = last.x < first.x ? [...sm].reverse() : sm;
    const id = `${prefix}-${k}`;
    defs.push(`<path id="${id}" d="${pathD(ordered, fit)}" fill="none"/>`);
    body.push(
      `<text ${attrs({ fill: o.color, "font-size": f1(o.fontSize), "font-weight": o.weight ?? 600, "letter-spacing": o.letterSpacing, "font-family": o.font })}><textPath href="#${id}" startOffset="50%" text-anchor="middle" dominant-baseline="middle">${esc(label)}</textPath></text>`,
    );
  });
  return { defs: defs.join("\n"), body: body.join("\n") };
}

export interface StatItem {
  label: string;
  value: string;
  accent?: boolean;
}

/** The headline numbers every style draws on from. */
export function statItems(ctx: RenderContext, lapsFor: (len: number) => number): StatItem[] {
  const t = ctx.track;
  return [
    { label: "CIRCUIT LENGTH", value: `${(t.length / 1000).toFixed(3)} km` },
    { label: "CORNERS", value: String(t.corners.length) },
    { label: "LAPS", value: String(lapsFor(t.length)) },
    { label: "HOMOLOGATED", value: String(ctx.year) },
    { label: "LONGEST STRAIGHT", value: `${Math.round(t.longestStraight.length)} m` },
    { label: "GHOST LAP", value: ctx.h.lapTime.formatted, accent: true },
  ];
}

export interface StatsGridOptions {
  x: number;
  y: number;
  width: number;
  columns: number;
  rowHeight: number;
  labelSize: number;
  valueSize: number;
  labelColor: string;
  valueColor: string;
  accentColor: string;
  labelFont?: string;
  valueFont?: string;
  letterSpacing?: number;
}

/** Label-over-value grid, left-aligned columns. */
export function statsGrid(items: StatItem[], o: StatsGridOptions): string {
  const colW = o.width / o.columns;
  return items
    .map((it, i) => {
      const x = o.x + (i % o.columns) * colW;
      const y = o.y + Math.floor(i / o.columns) * o.rowHeight;
      return (
        text(x, y, it.label, { fill: o.labelColor, "font-size": o.labelSize, "letter-spacing": o.letterSpacing ?? 4, "font-family": o.labelFont }) +
        text(x, y + o.labelSize * 2.4, it.value, { fill: it.accent ? o.accentColor : o.valueColor, "font-size": o.valueSize, "font-weight": 700, "font-family": o.valueFont })
      );
    })
    .join("\n");
}

/** Thin inset frame. */
export function frame(W: number, H: number, inset: number, color: string, opacity = 0.35, width = 2): string {
  return `<rect x="${f1(inset)}" y="${f1(inset)}" width="${f1(W - 2 * inset)}" height="${f1(H - 2 * inset)}" fill="none" stroke="${color}" stroke-opacity="${opacity}" stroke-width="${width}"/>`;
}

export const CREDIT = "Inspired by real Grand Prix circuits. Unofficial fan project, not affiliated with Formula 1. Grade and lap time are fictional.";

/** The mandatory credit, with the length reference in front when known. */
export function creditText(lengthReference?: string, extra?: string): string {
  const parts = [lengthReference ? `Length reference: ${lengthReference}` : "", extra ?? "", CREDIT].filter(Boolean);
  return parts.join("  ·  ");
}

/** "A: Spa-Francorchamps  ·  B: Monza" */
export function sourcesLine(track: Track): string {
  return track.sources.map((s) => `${s.letter}: ${s.circuit.location}`).join("  ·  ");
}

/** A compass north arrow pointing up, centred on (x, y). */
export function northArrow(x: number, y: number, size: number, color: string, font?: string): string {
  const h = size;
  const w = size * 0.36;
  return (
    `<g>` +
    `<polygon points="${f1(x)},${f1(y - h / 2)} ${f1(x + w / 2)},${f1(y + h / 2)} ${f1(x)},${f1(y + h / 5)}" fill="${color}"/>` +
    `<polygon points="${f1(x)},${f1(y - h / 2)} ${f1(x - w / 2)},${f1(y + h / 2)} ${f1(x)},${f1(y + h / 5)}" fill="none" stroke="${color}" stroke-width="1.5"/>` +
    text(x, y - h / 2 - size * 0.22, "N", { fill: color, "font-size": f1(size * 0.42), "font-weight": 700, "text-anchor": "middle", "font-family": font, "letter-spacing": 1 }) +
    `</g>`
  );
}

function dms(deg: number, pos: string, neg: string): string {
  const hemi = deg >= 0 ? pos : neg;
  const a = Math.abs(deg);
  const d = Math.floor(a);
  const mFull = (a - d) * 60;
  const m = Math.floor(mFull);
  const s = Math.round((mFull - m) * 60);
  return `${d}°${String(m).padStart(2, "0")}′${String(s).padStart(2, "0")}″ ${hemi}`;
}

/**
 * Seeded pseudo-coordinates for a lap that has no real location, in degrees/minutes/seconds. Kept
 * to inhabited latitudes so the line reads like a place, never a specific real one.
 */
export function pseudoCoordinates(name: string, seed: number): string {
  const rng = mulberry32((hashString(name) ^ (seed >>> 0) ^ 0xc00d) >>> 0);
  const lat = (rng() < 0.75 ? 1 : -1) * (12 + rng() * 46);
  const lon = -170 + rng() * 340;
  return `${dms(lat, "N", "S")}   ${dms(lon, "E", "W")}`;
}

/** Fit the loop into a box and return the fit plus the stroke to draw it with. */
export function fitTrack(track: Track, box: Box, padding: number): { fit: Fit; sw: number } {
  const fit = fitToBox(track.loop, box, padding);
  return { fit, sw: trackStroke(fit) };
}
