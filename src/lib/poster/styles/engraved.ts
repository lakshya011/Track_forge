import { pathD } from "../../geo/svg";
import { buildCartography } from "../cartography";
import { mapDefs, mapLayer, type MapTheme } from "../mapLayer";
import { attributionRow, cornerNamesAlongPath, creditText, esc, f1, fitTitleSize, fitTrack, startFinishTick, text } from "../primitives";
import type { Palette, RenderContext, StyleDefinition, Wood } from "../types";

interface WoodTheme {
  light: string;
  base: string;
  dark: string;
  grain: string;
  grainOpacity: number;
  ink: string;
  inkSoft: string;
  circuit: string;
  shadow: string;
  highlight: string;
}

const WOODS: Record<Wood, WoodTheme> = {
  oak: { light: "#e6cfa6", base: "#d6b88a", dark: "#bf9c6c", grain: "#6b4524", grainOpacity: 0.32, ink: "#1d140c", inkSoft: "#5b4a3a", circuit: "#15110d", shadow: "#3a2812", highlight: "#f1e2c4" },
  walnut: { light: "#7a5636", base: "#64432a", dark: "#4b301c", grain: "#1e100a", grainOpacity: 0.42, ink: "#f0e4cf", inkSoft: "#cdb897", circuit: "#f3e9d6", shadow: "#1a0f08", highlight: "#ffffff" },
  black: { light: "#2b2826", base: "#1d1b19", dark: "#121110", grain: "#000000", grainOpacity: 0.5, ink: "#d9cfbf", inkSoft: "#9b8f7c", circuit: "#efe6d3", shadow: "#000000", highlight: "#3a3633" },
};

export const palette: Palette = {
  bg: "#d6b88a",
  fg: "#1d140c",
  muted: "#5b4a3a",
  accent: "#1d140c",
  sectors: ["#1d140c", "#1d140c", "#1d140c"],
  asphalt: "#15110d",
  edge: "#15110d",
  kerbA: "#1d140c",
  kerbB: "#d6b88a",
  gravel: "#5b4a3a",
  gravelDot: "#5b4a3a",
  stands: "#5b4a3a",
  standsRow: "#5b4a3a",
  standsEdge: "#1d140c",
  left: "#1d140c",
  right: "#1d140c",
};

function layout(W: number, H: number, name: string) {
  const inset = Math.round(W * 0.045);
  const tall = H / W >= 1.4;
  const titleSize = fitTitleSize(name, W - 2 * inset - 120, tall ? 150 : 124, 0.5, 0.04);
  const band = Math.round(titleSize * 1.05 + 150);
  const map = { x: inset, y: inset, width: W - 2 * inset, height: H - inset - band };
  return { inset, titleSize, band, map };
}

function render(ctx: RenderContext): string {
  const { track, W, H } = ctx;
  const wood = WOODS[ctx.options.wood] ?? WOODS.oak;
  const { inset, titleSize, band, map } = layout(W, H, track.name);
  const carto = ctx.cartography ?? buildCartography(track);
  const { fit, sw: baseSw } = fitTrack(track, map, Math.round(map.width * 0.11));
  const sw = baseSw * 0.78;
  const theme: MapTheme = {
    ink: wood.ink,
    inkOpacity: 0.62,
    lineWidth: 1.1,
    hatch: wood.ink,
    hatchOpacity: 0.38,
    contour: wood.ink,
    contourOpacity: 0.2,
    water: wood.ink,
    waterOpacity: 0.55,
    waterStroke: wood.ink,
    waterHatch: true,
    road: wood.ink,
    roadCasing: wood.base,
    roadWidth: 2.2,
    building: wood.ink,
    buildingOpacity: 0.22,
    idPrefix: "eg",
  };
  const names = cornerNamesAlongPath(track, fit, {
    offset: sw * 1.75,
    fontSize: Math.max(14, sw * 1.0),
    color: wood.ink,
    font: ctx.body,
    weight: 600,
    letterSpacing: 0.6,
    maxCorners: 16,
    shortUpTo: 40,
    idPrefix: "eg-cn",
  });
  const full = pathD(track.loop, fit);
  const subtitle = `GRAND PRIX CIRCUIT  ·  ${(track.length / 1000).toFixed(3)} KM  ·  ${track.corners.length} CORNERS  ·  GHOST LAP ${ctx.h.lapTime.formatted}`;
  const titleY = map.y + map.height + Math.round(band * 0.5) + titleSize * 0.3;
  // A cartouche in the map's bottom-right corner, like a surveyor's mark: a plate in the board's own
  // tone with a hairline, the code stamped in the ink, the link beside it.
  const side = Math.round(W * 0.05);
  const cartouche = attributionRow(ctx, {
    x: map.x + map.width - 18,
    y: map.y + map.height - 18 - side,
    align: "end",
    color: wood.inkSoft,
    qrColor: wood.ink,
    qrOpacity: 0.85,
    side,
    plate: { fill: wood.base, opacity: 0.96, stroke: wood.ink, pad: 10, radius: 2 },
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${esc(ctx.body)}">
<style>${ctx.fontFace}</style>
<defs>
<linearGradient id="eg-wood" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${wood.light}"/><stop offset="0.55" stop-color="${wood.base}"/><stop offset="1" stop-color="${wood.dark}"/></linearGradient>
<filter id="eg-grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.22 0.0028" numOctaves="3" seed="${carto.seed % 1000}" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1.4 0 0 0 -0.45" result="a"/><feFlood flood-color="${wood.grain}" flood-opacity="${wood.grainOpacity}" result="c"/><feComposite in="c" in2="a" operator="in" result="g"/><feBlend in="g" in2="SourceGraphic" mode="multiply"/></filter>
<filter id="eg-shadow" x="-10%" y="-10%" width="120%" height="120%"><feDropShadow dx="${f1(sw * 0.18)}" dy="${f1(sw * 0.28)}" stdDeviation="${f1(sw * 0.22)}" flood-color="${wood.shadow}" flood-opacity="0.55"/></filter>
<radialGradient id="eg-light" cx="0.25" cy="0.15" r="0.9"><stop offset="0" stop-color="#ffffff" stop-opacity="0.16"/><stop offset="1" stop-color="#000000" stop-opacity="0.14"/></radialGradient>
<clipPath id="eg-clip"><rect x="${map.x}" y="${map.y}" width="${map.width}" height="${map.height}"/></clipPath>
${mapDefs(theme)}
${names.defs}
</defs>
<rect width="${W}" height="${H}" fill="url(#eg-wood)" filter="url(#eg-grain)"/>
<rect width="${W}" height="${H}" fill="url(#eg-light)"/>
<rect x="${inset * 0.5}" y="${inset * 0.5}" width="${W - inset}" height="${H - inset}" fill="none" stroke="${wood.ink}" stroke-opacity="0.5" stroke-width="2"/>
<rect x="${inset * 0.5 + 7}" y="${inset * 0.5 + 7}" width="${W - inset - 14}" height="${H - inset - 14}" fill="none" stroke="${wood.ink}" stroke-opacity="0.35" stroke-width="0.8"/>
<g clip-path="url(#eg-clip)">
${mapLayer(carto, fit, theme)}
</g>
<line x1="${map.x}" y1="${map.y + map.height}" x2="${map.x + map.width}" y2="${map.y + map.height}" stroke="${wood.ink}" stroke-opacity="0.45" stroke-width="1"/>
<g filter="url(#eg-shadow)"><path d="${full}" fill="none" stroke="${wood.circuit}" stroke-width="${f1(sw)}" stroke-linecap="round" stroke-linejoin="round"/></g>
<path d="${full}" fill="none" stroke="${wood.highlight}" stroke-opacity="0.35" stroke-width="${f1(sw * 0.22)}" stroke-linecap="round" stroke-linejoin="round" transform="translate(${f1(-sw * 0.16)} ${f1(-sw * 0.22)})"/>
${startFinishTick(track, fit, sw * 1.1, wood.ink, wood.base)}
${names.body}
${cartouche.markup}
${text(W / 2, titleY, track.name, { fill: wood.ink, "font-size": f1(titleSize), "font-weight": 800, "letter-spacing": f1(titleSize * 0.04), "text-anchor": "middle", "font-family": ctx.display })}
${text(W / 2, titleY + 46, subtitle, { fill: wood.inkSoft, "font-size": 17, "letter-spacing": 4, "text-anchor": "middle", "font-weight": 600 })}
${text(W / 2, H - inset * 0.5 - 16, creditText(ctx.lengthReference, "Surroundings are fictional and generated"), { fill: wood.inkSoft, "font-size": 11, "text-anchor": "middle", "fill-opacity": 0.85 })}
</svg>`;
}

export const engraved: StyleDefinition = {
  id: "engraved",
  name: "Engraved",
  hint: "Wood board, raised line, corner names",
  palette,
  render,
  story: (ctx) => {
    const wood = WOODS[ctx.options.wood] ?? WOODS.oak;
    return { paper: wood.base, ink: wood.ink, muted: wood.inkSoft };
  },
};
