import { describe, expect, it } from "vitest";
import { alignReversible, entryRunLength, exitRunLength, mergeChain, tryShareStroke } from "../ligature";
import { layoutGlyphs, polylineClearance } from "../stitch";
import type { Glyph, Sample } from "../types";
import { section } from "./fixtures";

function glyphFrom(raw: { x: number; y: number }[], letter: string): Glyph {
  let d = 0;
  const pts: Sample[] = raw.map((p, i) => {
    if (i > 0) d += Math.hypot(p.x - raw[i - 1].x, p.y - raw[i - 1].y);
    return { ...p, z: 0, dist: d };
  });
  const unit = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return { x: (b.x - a.x) / l, y: (b.y - a.y) / l };
  };
  const xs = raw.map((p) => p.x);
  return {
    pts,
    width: Math.max(...xs) - Math.min(...xs),
    entry: raw[0],
    exit: raw[raw.length - 1],
    entryTangent: unit(raw[0], raw[1]),
    exitTangent: unit(raw[raw.length - 2], raw[raw.length - 1]),
    section: section({ letter, circuitId: "rect", start: 0, end: 100 }),
  };
}

// V: down-right then up-right. Λ (A without bar): up-right then down-right. Densify legs.
const leg = (a: { x: number; y: number }, b: { x: number; y: number }, n = 10) =>
  Array.from({ length: n }, (_, i) => ({ x: a.x + ((b.x - a.x) * i) / (n - 1), y: a.y + ((b.y - a.y) * i) / (n - 1) }));
const V = glyphFrom([...leg({ x: 0, y: 1 }, { x: 0.35, y: 0 }), ...leg({ x: 0.35, y: 0 }, { x: 0.7, y: 1 }).slice(1)], "V");
const A = glyphFrom([...leg({ x: 0, y: 0 }, { x: 0.4, y: 1 }), ...leg({ x: 0.4, y: 1 }, { x: 0.8, y: 0 }).slice(1)], "A");

describe("ligature", () => {
  it("measures straight entry and exit runs", () => {
    expect(exitRunLength(V)).toBeCloseTo(Math.hypot(0.35, 1), 3);
    expect(entryRunLength(A)).toBeCloseTo(Math.hypot(0.4, 1), 3);
  });
  it("shares V's rising arm with A's rising leg", () => {
    const m = tryShareStroke(V, A);
    expect(m).not.toBeNull();
    expect(m!.merged).toBe(2);
    // Compound starts where V started and ends where A ends; A's apex is at the top.
    expect(m!.entry.y).toBeCloseTo(1, 3);
    expect(m!.exit.y).toBeLessThan(0.1);
    const maxY = Math.max(...m!.pts.map((p) => p.y));
    expect(maxY).toBeGreaterThan(1.0); // A's leg is longer than V's arm so the apex rises above
    // the shared stroke is drawn once: total length < V + A
    const total = m!.pts[m!.pts.length - 1].dist;
    expect(total).toBeLessThan(V.pts[V.pts.length - 1].dist + A.pts[A.pts.length - 1].dist - 0.9);
  });
  it("does not share strokes that point different ways", () => {
    expect(tryShareStroke(A, A)).toBeNull(); // A exits down-right, next A enters up-right
  });
  it("mergeChain fuses V-A and reports the index", () => {
    const { items, merges } = mergeChain<"space">([V, A, "space", A], (x): x is Glyph => x !== "space");
    expect(items).toHaveLength(3);
    expect(merges).toEqual([0]);
  });
  it("alignReversible flips a vertical stroke to continue the previous heading", () => {
    const I = glyphFrom(leg({ x: 0, y: 0 }, { x: 0, y: 1 }), "I");
    const flipped = alignReversible({ x: 0, y: -1 }, I);
    expect(flipped.entry.y).toBeCloseTo(1);
    expect(alignReversible({ x: 0, y: 1 }, I).entry.y).toBeCloseTo(0);
  });
});

describe("kerning", () => {
  it("nests A next to V closer than bounding boxes allow while keeping clearance", () => {
    const plain = layoutGlyphs([A, V], { gap: 0.3 });
    const kerned = layoutGlyphs([A, V], { gap: 0.3, kern: true });
    expect(kerned[1].offsetX).toBeLessThan(plain[1].offsetX - 0.2);
    const c = polylineClearance(kerned[0].pts, kerned[1].pts);
    expect(c).toBeGreaterThanOrEqual(0.3 - 1e-6);
    expect(c).toBeLessThan(0.36);
  });
  it("never kerns across a space", () => {
    const a = layoutGlyphs([A, "space", V], { gap: 0.3, kern: true });
    const b = layoutGlyphs([A, "space", V], { gap: 0.3 });
    expect(a[1].offsetX).toBeCloseTo(b[1].offsetX);
  });
});
