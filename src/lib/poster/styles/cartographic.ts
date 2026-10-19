import { pathD, type Fit } from "../../geo/svg";
import type { Pt2 } from "../../geo/types";
import { pointAt } from "../../geo/decor";
import { buildCartography, type Cartography, type RoadKind } from "../cartography";
import { attributionRow, creditText, esc, f1, fitTitleSize, fitTrack, northArrow, pseudoCoordinates, pts, startFinishTick, text } from "../primitives";
import type { Palette, RenderContext, StyleDefinition } from "../types";

/*
 * Charcoal street map: the whole sheet is a procedurally generated town plan in a hierarchy of greys
 * (highways brightest after the circuit, then arterials and streets, buildings mid, fields faint),
 * pale-blue water with shoreline rings, and the circuit as a crisp white line in a dark halo with its
 * pit complex, grandstands, car parks and run-off drawn around it. Paper grain and a vignette keep it
 * reading as print. The footer is a wide letter-spaced title, the seeded coordinates, the corner count
 * and length, and the credit.
 */

const C = {
  bg: "#24262a",
  field: "#2d2f34",
  fieldHatch: "#4b5058",
  fieldEdge: "#4a4e56",
  contour: "#383b41",
  woodBase: "#2b2e33",
  woodDot: "#575c64",
  woodEdge: "#454950",
  water: "#8fb8d9",
  block: "#313439",
  building: "#7c818a",
  street: "#80858d",
  minor: "#a6abb3",
  perimeter: "#b6bbc2",
  highway: "#d4d8dd",
  runoff: "#4e525a",
  runoffDot: "#696e76",
  park: "#34373d",
  parkRow: "#60656d",
  stand: "#70757d",
  pit: "#979ca4",
  paddock: "#7c818a",
  fg: "#ffffff",
  muted: "#a3a8b0",
  faint: "#6b7079",
  rule: "#3a3e45",
};

export const palette: Palette = {
  bg: C.bg,
  fg: C.fg,
  muted: C.muted,
  accent: C.water,
  sectors: [C.fg, C.fg, C.fg],
  asphalt: C.fg,
  edge: C.fg,
  kerbA: C.fg,
  kerbB: C.bg,
  gravel: C.runoff,
  gravelDot: C.runoffDot,
  stands: C.stand,
  standsRow: C.street,
  standsEdge: C.street,
  left: C.muted,
  right: C.muted,
};

const ROAD: Record<RoadKind, { w: number; color: string; order: number }> = {
  service: { w: 1.1, color: C.street, order: 0 },
  street: { w: 1.4, color: C.street, order: 1 },
  access: { w: 2.4, color: C.minor, order: 2 },
  arterial: { w: 2.4, color: C.minor, order: 2 },
  through: { w: 3, color: C.perimeter, order: 3 },
  perimeter: { w: 3, color: C.perimeter, order: 3 },
  highway: { w: 5.6, color: C.highway, order: 4 },
};

/** Many polygons as one path. */
function polysPath(polys: Pt2[][], fit: Fit): string {
  return polys
    .map((poly) => {
      const q = poly.map((p) => fit.map(p));
      return `M${f1(q[0].x)} ${f1(q[0].y)}` + q.slice(1).map((p) => `L${f1(p.x)} ${f1(p.y)}`).join("") + "Z";
    })
    .join("");
}

function polylinesPath(lines: Pt2[][], fit: Fit): string {
  return lines.map((l) => pathD(l, fit)).join("");
}

export function cityDefs(prefix: string): string {
  const out: string[] = [];
  for (const a of [0, 30, 60, 90, 120, 150]) {
    out.push(
      `<pattern id="${prefix}-hatch-${a}" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(${a})"><line x1="0" y1="3" x2="6" y2="3" stroke="${C.fieldHatch}" stroke-width="0.8"/></pattern>`,
      `<pattern id="${prefix}-rows-${a}" patternUnits="userSpaceOnUse" width="10" height="10" patternTransform="rotate(${a})"><line x1="0" y1="5" x2="10" y2="5" stroke="${C.fieldHatch}" stroke-width="1.5"/></pattern>`,
      `<pattern id="${prefix}-cross-${a}" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(${a})"><line x1="0" y1="4" x2="8" y2="4" stroke="${C.fieldHatch}" stroke-width="0.7"/><line x1="4" y1="0" x2="4" y2="8" stroke="${C.fieldHatch}" stroke-width="0.7"/></pattern>`,
    );
  }
  out.push(`<pattern id="${prefix}-orchard" patternUnits="userSpaceOnUse" width="9" height="9"><circle cx="4.5" cy="4.5" r="1.4" fill="${C.fieldHatch}"/></pattern>`);
  out.push(
    `<pattern id="${prefix}-wood" patternUnits="userSpaceOnUse" width="7" height="7"><rect width="7" height="7" fill="${C.woodBase}"/><circle cx="1.8" cy="2.1" r="1.05" fill="${C.woodDot}"/><circle cx="5.3" cy="5.6" r="0.9" fill="${C.woodDot}" fill-opacity="0.8"/><circle cx="5.6" cy="1.2" r="0.6" fill="${C.woodDot}" fill-opacity="0.6"/></pattern>`,
  );
  out.push(`<pattern id="${prefix}-gravel" patternUnits="userSpaceOnUse" width="5" height="5"><rect width="5" height="5" fill="${C.runoff}"/><circle cx="1.2" cy="1.4" r="0.6" fill="${C.runoffDot}"/><circle cx="3.6" cy="3.7" r="0.6" fill="${C.runoffDot}"/></pattern>`);
  out.push(`<pattern id="${prefix}-seats" patternUnits="userSpaceOnUse" width="4" height="4"><line x1="0" y1="2" x2="4" y2="2" stroke="${C.bg}" stroke-opacity="0.35" stroke-width="0.6"/></pattern>`);
  out.push(`<pattern id="${prefix}-bays" patternUnits="userSpaceOnUse" width="5" height="5"><line x1="2.5" y1="0" x2="2.5" y2="5" stroke="${C.parkRow}" stroke-width="0.7"/></pattern>`);
  return out.join("\n");
}

/** Everything but the circuit line: countryside, water, towns, roads and the circuit's own furniture. */
export function cityLayer(c: Cartography, fit: Fit, prefix: string): string {
  const out: string[] = [];
  const px = (m: number) => m * fit.scale;

  // Contours: the faintest layer.
  for (const k of c.contours) {
    const d = k.segments
      .map(([a, b]) => {
        const qa = fit.map(a);
        const qb = fit.map(b);
        return `M${f1(qa.x)} ${f1(qa.y)}L${f1(qb.x)} ${f1(qb.y)}`;
      })
      .join("");
    out.push(`<path d="${d}" fill="none" stroke="${C.contour}" stroke-width="0.8"/>`);
  }

  // Field parcels: a faint fill, a hatch and a thin boundary.
  out.push(`<g stroke="${C.fieldEdge}" stroke-width="0.7" stroke-linejoin="round">`);
  for (const f of c.fields) {
    const fill = f.kind === "plain" ? C.field : f.kind === "orchard" ? `url(#${prefix}-orchard)` : `url(#${prefix}-${f.kind}-${f.angle})`;
    if (f.kind !== "plain") out.push(`<polygon points="${pts(f.polygon, fit)}" fill="${C.field}" stroke="none"/>`);
    out.push(`<polygon points="${pts(f.polygon, fit)}" fill="${fill}"/>`);
  }
  out.push(`</g>`);

  // Woodland: stipple.
  for (const w of c.woods) out.push(`<polygon points="${pts(w, fit)}" fill="url(#${prefix}-wood)" stroke="${C.woodEdge}" stroke-width="1" stroke-linejoin="round"/>`);

  // Water with two shoreline rings.
  const waters = [...(c.water ? [c.water] : []), ...c.ponds];
  for (const ring of [
    { extra: 16, op: 0.08 },
    { extra: 7, op: 0.16 },
  ]) {
    for (const w of waters) {
      if (w.kind === "lake") out.push(`<polygon points="${pts(w.polygon, fit)}" fill="none" stroke="${C.water}" stroke-opacity="${ring.op}" stroke-width="${ring.extra}" stroke-linejoin="round"/>`);
      else out.push(`<polyline points="${pts(w.pts, fit)}" fill="none" stroke="${C.water}" stroke-opacity="${ring.op}" stroke-width="${f1(Math.max(3, px(w.width)) + ring.extra)}" stroke-linecap="round" stroke-linejoin="round"/>`);
    }
  }
  for (const w of waters) {
    if (w.kind === "lake") out.push(`<polygon points="${pts(w.polygon, fit)}" fill="${C.water}" fill-opacity="0.92" stroke="none"/>`);
    else out.push(`<polyline points="${pts(w.pts, fit)}" fill="none" stroke="${C.water}" stroke-opacity="0.92" stroke-width="${f1(Math.max(3, px(w.width)))}" stroke-linecap="round" stroke-linejoin="round"/>`);
  }

  // Built-up blocks, car parks and run-off sit under the buildings and roads.
  if (c.settlements.length) out.push(`<path d="${polysPath(c.settlements.flatMap((s) => s.blocks), fit)}" fill="${C.block}"/>`);
  for (const cp of c.carParks) {
    out.push(`<polygon points="${pts(cp.outline, fit)}" fill="${C.park}" stroke="${C.parkRow}" stroke-width="0.8"/>`);
    out.push(`<path d="${polylinesPath(cp.rows, fit)}" fill="none" stroke="${C.parkRow}" stroke-width="0.8"/>`);
  }
  for (const r of c.runoffs) out.push(`<polygon points="${pts(r, fit)}" fill="url(#${prefix}-gravel)" stroke="${C.runoffDot}" stroke-opacity="0.5" stroke-width="0.8" stroke-linejoin="round"/>`);

  // Buildings: one path.
  if (c.buildings.length) out.push(`<path d="${polysPath(c.buildings, fit)}" fill="${C.building}"/>`);

  // Roads: casings cut through everything, then the lines from the smallest up to the highways.
  const byKind = new Map<RoadKind, Pt2[][]>();
  for (const r of c.roads) byKind.set(r.kind, [...(byKind.get(r.kind) ?? []), r.pts]);
  const kinds = [...byKind.keys()].sort((a, b) => ROAD[a].order - ROAD[b].order);
  for (const kind of kinds) out.push(`<path d="${polylinesPath(byKind.get(kind)!, fit)}" fill="none" stroke="${C.bg}" stroke-width="${f1(ROAD[kind].w + 2.2)}" stroke-linecap="round" stroke-linejoin="round"/>`);
  for (const kind of kinds) {
    const d = polylinesPath(byKind.get(kind)!, fit);
    out.push(`<path d="${d}" fill="none" stroke="${ROAD[kind].color}" stroke-width="${f1(ROAD[kind].w)}" stroke-linecap="round" stroke-linejoin="round"/>`);
    if (kind === "highway") out.push(`<path d="${d}" fill="none" stroke="${C.bg}" stroke-opacity="0.55" stroke-width="0.9" stroke-dasharray="7 5" stroke-linecap="butt" stroke-linejoin="round"/>`);
  }
  for (const t of c.tunnels) out.push(`<polyline points="${pts(t, fit)}" fill="none" stroke="${C.minor}" stroke-width="1.4" stroke-dasharray="3 3"/>`);

  // Circuit furniture.
  out.push(`<polyline points="${pts(c.pitLane, fit)}" fill="none" stroke="${C.perimeter}" stroke-width="1.8" stroke-linejoin="round"/>`);
  if (c.stands.length) {
    out.push(`<path d="${polysPath(c.stands, fit)}" fill="${C.stand}" stroke="${C.bg}" stroke-width="0.8"/>`);
    out.push(`<path d="${polysPath(c.stands, fit)}" fill="url(#${prefix}-seats)" stroke="none"/>`);
  }
  out.push(`<polygon points="${pts(c.pitBuilding, fit)}" fill="${C.pit}" stroke="${C.bg}" stroke-width="0.8"/>`);
  // Garage divisions along the pit building.
  {
    const [a, b, cc, d] = c.pitBuilding;
    const n = Math.max(4, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / (14 * c.unit)));
    const segs: Pt2[][] = [];
    for (let i = 1; i < n; i++) {
      const t = i / n;
      segs.push([
        { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t },
        { x: d.x + (cc.x - d.x) * t, y: d.y + (cc.y - d.y) * t },
      ]);
    }
    out.push(`<path d="${polylinesPath(segs, fit)}" fill="none" stroke="${C.bg}" stroke-opacity="0.6" stroke-width="0.7"/>`);
  }
  if (c.paddock.length) out.push(`<path d="${polysPath(c.paddock, fit)}" fill="${C.paddock}" stroke="${C.bg}" stroke-width="0.8"/>`);

  return out.join("\n");
}

function layout(W: number, H: number, name: string, withCoords: boolean) {
  const tall = H / W >= 1.4;
  const pad = Math.round(W * 0.07);
  const titleSize = fitTitleSize(name, W - 2 * pad, tall ? 96 : 72, 0.5, tall ? 0.5 : 0.42);
  const footer = tall ? Math.round(titleSize + (withCoords ? 36 : 0) + 160) : Math.round(titleSize + (withCoords ? 30 : 0) + 96);
  const map = { x: 0, y: 0, width: W, height: H - footer };
  return { pad, tall, titleSize, footer, map };
}

const km = (m: number) => (m / 1000).toFixed(3);
const mi = (m: number) => (m / 1609.344).toFixed(3);

function render(ctx: RenderContext): string {
  const { track, W, H, options } = ctx;
  const { pad, tall, titleSize, map } = layout(W, H, track.name, options.coordinates);
  const carto = ctx.cartography ?? buildCartography(track);
  const { fit, sw: baseSw } = fitTrack(track, map, Math.round(map.width * 0.12));
  const sw = baseSw * 0.3;
  const full = pathD(track.loop, fit);
  const sectorDots = [track.sectors[1], track.sectors[2]]
    .map((d) => {
      const p = fit.map(pointAt(track.loop, d));
      return `<circle cx="${f1(p.x)}" cy="${f1(p.y)}" r="${f1(sw * 0.55)}" fill="${C.fg}" stroke="${C.bg}" stroke-width="${f1(sw * 0.3)}"/>`;
    })
    .join("");
  const credit = creditText(ctx.lengthReference, "Fictional location: surroundings are procedurally generated");
  const stats = `Corners: ${track.corners.length}  ·  Length: ${km(track.length)} km (${mi(track.length)} mi)`;
  const coords = options.coordinates ? pseudoCoordinates(track.name, track.seed) : "";
  const spacing = titleSize * (tall ? 0.5 : 0.42);
  const footerTop = map.height;
  // A legend box in the map's bottom-right corner, over the fade, in the map's own greys. A touch
  // larger than elsewhere: the modules fight paper grain and a vignette here.
  const side = Math.round(W * 0.06);
  const legend = attributionRow(ctx, {
    x: W - pad,
    y: map.height - 16 - side,
    align: "end",
    color: C.muted,
    qrColor: C.highway,
    qrOpacity: 0.9,
    side,
    plate: { fill: C.bg, opacity: 0.88, pad: 10, radius: 3 },
  });

  let footerMarkup: string;
  if (tall) {
    // Centred stack: title, coordinates, stats, credit.
    const titleY = footerTop + 36 + titleSize * 0.82;
    let y = titleY + 34;
    const lines: string[] = [];
    if (coords) {
      lines.push(text(W / 2 + 2, y, coords, { fill: C.muted, "font-size": 15, "letter-spacing": 4, "text-anchor": "middle", "font-weight": 500 }));
      y += 30;
    }
    lines.push(text(W / 2 + 1, y, stats, { fill: C.fg, "fill-opacity": 0.9, "font-size": 15, "letter-spacing": 2.5, "text-anchor": "middle", "font-weight": 600 }));
    footerMarkup =
      text(W / 2 + spacing / 2, titleY, track.name, { fill: C.fg, "font-size": f1(titleSize), "font-weight": 700, "letter-spacing": f1(spacing), "text-anchor": "middle", "font-family": ctx.display }) +
      lines.join("") +
      text(W / 2, H - 26, credit, { fill: C.faint, "font-size": 10.5, "text-anchor": "middle" });
  } else {
    // Square: title and stats share a baseline, coordinates under the title, credit at the foot.
    const titleY = footerTop + 30 + titleSize * 0.82;
    footerMarkup =
      text(pad, titleY, track.name, { fill: C.fg, "font-size": f1(titleSize), "font-weight": 700, "letter-spacing": f1(spacing), "font-family": ctx.display }) +
      text(W - pad, titleY - 2, stats, { fill: C.fg, "fill-opacity": 0.9, "font-size": 14, "letter-spacing": 2.5, "text-anchor": "end", "font-weight": 600 }) +
      (coords ? text(pad + 1, titleY + 28, coords, { fill: C.muted, "font-size": 13.5, "letter-spacing": 3.5, "font-weight": 500 }) : "") +
      text(W - pad, titleY + 26, `Ghost lap ${ctx.h.lapTime.formatted}  ·  ${ctx.h.grade}  ·  Homologated ${ctx.year}`, { fill: C.muted, "font-size": 12, "letter-spacing": 2, "text-anchor": "end" }) +
      text(W / 2, H - 20, credit, { fill: C.faint, "font-size": 10, "text-anchor": "middle" });
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${esc(ctx.body)}">
<style>${ctx.fontFace}</style>
<defs>
<clipPath id="cg-clip"><rect x="0" y="0" width="${map.width}" height="${map.height}"/></clipPath>
<linearGradient id="cg-fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.bg}" stop-opacity="0"/><stop offset="1" stop-color="${C.bg}" stop-opacity="1"/></linearGradient>
<radialGradient id="cg-vignette" cx="0.5" cy="0.42" r="0.78"><stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.42"/></radialGradient>
<filter id="cg-paper" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.55" numOctaves="1" seed="${carto.seed % 997}" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0.11 0 0 0 -0.02"/></filter>
${cityDefs("cg")}
</defs>
<rect width="${W}" height="${H}" fill="${C.bg}"/>
<g clip-path="url(#cg-clip)">
${cityLayer(carto, fit, "cg")}
<path d="${full}" fill="none" stroke="${C.bg}" stroke-width="${f1(sw * 2)}" stroke-linecap="round" stroke-linejoin="round"/>
<path d="${full}" fill="none" stroke="${C.fg}" stroke-width="${f1(sw)}" stroke-linecap="round" stroke-linejoin="round"/>
${startFinishTick(track, fit, sw * 1.3, C.fg, C.bg)}
${sectorDots}
<rect x="0" y="${f1(map.height - 70)}" width="${W}" height="70" fill="url(#cg-fade)"/>
</g>
<rect width="${W}" height="${H}" fill="url(#cg-vignette)"/>
<rect width="${W}" height="${H}" filter="url(#cg-paper)" opacity="0.6"/>
${options.northArrow ? northArrow(pad + 4, pad + 36, 64, C.fg, ctx.body) : ""}
${legend.markup}
<line x1="${pad}" y1="${map.height}" x2="${W - pad}" y2="${map.height}" stroke="${C.rule}" stroke-width="1"/>
${footerMarkup}
</svg>`;
}

export const cartographic: StyleDefinition = {
  id: "cartographic",
  name: "Cartographic",
  hint: "Charcoal street map, white line, north arrow",
  palette,
  render,
  story: () => ({ paper: C.bg, ink: C.fg, muted: C.muted }),
};
