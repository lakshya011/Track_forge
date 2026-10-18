import { describe, expect, it } from "vitest";
import { cosineEase } from "../elevation";
import { assembleLoop, bboxOf, buildReturnPath, connectCubic, layoutGlyphs } from "../stitch";
import type { Glyph, Sample } from "../types";
import { section } from "./fixtures";

function squareGlyph(letter = "O"): Glyph {
  // Open square: up the left, across the top, down the right (a bracket shape), cap height 1, width 1.
  const raw = [
    { x: 0, y: 0 },
    { x: 0, y: 0.5 },
    { x: 0, y: 1 },
    { x: 0.5, y: 1 },
    { x: 1, y: 1 },
    { x: 1, y: 0.5 },
    { x: 1, y: 0 },
  ];
  let d = 0;
  const pts: Sample[] = raw.map((p, i) => {
    if (i > 0) d += Math.hypot(p.x - raw[i - 1].x, p.y - raw[i - 1].y);
    return { ...p, z: 0, dist: d };
  });
  return {
    pts,
    width: 1,
    entry: { x: 0, y: 0 },
    exit: { x: 1, y: 0 },
    entryTangent: { x: 0, y: 1 },
    exitTangent: { x: 0, y: -1 },
    section: section({ letter, circuitId: "rect", start: 0, end: 100 }),
  };
}

describe("layoutGlyphs", () => {
  it("places the second glyph at width + gap", () => {
    const placed = layoutGlyphs([squareGlyph(), squareGlyph()], 0.35);
    expect(placed[0].offsetX).toBe(0);
    expect(placed[1].offsetX).toBeCloseTo(1.35);
    expect(placed[1].entry.x).toBeCloseTo(1.35);
  });
  it("a space adds spaceGap", () => {
    const placed = layoutGlyphs([squareGlyph(), "space", squareGlyph()], 0.35, 1.0);
    expect(placed[1].offsetX).toBeCloseTo(2.35);
  });
});

describe("connectCubic", () => {
  it("hits both endpoints and leaves along t0", () => {
    const pts = connectCubic({ x: 0, y: 0 }, { x: 0, y: -1 }, { x: 2, y: 0 }, { x: 0, y: 1 }, 10, 20);
    expect(pts[0].x).toBeCloseTo(0);
    expect(pts[0].y).toBeCloseTo(0);
    expect(pts[pts.length - 1].x).toBeCloseTo(2);
    const dx = pts[1].x - pts[0].x;
    const dy = pts[1].y - pts[0].y;
    const l = Math.hypot(dx, dy);
    expect(dy / l).toBeLessThan(-0.95);
    expect(pts[0].z).toBeCloseTo(10);
    expect(pts[pts.length - 1].z).toBeCloseTo(20);
    expect(pts[0].dist).toBe(0);
  });
});

describe("buildReturnPath", () => {
  it("runs a horizontal straight below the letters", () => {
    const g = squareGlyph();
    const rp = buildReturnPath(g.exit, g.exitTangent, g.entry, g.entryTangent, bboxOf(g.pts), 0.6);
    const sf = rp.pts[rp.startFinishIndex];
    expect(sf.y).toBeCloseTo(-0.6, 3);
    const prev = rp.pts[rp.startFinishIndex - 1];
    expect(prev.y).toBeCloseTo(-0.6, 3);
    expect(sf.x).toBeLessThan(prev.x); // heading left
    expect(rp.pts[rp.pts.length - 1].x).toBeCloseTo(g.entry.x);
  });
});

describe("assembleLoop", () => {
  it("produces a closed loop starting on the return straight with correct join count", () => {
    const placed = layoutGlyphs([squareGlyph(), squareGlyph(), squareGlyph()]);
    const { loop, joinIndices, glyphRanges } = assembleLoop(placed);
    expect(loop[0].x).toBeCloseTo(loop[loop.length - 1].x);
    expect(loop[0].y).toBeCloseTo(loop[loop.length - 1].y);
    expect(loop[0].y).toBeLessThan(0);
    expect(loop[0].dist).toBe(0);
    // 3 glyphs: 2 connectors (2 joins each) + return path (2 joins) = 6
    expect(joinIndices).toHaveLength(6);
    expect(glyphRanges).toHaveLength(3);
    for (const [a, b] of glyphRanges) {
      expect(b - a).toBe(7);
      expect(loop[a].y).toBeCloseTo(0, 3);
    }
    // dist strictly increasing
    for (let i = 1; i < loop.length; i++) expect(loop[i].dist).toBeGreaterThan(loop[i - 1].dist);
  });
});

describe("cosineEase", () => {
  it("interpolates endpoints and midpoint", () => {
    expect(cosineEase(0, 10, 0)).toBe(0);
    expect(cosineEase(0, 10, 1)).toBeCloseTo(10);
    expect(cosineEase(0, 10, 0.5)).toBeCloseTo(5);
  });
});
