import { lapsFor } from "../../geo";
import { pathD } from "../../geo/svg";
import { CAR_GROUND, carMarkup } from "../car";
import { attributionRow, creditText, esc, f1, fitTitleSize, fitTrack, startFinishTick, text } from "../primitives";
import { teamFor, wordLines, type Team } from "../teams";
import type { Palette, RenderContext, StyleDefinition } from "../types";

/*
 * Team car: a magazine cover. Off-white paper with fine grain, the team's name as a giant display
 * word in its pale tint running up the right side (2:3) or across the top (1:1), the car head-on
 * over it (two-word names become two rotated columns or two stacked lines), tiny
 * editorial blocks (masthead top-left, a stats column with hairline rules, a thin circuit outline),
 * a vertical label on the right edge, crop marks and the credit at the foot. The circuit's name
 * appears once, small, in the stats: the car is the picture.
 */

export const palette: Palette = {
  bg: "#f6f1e8",
  fg: "#161616",
  muted: "#6e6a64",
  accent: "#ff4fa3",
  sectors: ["#161616", "#161616", "#161616"],
  asphalt: "#161616",
  edge: "#161616",
  kerbA: "#d62828",
  kerbB: "#f6f1e8",
  gravel: "#c9b58a",
  gravelDot: "#c9b58a",
  stands: "#6e6a64",
  standsRow: "#6e6a64",
  standsEdge: "#161616",
  left: "#6e6a64",
  right: "#6e6a64",
};

const MUTED = "#6e6a64";
const RULE = "#d9d3c7";

function cropMarks(W: number, H: number, ink: string): string {
  const a = 16;
  const b = 44;
  const m = (x1: number, y1: number, x2: number, y2: number) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${ink}" stroke-opacity="0.55" stroke-width="1"/>`;
  return (
    m(a, b, b, b) + m(b, a, b, b) +
    m(W - a, b, W - b, b) + m(W - b, a, W - b, b) +
    m(a, H - b, b, H - b) + m(b, H - a, b, H - b) +
    m(W - a, H - b, W - b, H - b) + m(W - b, H - a, W - b, H - b)
  );
}

interface Row {
  label: string;
  value: string;
}

function rows(ctx: RenderContext): Row[] {
  const t = ctx.track;
  return [
    { label: "CIRCUIT", value: t.name },
    { label: "LENGTH", value: `${(t.length / 1000).toFixed(3)} km` },
    { label: "CORNERS", value: String(t.corners.length) },
    { label: "LONGEST STRAIGHT", value: `${Math.round(t.longestStraight.length)} m` },
    { label: "GHOST LAP", value: ctx.h.lapTime.formatted },
    { label: "DIFFICULTY", value: `${ctx.h.difficulty} / 10` },
    { label: "HOMOLOGATED", value: String(ctx.year) },
  ];
}

/** A stats column: tiny caps label, display value, hairline under each row. `align` end puts values flush right. */
function statsColumn(items: Row[], x: number, y0: number, width: number, rowH: number, ctx: RenderContext, team: Team, align: "start" | "end" = "start"): string {
  const tx = align === "end" ? x + width : x;
  return items
    .map((r, i) => {
      const y = y0 + i * rowH;
      const long = r.value.length > 12;
      return (
        text(tx, y, r.label, { fill: MUTED, "font-size": 10.5, "letter-spacing": 2.5, "font-weight": 600, "text-anchor": align }) +
        text(tx, y + 27, r.value, { fill: team.ink, "font-size": long ? 18 : 22, "font-weight": 700, "font-family": ctx.display, "text-anchor": align }) +
        `<line x1="${x}" y1="${f1(y + 40)}" x2="${f1(x + width)}" y2="${f1(y + 40)}" stroke="${RULE}" stroke-width="1"/>`
      );
    })
    .join("\n");
}

function outline(ctx: RenderContext, box: { x: number; y: number; width: number; height: number }, ink: string): string {
  const { fit } = fitTrack(ctx.track, box, 10);
  const sw = Math.max(2, Math.min(3.5, fit.width * 0.012));
  return (
    `<path d="${pathD(ctx.track.loop, fit)}" fill="none" stroke="${ink}" stroke-width="${f1(sw)}" stroke-linecap="round" stroke-linejoin="round"/>` +
    startFinishTick(ctx.track, fit, sw * 2, ink, palette.bg)
  );
}

function render(ctx: RenderContext): string {
  const { track, W, H } = ctx;
  const team = teamFor(track.name, track.seed, ctx.options.team);
  const tall = H / W >= 1.4;
  const pad = tall ? 72 : 64;
  const ink = team.ink;
  const number = String(track.corners.length);
  const grade = ctx.h.grade.toUpperCase();

  // Masthead, right-edge label, crop marks and credit are shared by both layouts.
  const masthead =
    text(pad, pad + 12, "TRACK FORGE", { fill: ink, "font-size": 13, "font-weight": 800, "letter-spacing": 4.5, "font-family": ctx.display }) +
    text(pad, pad + 32, `${grade} · ${ctx.year} SEASON`, { fill: MUTED, "font-size": 10.5, "letter-spacing": 3, "font-weight": 600 });
  const edgeLabel = text(W - 27, H / 2, "BUILT FROM YOUR NAME", {
    fill: MUTED,
    "font-size": 10.5,
    "letter-spacing": 5,
    "font-weight": 600,
    "text-anchor": "middle",
    transform: `rotate(-90 ${W - 27} ${H / 2})`,
  });
  // Two short lines at the foot: the reference and livery note, then the mandatory credit.
  const noteLine = [ctx.lengthReference ? `Length reference: ${ctx.lengthReference}` : "", "Unofficial fan livery · not affiliated with any team"].filter(Boolean).join("  ·  ");
  const credit =
    text(pad, H - 54, noteLine, { fill: MUTED, "font-size": tall ? 10.5 : 9.5 }) +
    text(pad, H - 38, creditText(), { fill: MUTED, "font-size": tall ? 10.5 : 9.5 });
  const licenceLine = `${lapsFor(track.length)} LAPS · LICENCE ${ctx.h.licence}`;

  let word: string;
  let car: string;
  let stats: string;
  let map: string;
  let attribution: string;
  if (tall) {
    // The word runs up the right side, the car over its lower half, stats down the left margin.
    // Anchored at the top so a short word peeks above the car and a long one runs the full height.
    // A two-word name becomes two rotated columns, the first word inward, sized by the longer word,
    // so neither word hides entirely behind the car.
    const lines = wordLines(team, 0);
    const longest = lines.reduce((a, b) => (b.length > a.length ? b : a), "");
    const size = fitTitleSize(longest, H - 2 * pad - 20, lines.length > 1 ? 400 : 640, 0.52, -0.01);
    const bx = W - 58;
    const by = pad + 24;
    word = lines
      .map((line, i) => {
        const x = bx - (lines.length - 1 - i) * size * 0.86;
        return text(x, by, line, {
          fill: team.tint,
          "font-size": f1(size),
          "font-weight": 800,
          "font-family": ctx.display,
          "letter-spacing": f1(-size * 0.01),
          "text-anchor": "end",
          transform: `rotate(-90 ${x} ${by})`,
        });
      })
      .join("\n");
    const s = 1.3;
    const ground = H - 150;
    car = `<g transform="translate(${W / 2} ${f1(ground - CAR_GROUND * s)}) scale(${s})">${carMarkup({ id: "tc", colours: team, number, font: ctx.display })}</g>`;
    stats =
      statsColumn(rows(ctx), pad, 300, 250, 62, ctx, team) +
      text(pad, 300 + 7 * 62 + 4, ctx.h.tags.map((t) => t.toUpperCase()).join(" · "), { fill: MUTED, "font-size": 10, "letter-spacing": 2 }) +
      text(pad, 300 + 7 * 62 + 22, licenceLine, { fill: MUTED, "font-size": 10, "letter-spacing": 1.5 });
    map = outline(ctx, { x: W - pad - 230, y: pad + 70, width: 230, height: 230 }, ink);
    // Between the masthead and the stats column, where a cover keeps its issue block; the column's
    // foot is under the front wing.
    attribution = attributionRow(ctx, { x: pad, y: pad + 32 + 52, align: "start", color: MUTED, qrColor: MUTED, side: 60, urlSize: 12, capsSize: 9 }).markup;
  } else {
    // The word sits across the top behind the airbox; the car lower and larger; stats in two columns.
    // A two-word name stacks as two centred lines above the same baseline.
    const lines = wordLines(team);
    const longest = lines.reduce((a, b) => (b.length > a.length ? b : a), "");
    const size = fitTitleSize(longest, W - 2 * pad, lines.length > 1 ? 300 : 520, 0.52, -0.01);
    const baseline = lines.length > 1 ? 500 : 470;
    word = lines
      .map((line, i) =>
        text(W / 2, baseline - (lines.length - 1 - i) * size * 0.82, line, {
          fill: team.tint,
          "font-size": f1(size),
          "font-weight": 800,
          "font-family": ctx.display,
          "letter-spacing": f1(-size * 0.01),
          "text-anchor": "middle",
        }),
      )
      .join("\n");
    const s = 1.05;
    const ground = H - 62;
    car = `<g transform="translate(${W / 2} ${f1(ground - CAR_GROUND * s)}) scale(${s})">${carMarkup({ id: "tc", colours: team, number, font: ctx.display })}</g>`;
    const all = rows(ctx);
    stats =
      statsColumn(all.slice(0, 4), pad, 500, 236, 54, ctx, team) +
      statsColumn(all.slice(4), W - pad - 236, 500, 236, 54, ctx, team, "end") +
      text(W - pad, 500 + 3 * 54 + 4, licenceLine, { fill: MUTED, "font-size": 10, "letter-spacing": 1.5, "text-anchor": "end" });
    map = outline(ctx, { x: pad, y: pad + 70, width: 190, height: 190 }, ink);
    // The front tyres cover the column feet on the square sheet, so the row sits in the masthead
    // band at the top right, where a cover keeps its issue block.
    attribution = attributionRow(ctx, { x: W - pad, y: pad - 6, align: "end", color: MUTED, qrColor: MUTED, side: 56, urlSize: 11.5, capsSize: 9 }).markup;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${esc(ctx.body)}">
<style>${ctx.fontFace}</style>
<defs>
<filter id="tc-paper" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed="5" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0.14 0 0 0 -0.03"/></filter>
</defs>
<rect width="${W}" height="${H}" fill="${team.paper}"/>
<rect width="${W}" height="${H}" filter="url(#tc-paper)" opacity="0.6"/>
${word}
${masthead}
${stats}
${attribution}
${map}
${car}
${edgeLabel}
${cropMarks(W, H, ink)}
${credit}
</svg>`;
}

export const teamcar: StyleDefinition = {
  id: "teamcar",
  name: "Team car",
  hint: "Magazine cover with your team's livery",
  palette,
  render,
  story: (ctx) => {
    const team = teamFor(ctx.track.name, ctx.track.seed, ctx.options.team);
    return { paper: team.paper, ink: team.ink, muted: MUTED };
  },
};

