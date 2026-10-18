import { describe, expect, it } from "vitest";
import { generateTrack } from "../index";
import { buildPosterSvg, fitToBox, splitSectors } from "../svg";
import type { LetterSection } from "../types";
import { circle, rect, section } from "./fixtures";

const letters: LetterSection[] = [
  section({ letter: "I", circuitId: "rect", start: 1000, end: 1400 }),
  section({ letter: "O", circuitId: "circle", start: 0, end: 2400 }),
  section({ letter: "L", circuitId: "rect", start: 2600, end: 3200 }),
];
const data = { circuits: [rect, circle], letters };

describe("svg", () => {
  it("fitToBox maps bbox corners into the box with y flipped", () => {
    const fit = fitToBox([{ x: 0, y: 0 }, { x: 200, y: 100 }], { x: 0, y: 0, width: 400, height: 400 });
    expect(fit.scale).toBe(2);
    const tl = fit.map({ x: 0, y: 100 });
    expect(tl.x).toBeCloseTo(0);
    expect(tl.y).toBeCloseTo(100); // centred vertically: (400-200)/2
    const br = fit.map({ x: 200, y: 0 });
    expect(br.y).toBeCloseTo(300);
  });
  it("splitSectors yields three runs that share boundary points", () => {
    const t = generateTrack("OIL", 0, "rect", data);
    const runs = splitSectors(t.loop, t.sectors);
    expect(runs).toHaveLength(3);
    expect(runs[0][runs[0].length - 1]).toEqual(runs[1][0]);
    expect(runs[1][runs[1].length - 1]).toEqual(runs[2][0]);
    expect(runs[0].length + runs[1].length + runs[2].length).toBe(t.loop.length + 2);
  });
  it("poster has three sector paths, the name, one number per corner and the homologation block", () => {
    const t = generateTrack("OIL", 0, "rect", data);
    const svg = buildPosterSvg(t, { lengthReference: "Test ring", homologatedYear: 2026 });
    expect(svg.startsWith("<svg xmlns=")).toBe(true);
    expect((svg.match(/class="sector"/g) ?? []).length).toBe(3);
    expect(svg).toContain(">OIL<");
    const labels = (svg.match(/class="corner-no"/g) ?? []).length;
    expect(labels).toBe(t.corners.length);
    expect(svg).toContain("Test ring");
    expect(svg).toContain("HOMOLOGATED 2026");
    expect(svg).toContain("GRADE 1");
    expect(svg).toContain("GHOST LAP");
    expect(svg).not.toContain("DIFFICULTY");
    expect(svg).toContain("TF-");
    // Furniture is present: kerbs (dashed accent paths) and at least one grandstand block.
    expect(svg).toContain("stroke-dashoffset");
    expect(svg).toMatch(/fill="url\(#[a-z-]*seats\)"/);
  });
});
