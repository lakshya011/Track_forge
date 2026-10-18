import { describe, expect, it } from "vitest";
import { SectionTooShort, extractSection, normalizeGlyph } from "../section";
import { circle, rect, section } from "./fixtures";

describe("extractSection", () => {
  it("extracts 100..300 as a 200 m stretch", () => {
    const pts = extractSection(rect, section({ letter: "I", circuitId: "rect", start: 100, end: 300 }));
    expect(pts[0].dist).toBe(0);
    expect(pts[pts.length - 1].dist).toBeCloseTo(200, 5);
    expect(pts[0].x).toBeCloseTo(100);
    expect(pts[pts.length - 1].x).toBeCloseTo(300);
  });
  it("wraps through dist 0 when end < start", () => {
    const pts = extractSection(rect, section({ letter: "L", circuitId: "rect", start: 2900, end: 100 }));
    expect(pts[pts.length - 1].dist).toBeCloseTo(200, 5);
    // starts on the left edge going down, ends on the bottom edge going right
    expect(pts[0].x).toBeCloseTo(0);
    expect(pts[0].y).toBeCloseTo(100);
    expect(pts[pts.length - 1].x).toBeCloseTo(100);
    expect(pts[pts.length - 1].y).toBeCloseTo(0);
  });
  it("reverse flips traversal order", () => {
    const fwd = extractSection(rect, section({ letter: "I", circuitId: "rect", start: 100, end: 300 }));
    const rev = extractSection(rect, section({ letter: "I", circuitId: "rect", start: 100, end: 300, reverse: true }));
    expect(rev[0].x).toBeCloseTo(fwd[fwd.length - 1].x);
    expect(rev[rev.length - 1].x).toBeCloseTo(fwd[0].x);
    expect(rev[0].dist).toBe(0);
  });
  it("throws SectionTooShort under 30 m", () => {
    expect(() => extractSection(rect, section({ letter: "I", circuitId: "rect", start: 100, end: 120 }))).toThrow(
      SectionTooShort,
    );
  });
  it("carries elevation from the source", () => {
    const pts = extractSection(circle, section({ letter: "C", circuitId: "circle", start: 0, end: 800 }));
    const zs = pts.map((p) => p.z);
    expect(Math.max(...zs)).toBeGreaterThan(100);
  });
});

describe("normalizeGlyph", () => {
  const s = section({ letter: "U", circuitId: "rect", start: 800, end: 1700 });
  it("fits bbox height to 1 with minX = minY = 0", () => {
    // Right edge (x=1000, y 0..500) and across the top: an L-ish shape of height 500 and width 200
    const g = normalizeGlyph(extractSection(rect, s), s);
    const xs = g.pts.map((p) => p.x);
    const ys = g.pts.map((p) => p.y);
    expect(Math.min(...xs)).toBeCloseTo(0, 6);
    expect(Math.min(...ys)).toBeCloseTo(0, 6);
    expect(Math.max(...ys)).toBeCloseTo(1, 6);
    expect(g.width).toBeCloseTo(Math.max(...xs), 6);
  });
  it("rotation by 90 turns a horizontal stroke vertical", () => {
    const h = section({ letter: "I", circuitId: "rect", start: 100, end: 500 });
    const flat = normalizeGlyph(extractSection(rect, h), h);
    expect(flat.width).toBeCloseTo(1, 6); // scaled by width because height ~0
    const rot = normalizeGlyph(extractSection(rect, h), { ...h, rotation: 90 });
    expect(rot.width).toBeLessThan(0.01);
    expect(Math.abs(rot.entryTangent.y)).toBeCloseTo(1, 3);
  });
  it("flipX mirrors geometry but keeps traversal order", () => {
    const g = normalizeGlyph(extractSection(rect, s), s);
    const f = normalizeGlyph(extractSection(rect, s), { ...s, flipX: true });
    expect(f.entry.x).toBeCloseTo(g.width - g.entry.x, 6);
    expect(f.entry.y).toBeCloseTo(g.entry.y, 6);
    expect(f.pts[0].dist).toBe(0);
  });
  it("preserves z values", () => {
    const c = section({ letter: "C", circuitId: "circle", start: 0, end: 800 });
    const g = normalizeGlyph(extractSection(circle, c), c);
    expect(Math.max(...g.pts.map((p) => p.z))).toBeGreaterThan(100);
  });
});

describe("orientLeftToRight", () => {
  it("reverses a glyph whose entry is right of its exit and keeps one that is already left-to-right", async () => {
    const { orientLeftToRight } = await import("../section");
    const s = section({ letter: "L", circuitId: "rect", start: 2600, end: 3200 });
    const g = normalizeGlyph(extractSection(rect, s), s);
    const o = orientLeftToRight(g);
    expect(o.entry.x).toBeLessThanOrEqual(o.exit.x);
    expect(o.pts[0].dist).toBe(0);
    const rev = normalizeGlyph(extractSection(rect, { ...s, reverse: true }), s);
    const o2 = orientLeftToRight(rev);
    expect(o2.entry.x).toBeLessThanOrEqual(o2.exit.x);
    expect(o2.entry).toEqual(o.entry);
  });
});
