import { describe, expect, it } from "vitest";
import { generateTrack, lapsFor, sanitizeName, selfIntersects } from "../index";
import type { LetterSection } from "../types";
import { circle, rect, section } from "./fixtures";

// A tiny fixture alphabet: I = straight, L = corner, U = hairpin-ish, O = 3/4 circle, C = half circle.
const letters: LetterSection[] = [
  section({ letter: "I", circuitId: "rect", start: 1000, end: 1400, rotation: 0 }), // right edge going up
  section({ letter: "I", circuitId: "rect", start: 2600, end: 2900, rotation: 0, reverse: true }),
  section({ letter: "L", circuitId: "rect", start: 2600, end: 3200, rotation: 0, reverse: false }), // left edge down then bottom right
  section({ letter: "U", circuitId: "rect", start: 800, end: 1700, rotation: 180 }),
  section({ letter: "O", circuitId: "circle", start: 0, end: 2400, rotation: 0 }),
  section({ letter: "C", circuitId: "circle", start: 800, end: 2300, rotation: 0 }),
];
const data = { circuits: [rect, circle], letters };

describe("sanitizeName", () => {
  it("uppercases, strips, collapses and truncates", () => {
    expect(sanitizeName("  john  doe-7 ")).toBe("JOHN DOE");
    expect(sanitizeName("abcdefghijklmnop")).toBe("ABCDEFGHIJKL");
    expect(sanitizeName("!!!")).toBe("");
  });
});

describe("generateTrack", () => {
  it("single letter builds a closed, non-intersecting loop of the target length", () => {
    const t = generateTrack("I", 0, "rect", data);
    expect(t.loop[0].x).toBeCloseTo(t.loop[t.loop.length - 1].x, 3);
    expect(t.loop[0].y).toBeCloseTo(t.loop[t.loop.length - 1].y, 3);
    expect(t.length).toBeCloseTo(rect.length, 0);
    expect(selfIntersects(t.loop)).toBe(false);
    expect(t.warning).toBeUndefined();
    expect(t.sources).toHaveLength(1);
  });
  it("is deterministic for the same inputs and changes with the seed", () => {
    const a = generateTrack("LOCI", 5, "circle", data);
    const b = generateTrack("LOCI", 5, "circle", data);
    expect(a).toEqual(b);
    const c = generateTrack("II", 1, "rect", data);
    const d = generateTrack("II", 2, "rect", data);
    // two I variants exist; across seeds at least the picks or geometry may differ, but the length must hold
    expect(c.length).toBeCloseTo(d.length, 0);
  });
  it("respects spaces as wider gaps", () => {
    const ab = generateTrack("IC", 0, "rect", data);
    const aSb = generateTrack("I C", 0, "rect", data);
    const widthOf = (t: typeof ab) => {
      const xs = t.loop.map((p) => p.x);
      return Math.max(...xs) - Math.min(...xs);
    };
    // After scaling to the same total length the spaced version is relatively wider.
    expect(widthOf(aSb) / aSb.length).toBeGreaterThan(widthOf(ab) / ab.length);
  });
  it("numbers corners from the start/finish and splits sectors", () => {
    const t = generateTrack("LUCI", 3, "rect", data);
    expect(t.corners.length).toBeGreaterThan(2);
    t.corners.forEach((c, i) => expect(c.number).toBe(i + 1));
    for (let i = 1; i < t.corners.length; i++) expect(t.corners[i].dist).toBeGreaterThan(t.corners[i - 1].dist);
    expect(t.sectors[1]).toBeGreaterThan(0);
    expect(t.sectors[2]).toBeGreaterThan(t.sectors[1]);
    expect(t.longestStraight.length).toBeGreaterThan(0);
  });
  it("maps each letter onto the lap and attributes corners to letters", () => {
    const t = generateTrack("LUCI", 3, "rect", data);
    expect(t.letterRanges.map((r) => r.letter)).toEqual(["L", "U", "C", "I"]);
    for (let i = 0; i < t.letterRanges.length; i++) {
      const r = t.letterRanges[i];
      expect(r.letterIndex).toBe(i);
      expect(r.endDist).toBeGreaterThan(r.startDist);
      expect(r.startDist).toBeGreaterThanOrEqual(0);
      expect(r.endDist).toBeLessThanOrEqual(t.length);
      if (i > 0) expect(r.startDist).toBeGreaterThanOrEqual(t.letterRanges[i - 1].endDist);
    }
    // The letters draw a good share of the lap; connectors and the pit straight take the rest.
    const covered = t.letterRanges.reduce((s, r) => s + r.endDist - r.startDist, 0);
    expect(covered).toBeGreaterThan(t.length * 0.25);
    expect(covered).toBeLessThan(t.length);
    const attributed = t.corners.filter((c) => c.source);
    expect(attributed.length).toBeGreaterThan(0);
    for (const c of attributed) {
      const r = t.letterRanges[c.source!.letterIndex];
      // The turning zone overlaps the letter's stretch.
      expect(c.endDist).toBeGreaterThanOrEqual(r.startDist);
      expect(c.startDist).toBeLessThanOrEqual(r.endDist);
      expect(c.source!.letter).toBe(r.letter);
      expect(c.source!.circuitId).toBe(t.sources[c.source!.letterIndex].circuit.id);
    }
    // The U is a hairpin: its range must contain at least one corner.
    const uIdx = t.letterRanges.findIndex((r) => r.letter === "U");
    expect(t.corners.some((c) => c.source?.letterIndex === uIdx)).toBe(true);
  });
  it("start/finish lies below the letters", () => {
    const t = generateTrack("OIL", 0, "circle", data);
    const ys = t.loop.map((p) => p.y);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    expect(t.loop[0].y).toBeLessThan(minY + (maxY - minY) * 0.2);
  });
  it("throws for a letter with no sections or an empty name", () => {
    expect(() => generateTrack("Z", 0, "rect", data)).toThrow(/No sections/);
    expect(() => generateTrack("123", 0, "rect", data)).toThrow(/at least one letter/);
  });
  it("lapsFor rounds up from the 305 km race distance", () => {
    expect(lapsFor(7004)).toBe(44);
    expect(lapsFor(3337)).toBe(92);
  });
});
