import { lapsFor } from "../../geo";
import { creditText, esc, f1, fitTitleSize, fitTrack, frame, statsGrid, text, trackDefs, trackLayer, type StatItem } from "../primitives";
import type { Palette, RenderContext, StyleDefinition } from "../types";

/*
 * Sector: the framed dark poster. Title and seal at the top, the furnished lap in a generous band,
 * five headline numbers in a three-column grid and one credit line at the foot. Grade, year and
 * licence live on the seal; tags, difficulty and the sources line are left to the licence card so
 * the sheet has room to breathe. Corner numbers are drawn only when the lap has at most
 * MAX_NUMBERED corners.
 */

export const palette: Palette = {
  bg: "#0b0b0f",
  fg: "#f4f4f5",
  muted: "#8b8b94",
  accent: "#e8322e",
  sectors: ["#e8322e", "#3dd68c", "#f5c542"],
  asphalt: "#2a2a33",
  edge: "#e4e4e7",
  kerbA: "#e8322e",
  kerbB: "#f4f4f5",
  gravel: "#b8a16a",
  gravelDot: "#d9c48e",
  stands: "#30303b",
  standsRow: "#43434f",
  standsEdge: "#52525f",
  left: "#60a5fa",
  right: "#fb923c",
};

/** Above this many corners the numbered rings would crowd the lap, so they are left off. */
export const MAX_NUMBERED = 16;

/** One type scale per ratio; everything else is derived from the padding. */
function layout(W: number, H: number, name: string) {
  const pad = W * 0.1;
  const tall = H / W >= 1.4;
  const sealR = 86;
  const titleSize = fitTitleSize(name, W - 2 * pad - 2 * sealR - 40, tall ? 150 : 112, 0.55, 0.06);
  const titleY = pad + Math.max(70, titleSize * 0.78);
  const subtitleY = titleY + 44;
  const trackTop = subtitleY + 70;
  const labelSize = 20;
  const valueSize = tall ? 56 : 44;
  const rowHeight = tall ? 150 : 112;
  // Two rows of label-over-value: the second row's value baseline plus a descender's worth.
  const statsH = rowHeight + labelSize * 2.4 + valueSize * 0.3;
  const creditY = H - pad + 24;
  const statsY = creditY - 70 - statsH;
  const ruleY = statsY - 64;
  // The map may run a little past the text margin: a wide lap from a long name gets every pixel it can.
  const trackBox = { x: pad * 0.7, y: trackTop, width: W - 1.4 * pad, height: ruleY - 40 - trackTop };
  return { pad, tall, sealR, titleSize, titleY, subtitleY, trackBox, ruleY, statsY, rowHeight, labelSize, valueSize, creditY };
}

/** The five numbers under the map: lap length, corners, race laps, longest straight and the ghost lap. */
function items(ctx: RenderContext): StatItem[] {
  const t = ctx.track;
  return [
    { label: "CIRCUIT LENGTH", value: `${(t.length / 1000).toFixed(3)} km` },
    { label: "CORNERS", value: String(t.corners.length) },
    { label: "LAPS", value: String(lapsFor(t.length)) },
    { label: "LONGEST STRAIGHT", value: `${Math.round(t.longestStraight.length)} m` },
    { label: "GHOST LAP", value: ctx.h.lapTime.formatted, accent: true },
  ];
}

function render(ctx: RenderContext): string {
  const { track, W, H, h, year } = ctx;
  const pal = palette;
  const L = layout(W, H, track.name);
  const { fit, sw } = fitTrack(track, L.trackBox, 40);
  const sealX = W - L.pad - L.sealR;
  const sealY = L.pad + L.sealR - 10;
  const display = ctx.display;
  const body = ctx.body;
  const seal =
    `<g transform="rotate(-9 ${f1(sealX)} ${f1(sealY)})" opacity="0.95" font-family="${esc(body)}">` +
    `<circle cx="${f1(sealX)}" cy="${f1(sealY)}" r="${L.sealR}" fill="none" stroke="${pal.accent}" stroke-width="4"/>` +
    `<circle cx="${f1(sealX)}" cy="${f1(sealY)}" r="${L.sealR - 9}" fill="none" stroke="${pal.accent}" stroke-width="1.5"/>` +
    text(sealX, sealY - 34, "TRACK FORGE", { fill: pal.accent, "font-size": 13, "font-weight": 700, "letter-spacing": 2.5, "text-anchor": "middle" }) +
    text(sealX, sealY + 12, h.grade.toUpperCase(), { fill: pal.accent, "font-size": 38, "font-weight": 800, "text-anchor": "middle", "font-family": display }) +
    text(sealX, sealY + 34, `HOMOLOGATED ${year}`, { fill: pal.accent, "font-size": 11, "font-weight": 700, "letter-spacing": 1.5, "text-anchor": "middle" }) +
    text(sealX, sealY + 52, h.licence, { fill: pal.accent, "font-size": 10, "letter-spacing": 1.5, "text-anchor": "middle", opacity: 0.8 }) +
    `</g>`;

  // The length reference sits under the subtitle, in the same voice.
  const reference = ctx.lengthReference ? text(L.pad, L.subtitleY + 30, `Same lap length as ${ctx.lengthReference}`, { fill: pal.muted, "font-size": 18, "fill-opacity": 0.85 }) : "";

  const stats = statsGrid(items(ctx), {
    x: L.pad,
    y: L.statsY,
    width: W - 2 * L.pad,
    columns: 3,
    rowHeight: L.rowHeight,
    labelSize: L.labelSize,
    valueSize: L.valueSize,
    labelColor: pal.muted,
    valueColor: pal.fg,
    accentColor: pal.sectors[2],
    labelFont: body,
    valueFont: display,
  });

  const corners = track.corners.length <= MAX_NUMBERED ? "numbered" : "none";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${esc(body)}">
<style>${ctx.fontFace}</style>
<defs>${trackDefs(sw, pal)}</defs>
<rect width="${W}" height="${H}" fill="${pal.bg}"/>
${frame(W, H, L.pad * 0.5, pal.muted)}
${text(L.pad, L.titleY, track.name, { fill: pal.fg, "font-size": f1(L.titleSize), "font-weight": 800, "letter-spacing": f1(L.titleSize * 0.06), "font-family": display })}
${text(L.pad, L.subtitleY, "A GRAND PRIX CIRCUIT BUILT FROM YOUR NAME", { fill: pal.muted, "font-size": 18, "letter-spacing": 5 })}
${reference}
${seal}
<g>${trackLayer(track, fit, pal, { sw, corners, maxNamedCorners: ctx.maxNamedCorners })}</g>
<line x1="${f1(L.pad)}" y1="${f1(L.ruleY)}" x2="${f1(W - L.pad)}" y2="${f1(L.ruleY)}" stroke="${pal.muted}" stroke-opacity="0.3" stroke-width="1"/>
${stats}
${text(W / 2, L.creditY, creditText(), { fill: pal.muted, "font-size": 14, "text-anchor": "middle", "fill-opacity": 0.8 })}
</svg>`;
}

export const sector: StyleDefinition = {
  id: "sector",
  name: "Sector",
  hint: "Dark frame, sector colours, grade seal",
  palette,
  render,
};
