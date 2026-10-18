import { describe, expect, it } from "vitest";
import { closeRing, resample } from "../project";
import { findSelfIntersection, loopLength, scaleToLength, selfIntersects, smoothJoins } from "../post";
import type { Sample } from "../types";

function ring(pts: { x: number; y: number }[], step = 10): Sample[] {
  return resample(
    closeRing(pts.map((p) => ({ ...p, z: 0 }))),
    step,
  );
}

const square = ring([
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 },
  { x: 0, y: 100 },
]);

describe("post", () => {
  it("smoothJoins preserves count and closure and rounds a corner", () => {
    const cornerIdx = square.findIndex((p) => p.x === 100 && p.y === 0);
    const out = smoothJoins(square, [cornerIdx], 2, 1);
    expect(out).toHaveLength(square.length);
    expect(out[0].x).toBeCloseTo(out[out.length - 1].x);
    expect(out[0].y).toBeCloseTo(out[out.length - 1].y);
    // the corner moved inward
    expect(out[cornerIdx].x).toBeLessThan(100);
    expect(out[cornerIdx].y).toBeGreaterThan(0);
    // far-away points untouched
    const mid = square.findIndex((p) => p.x === 0 && p.y === 50);
    expect(out[mid].x).toBe(0);
  });
  it("scaleToLength matches target within 0.1%", () => {
    const { loop, scale } = scaleToLength(square, 7004);
    expect(loopLength(loop)).toBeCloseTo(7004, 1);
    expect(scale).toBeCloseTo(7004 / 400, 6);
    expect(loop[0].z).toBe(0);
  });
  it("detects a figure-8 and passes a circle", () => {
    const circle = ring(
      Array.from({ length: 60 }, (_, i) => {
        const a = (i / 60) * Math.PI * 2;
        return { x: 100 * Math.cos(a), y: 100 * Math.sin(a) };
      }),
    );
    expect(selfIntersects(circle)).toBe(false);
    const eight = ring(
      Array.from({ length: 80 }, (_, i) => {
        const t = (i / 80) * Math.PI * 2;
        return { x: 100 * Math.sin(t), y: 60 * Math.sin(2 * t) };
      }),
      5,
    );
    expect(selfIntersects(eight)).toBe(true);
    expect(findSelfIntersection(square)).toBeNull();
  });
});
