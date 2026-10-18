import { describe, expect, it } from "vitest";
import { detectCorners, longestStraight, sectors } from "../corners";
import { closeRing, resample } from "../project";
import type { Sample } from "../types";

function arcPts(cx: number, cy: number, r: number, a0: number, a1: number, n: number) {
  return Array.from({ length: n }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / (n - 1);
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  });
}

/** Rounded rectangle 1000 x 400 with 50 m corner radius -> 4 right-angle corners. */
function roundedRect(): Sample[] {
  const r = 50;
  const pts = [
    ...arcPts(1000 - r, r, r, -Math.PI / 2, 0, 12),
    ...arcPts(1000 - r, 400 - r, r, 0, Math.PI / 2, 12),
    ...arcPts(r, 400 - r, r, Math.PI / 2, Math.PI, 12),
    ...arcPts(r, r, r, Math.PI, 1.5 * Math.PI, 12),
  ];
  // start at the middle of the bottom straight
  const start = { x: 500, y: 0 };
  return resample(closeRing([start, ...pts].map((p) => ({ ...p, z: 0 }))), 5);
}

describe("corners", () => {
  it("finds four ~90 degree left-handers on a counter-clockwise rounded rectangle", () => {
    const loop = roundedRect();
    const corners = detectCorners(loop);
    expect(corners).toHaveLength(4);
    corners.forEach((c, i) => {
      expect(c.number).toBe(i + 1);
      expect(c.direction).toBe("L");
      expect(Math.abs(c.angleDeg)).toBeGreaterThan(70);
      expect(Math.abs(c.angleDeg)).toBeLessThan(110);
    });
    expect(corners[0].dist).toBeLessThan(corners[1].dist);
    // first corner is the bottom-right one, ~450 m from the start
    expect(corners[0].apex.x).toBeGreaterThan(900);
  });
  it("finds no corners on a large circle (constant gentle curvature)", () => {
    const loop = resample(
      closeRing(
        Array.from({ length: 200 }, (_, i) => {
          const a = (i / 200) * Math.PI * 2;
          return { x: 1000 * Math.cos(a), y: 1000 * Math.sin(a), z: 0 };
        }),
      ),
      10,
    );
    // curvature 0.001 < enter threshold
    expect(detectCorners(loop)).toHaveLength(0);
  });
  it("merges two close same-direction arcs and keeps distant ones apart", () => {
    const r = 50;
    // two 45-degree arcs separated by a 20 m straight, then a long way round
    const a1 = arcPts(0, r, r, -Math.PI / 2, -Math.PI / 4, 10);
    const endA1 = a1[a1.length - 1];
    const dir = { x: Math.cos(Math.PI / 4), y: Math.sin(Math.PI / 4) };
    const gapEnd = { x: endA1.x + dir.x * 20, y: endA1.y + dir.y * 20 };
    const c2 = { x: gapEnd.x - r * Math.cos(-Math.PI / 4), y: gapEnd.y - r * Math.sin(-Math.PI / 4) };
    const a2 = arcPts(c2.x, c2.y, r, -Math.PI / 4, 0, 10);
    const top = a2[a2.length - 1];
    const pts = [
      { x: -600, y: 0 },
      ...a1,
      gapEnd,
      ...a2,
      { x: top.x, y: top.y + 300 },
      { x: -600, y: top.y + 300 },
    ];
    const loop = resample(closeRing(pts.map((p) => ({ ...p, z: 0 }))), 5);
    const corners = detectCorners(loop);
    // merged pair + two corners at the top + one at far left = 4 (not 5)
    expect(corners.length).toBe(4);
    const merged = corners.find((c) => c.apex.x > -100 && c.apex.y < 100);
    expect(merged).toBeDefined();
    expect(Math.abs(merged!.angleDeg)).toBeGreaterThan(80);
  });
  it("sectors and longest straight", () => {
    const loop = roundedRect();
    const corners = detectCorners(loop);
    const total = loop[loop.length - 1].dist;
    const s = sectors(total, corners);
    expect(s[0]).toBe(0);
    expect(s[1]).toBeGreaterThan(total / 3 - 160);
    expect(s[1]).toBeLessThan(total / 3 + 160);
    const ls = longestStraight(total, corners);
    expect(ls.length).toBeGreaterThan(850);
    expect(ls.length).toBeLessThan(1000);
  });
});
