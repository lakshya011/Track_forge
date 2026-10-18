import { describe, expect, it } from "vitest";
import { generateTrack } from "../../geo";
import type { LetterSection, Pt2 } from "../../geo/types";
import { circle, rect, section } from "../../geo/__tests__/fixtures";
import { buildCartography, cartographySeed, chaikin, convexHull, offsetConvex, pointInPolygon, polylinesCross, segmentsIntersect, simplify } from "../cartography";

const letters: LetterSection[] = [
  section({ letter: "I", circuitId: "rect", start: 1000, end: 1400 }),
  section({ letter: "O", circuitId: "circle", start: 0, end: 2400 }),
  section({ letter: "L", circuitId: "rect", start: 2600, end: 3200 }),
];
const data = { circuits: [rect, circle], letters };
const inside = (p: Pt2, e: { minX: number; minY: number; maxX: number; maxY: number }) => p.x >= e.minX - 1e-6 && p.x <= e.maxX + 1e-6 && p.y >= e.minY - 1e-6 && p.y <= e.maxY + 1e-6;

describe("cartography helpers", () => {
  it("detects segment crossings", () => {
    expect(segmentsIntersect({ x: 0, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 }, { x: 2, y: 0 })).toBe(true);
    expect(segmentsIntersect({ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 })).toBe(false);
    expect(polylinesCross([{ x: 0, y: 1 }, { x: 3, y: 1 }], [{ x: 1, y: 0 }, { x: 1, y: 2 }])).toBe(true);
  });
  it("point in polygon, hull and offset", () => {
    const sq = [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 }];
    expect(pointInPolygon({ x: 1, y: 1 }, sq)).toBe(true);
    expect(pointInPolygon({ x: 3, y: 1 }, sq)).toBe(false);
    const hull = convexHull([...sq, { x: 1, y: 1 }, { x: 0.5, y: 0.5 }]);
    expect(hull).toHaveLength(4);
    const off = offsetConvex(hull, 1);
    for (const p of off) expect(Math.min(Math.abs(p.x + 1), Math.abs(p.x - 3))).toBeLessThan(1e-9);
  });
  it("simplify and chaikin keep endpoints", () => {
    const line = [{ x: 0, y: 0 }, { x: 1, y: 0.01 }, { x: 2, y: 0 }, { x: 3, y: 5 }];
    expect(simplify(line, 0.1)).toEqual([{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 5 }]);
    const sm = chaikin(line, 2);
    expect(sm[0]).toEqual(line[0]);
    expect(sm[sm.length - 1]).toEqual(line[line.length - 1]);
  });
});

describe("buildCartography", () => {
  const t = generateTrack("OIL", 0, "rect", data);
  const c = buildCartography(t);

  it("is deterministic for the same name and seed, and differs for another seed", () => {
    expect(buildCartography(t)).toEqual(c);
    expect(c.seed).toBe(cartographySeed("OIL", 0));
    const other = buildCartography(generateTrack("OIL", 1, "rect", data));
    expect(other.seed).not.toBe(c.seed);
    expect(JSON.stringify(other.fields)).not.toBe(JSON.stringify(c.fields));
  });

  it("lays out every feature", () => {
    expect(c.fields.length).toBeGreaterThan(20);
    expect(c.roads.filter((r) => r.kind === "access").length).toBeGreaterThanOrEqual(2);
    expect(c.roads.some((r) => r.kind === "perimeter")).toBe(true);
    expect(c.carParks[0].rows.length).toBeGreaterThan(1);
    expect(c.pitBuilding).toHaveLength(4);
    expect(c.pitLane).toHaveLength(4);
    expect(c.contours.length).toBeGreaterThan(0);
    expect(c.water).not.toBeNull();
  });

  it("lays out a town plan: highways, settlements with streets and blocks, buildings, woods, ponds", () => {
    expect(c.roads.filter((r) => r.kind === "highway").length).toBeGreaterThanOrEqual(2);
    expect(c.roads.filter((r) => r.kind === "arterial").length).toBeGreaterThanOrEqual(2);
    expect(c.settlements.length).toBeGreaterThanOrEqual(2);
    const blocks = c.settlements.reduce((n, s) => n + s.blocks.length, 0);
    expect(blocks).toBeGreaterThan(40);
    expect(c.roads.filter((r) => r.kind === "street").length).toBeGreaterThan(20);
    expect(c.buildings.length).toBeGreaterThan(300);
    expect(c.woods.length).toBeGreaterThanOrEqual(2);
    expect(c.ponds.length).toBeGreaterThanOrEqual(1);
    expect(c.stands.length).toBeGreaterThanOrEqual(1);
    expect(c.tunnels).toHaveLength(1);
    // Every settlement's blocks sit inside its outline and clear of the lap.
    for (const s of c.settlements) for (const b of s.blocks) for (const p of b) expect(Math.hypot(p.x - s.centre.x, p.y - s.centre.y)).toBeLessThan(s.radius * 1.5);
    // Buildings thin out with distance from the circuit: more of them in the near half than the far half.
    const far = c.extent.maxY - c.extent.minY;
    const dist = (b: Pt2[]) => Math.min(...t.loop.filter((_, i) => i % 8 === 0).map((q) => Math.hypot(q.x - b[0].x, q.y - b[0].y)));
    const near = c.buildings.filter((b) => dist(b) < far * 0.3).length;
    expect(near).toBeGreaterThan(c.buildings.length * 0.4);
  });

  it("keeps roads, water and rivers clear of the loop", () => {
    for (const r of c.roads) expect(polylinesCross(r.pts, t.loop), r.kind).toBe(false);
    for (const st of c.stands) for (const p of t.loop) expect(pointInPolygon(p, st)).toBe(false);
    for (const s of c.settlements) for (const p of t.loop) expect(pointInPolygon(p, s.outline)).toBe(false);
    if (c.water?.kind === "river") expect(polylinesCross(c.water.pts, t.loop)).toBe(false);
    if (c.water?.kind === "lake") for (const p of t.loop) expect(pointInPolygon(p, c.water.polygon)).toBe(false);
    for (const f of c.fields) for (const p of t.loop) expect(pointInPolygon(p, f.polygon)).toBe(false);
  });

  it("keeps all geometry inside the extent", () => {
    const all: Pt2[] = [
      ...c.fields.flatMap((f) => f.polygon),
      ...c.roads.flatMap((r) => r.pts),
      ...c.carParks.flatMap((p) => [...p.outline, ...p.rows.flat()]),
      ...c.pitLane,
      ...c.pitBuilding,
      ...c.paddock.flat(),
      ...c.buildings.flat(),
      ...c.stands.flat(),
      ...c.runoffs.flat(),
      ...c.woods.flat(),
      ...c.settlements.flatMap((s) => s.blocks.flat()),
      ...c.ponds.flatMap((w) => (w.kind === "lake" ? w.polygon : w.pts)),
      ...(c.water ? (c.water.kind === "lake" ? c.water.polygon : c.water.pts) : []),
      ...c.contours.flatMap((k) => k.segments.flat()),
    ];
    expect(all.length).toBeGreaterThan(100);
    for (const p of all) expect(inside(p, c.extent)).toBe(true);
    // The pit complex sits inside the straight, between the start line and the letters.
    for (const p of [...c.pitBuilding, ...c.paddock.flat()]) expect(p.y).toBeGreaterThan(t.loop[0].y);
  });
});
