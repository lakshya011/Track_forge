import type { Fit } from "../geo/svg";
import type { Pt2 } from "../geo/types";
import type { Cartography, RoadKind } from "./cartography";
import { f1, pts } from "./primitives";

/** How a style wants the shared surroundings drawn. */
export interface MapTheme {
  /** Line-art colour and opacity for outlines, roads and buildings. */
  ink: string;
  inkOpacity: number;
  lineWidth: number;
  /** Field hatch colour/opacity (patterns). */
  hatch: string;
  hatchOpacity: number;
  /** Optional flat field fill. */
  fieldFill?: string;
  /** Contour lines. */
  contour: string;
  contourOpacity: number;
  /** Water fill and outline; `waterHatch` draws engraved ripple lines instead of a flat fill. */
  water: string;
  waterOpacity: number;
  waterStroke?: string;
  waterHatch?: boolean;
  /** Roads: casing is the background colour so roads cut through hatching. */
  road: string;
  roadCasing: string;
  roadWidth: number;
  /** Building fill. */
  building: string;
  buildingOpacity: number;
  idPrefix: string;
}

const poly = (p: Pt2[], fit: Fit, a: string) => `<polygon points="${pts(p, fit)}" ${a}/>`;
const line = (p: Pt2[], fit: Fit, a: string) => `<polyline points="${pts(p, fit)}" fill="none" ${a}/>`;

/** Pattern definitions the layer references (hatch angles, rows, cross, orchard, ripples). */
export function mapDefs(th: MapTheme): string {
  const p = th.idPrefix;
  const out: string[] = [];
  const stroke = `stroke="${th.hatch}" stroke-opacity="${th.hatchOpacity}"`;
  for (const a of [0, 30, 60, 90, 120, 150]) {
    out.push(
      `<pattern id="${p}-hatch-${a}" patternUnits="userSpaceOnUse" width="7" height="7" patternTransform="rotate(${a})"><line x1="0" y1="3.5" x2="7" y2="3.5" ${stroke} stroke-width="0.9"/></pattern>`,
      `<pattern id="${p}-rows-${a}" patternUnits="userSpaceOnUse" width="12" height="12" patternTransform="rotate(${a})"><line x1="0" y1="6" x2="12" y2="6" ${stroke} stroke-width="1.6"/></pattern>`,
      `<pattern id="${p}-cross-${a}" patternUnits="userSpaceOnUse" width="9" height="9" patternTransform="rotate(${a})"><line x1="0" y1="4.5" x2="9" y2="4.5" ${stroke} stroke-width="0.8"/><line x1="4.5" y1="0" x2="4.5" y2="9" ${stroke} stroke-width="0.8"/></pattern>`,
    );
  }
  out.push(`<pattern id="${p}-orchard" patternUnits="userSpaceOnUse" width="11" height="11"><circle cx="5.5" cy="5.5" r="1.7" fill="${th.hatch}" fill-opacity="${th.hatchOpacity}"/></pattern>`);
  out.push(`<pattern id="${p}-ripple" patternUnits="userSpaceOnUse" width="14" height="6"><path d="M0 3 Q3.5 1 7 3 T14 3" fill="none" stroke="${th.water}" stroke-opacity="${th.waterOpacity}" stroke-width="0.9"/></pattern>`);
  out.push(`<pattern id="${p}-bays" patternUnits="userSpaceOnUse" width="6" height="6"><line x1="3" y1="0" x2="3" y2="6" stroke="${th.ink}" stroke-opacity="${th.inkOpacity * 0.6}" stroke-width="0.8"/></pattern>`);
  return out.join("\n");
}

/** Everything but the circuit: contours, fields, woods, water, run-off, roads, car parks, pit complex, stands, buildings. */
export function mapLayer(c: Cartography, fit: Fit, th: MapTheme): string {
  const p = th.idPrefix;
  const out: string[] = [];
  const ink = `stroke="${th.ink}" stroke-opacity="${th.inkOpacity}"`;

  // Contours.
  for (const k of c.contours) {
    const d = k.segments
      .map(([a, b]) => {
        const qa = fit.map(a);
        const qb = fit.map(b);
        return `M${f1(qa.x)} ${f1(qa.y)}L${f1(qb.x)} ${f1(qb.y)}`;
      })
      .join("");
    out.push(`<path d="${d}" fill="none" stroke="${th.contour}" stroke-opacity="${th.contourOpacity}" stroke-width="${f1(th.lineWidth * 0.7)}"/>`);
  }

  // Fields.
  for (const f of c.fields) {
    const fill = f.kind === "plain" ? (th.fieldFill ?? "none") : f.kind === "orchard" ? `url(#${p}-orchard)` : `url(#${p}-${f.kind}-${f.angle})`;
    if (th.fieldFill && f.kind !== "plain") out.push(poly(f.polygon, fit, `fill="${th.fieldFill}"`));
    out.push(poly(f.polygon, fit, `fill="${fill}" ${ink} stroke-width="${f1(th.lineWidth * 0.8)}" stroke-linejoin="round"`));
  }

  // Woodland: stippled, outlined.
  for (const w of c.woods) out.push(poly(w, fit, `fill="url(#${p}-orchard)" ${ink} stroke-width="${f1(th.lineWidth * 0.8)}" stroke-linejoin="round"`));

  // Water: the main body and the ponds.
  for (const w of [...(c.water ? [c.water] : []), ...c.ponds]) {
    if (w.kind === "lake") {
      const fill = th.waterHatch ? `url(#${p}-ripple)` : th.water;
      out.push(poly(w.polygon, fit, `fill="${fill}" fill-opacity="${th.waterHatch ? 1 : th.waterOpacity}" stroke="${th.waterStroke ?? th.water}" stroke-width="${f1(th.lineWidth * 1.2)}" stroke-linejoin="round"`));
    } else {
      const wpx = Math.max(3, w.width * fit.scale);
      if (th.waterHatch) {
        out.push(line(w.pts, fit, `stroke="${th.roadCasing}" stroke-width="${f1(wpx + th.lineWidth * 2)}" stroke-linecap="round" stroke-linejoin="round"`));
        out.push(line(w.pts, fit, `stroke="${th.water}" stroke-opacity="${th.waterOpacity}" stroke-width="${f1(wpx)}" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="1 3"`));
        out.push(line(w.pts, fit, `stroke="${th.waterStroke ?? th.water}" stroke-width="${f1(th.lineWidth)}" stroke-linecap="round" stroke-linejoin="round"`));
      } else {
        out.push(line(w.pts, fit, `stroke="${th.water}" stroke-opacity="${th.waterOpacity}" stroke-width="${f1(wpx)}" stroke-linecap="round" stroke-linejoin="round"`));
      }
    }
  }

  // Run-off and grandstands.
  for (const r of c.runoffs) out.push(poly(r, fit, `fill="url(#${p}-cross-0)" ${ink} stroke-width="${f1(th.lineWidth * 0.7)}" stroke-linejoin="round"`));

  // Roads: casing first so they cut through the hatching, then the line, smallest kinds first.
  const roadW = th.roadWidth;
  const widths: Record<RoadKind, number> = { service: 0.45, street: 0.5, access: 0.9, arterial: 0.95, perimeter: 1, through: 1.25, highway: 1.6 };
  const order: RoadKind[] = ["service", "street", "access", "arterial", "perimeter", "through", "highway"];
  const sorted = [...c.roads].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
  for (const r of sorted) {
    const w = roadW * widths[r.kind];
    out.push(line(r.pts, fit, `stroke="${th.roadCasing}" stroke-width="${f1(w + th.lineWidth * (r.kind === "street" || r.kind === "service" ? 1.6 : 3))}" stroke-linecap="round" stroke-linejoin="round"`));
  }
  for (const r of sorted) {
    const w = roadW * widths[r.kind];
    out.push(line(r.pts, fit, `stroke="${th.road}" stroke-opacity="${r.kind === "street" || r.kind === "service" ? 0.7 : 1}" stroke-width="${f1(w)}" stroke-linecap="round" stroke-linejoin="round"`));
    if (r.kind === "through" || r.kind === "highway") out.push(line(r.pts, fit, `stroke="${th.roadCasing}" stroke-width="${f1(Math.max(0.8, w * 0.18))}" stroke-dasharray="6 6" stroke-linecap="butt" stroke-linejoin="round"`));
  }
  for (const t of c.tunnels) out.push(line(t, fit, `${ink} stroke-width="${f1(th.lineWidth)}" stroke-dasharray="3 3"`));

  // Car parks: outline plus dashed lanes.
  for (const cp of c.carParks) {
    out.push(poly(cp.outline, fit, `fill="${th.roadCasing}" ${ink} stroke-width="${f1(th.lineWidth)}"`));
    for (const row of cp.rows) out.push(line(row, fit, `stroke="${th.ink}" stroke-opacity="${th.inkOpacity * 0.8}" stroke-width="${f1(th.lineWidth * 0.8)}" stroke-dasharray="2.5 2.5"`));
  }

  // Pit complex and stands.
  for (const st of c.stands) out.push(poly(st, fit, `fill="${th.building}" fill-opacity="${th.buildingOpacity * 1.2}" ${ink} stroke-width="${f1(th.lineWidth * 0.8)}"`));
  out.push(line(c.pitLane, fit, `${ink} stroke-width="${f1(th.lineWidth * 1.4)}" stroke-linejoin="round"`));
  out.push(poly(c.pitBuilding, fit, `fill="${th.building}" fill-opacity="${th.buildingOpacity}" ${ink} stroke-width="${f1(th.lineWidth)}"`));
  for (const b of c.paddock) out.push(poly(b, fit, `fill="${th.building}" fill-opacity="${th.buildingOpacity * 0.8}" ${ink} stroke-width="${f1(th.lineWidth)}"`));

  // Hamlets.
  for (const b of c.buildings) out.push(poly(b, fit, `fill="${th.building}" fill-opacity="${th.buildingOpacity}" ${ink} stroke-width="${f1(th.lineWidth * 0.8)}"`));

  return out.join("\n");
}
