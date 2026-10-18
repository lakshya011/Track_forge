import { describe, expect, it } from "vitest";
import { generateTrack } from "../../geo";
import type { LetterSection } from "../../geo/types";
import { circle, rect, section } from "../../geo/__tests__/fixtures";
import { POSTER_STYLES, STYLES, buildPoster, posterSize } from "../index";
import { buildCartography } from "../cartography";
import { cornerNamesAlongPath, pseudoCoordinates } from "../primitives";
import { fitToBox } from "../../geo/svg";

const letters: LetterSection[] = [
  section({ letter: "I", circuitId: "rect", start: 1000, end: 1400 }),
  section({ letter: "O", circuitId: "circle", start: 0, end: 2400 }),
  section({ letter: "L", circuitId: "rect", start: 2600, end: 3200 }),
];
const data = { circuits: [rect, circle], letters };
const t = generateTrack("OIL", 0, "rect", data);
const meta = { homologatedYear: 2026, lengthReference: "Test ring", cartography: buildCartography(t) };

describe("poster styles", () => {
  for (const style of POSTER_STYLES) {
    it(`${style} builds in 2:3 and 1:1 with title, track and credit`, () => {
      for (const ratio of ["2:3", "1:1"] as const) {
        const svg = buildPoster(t, { style, ratio }, meta);
        const size = posterSize(ratio);
        expect(svg.startsWith(`<svg xmlns="http://www.w3.org/2000/svg" width="${size.width}" height="${size.height}"`)).toBe(true);
        expect(svg).toContain(">OIL<");
        expect(svg).toContain("<path d=\"M");
        expect(svg).toContain("not affiliated with Formula 1");
        expect(svg).toContain("Test ring");
        expect(svg.endsWith("</svg>")).toBe(true);
        // Well-formed enough: every opened <g>/<svg>/<defs> is closed.
        for (const tag of ["g", "svg", "defs"]) {
          const open = (svg.match(new RegExp(`<${tag}[\\s>]`, "g")) ?? []).length;
          const close = (svg.match(new RegExp(`</${tag}>`, "g")) ?? []).length;
          expect(close, tag).toBe(open);
        }
      }
    });
  }

  it("has a name and hint for every style", () => {
    for (const style of POSTER_STYLES) {
      expect(STYLES[style].id).toBe(style);
      expect(STYLES[style].name.length).toBeGreaterThan(2);
      expect(STYLES[style].hint.length).toBeGreaterThan(5);
    }
  });

  it("embeds the font block and honours options", () => {
    const svg = buildPoster(t, { style: "engraved", options: { wood: "black" } }, { ...meta, fontFace: "@font-face{font-family:'X'}" });
    expect(svg).toContain("@font-face{font-family:'X'}");
    expect(svg).toContain("#efe6d3"); // black wood draws a pale circuit
    const withCoords = buildPoster(t, { style: "cartographic", options: { coordinates: true, northArrow: false } }, meta);
    expect(withCoords).toContain("″ N");
    expect(withCoords).not.toContain(">N<");
    expect(withCoords).toMatch(/Corners: \d+ {2}· {2}Length: \d\.\d{3} km \(\d\.\d{3} mi\)/);
    expect(withCoords).toContain("Fictional location");
    const car = buildPoster(t, { style: "teamcar", options: { team: "papaya" } }, meta);
    expect(car).toContain(">MCLAREN<");
    expect(car).toContain("--c1:#ff8000");
    expect(car).toContain("fill:var(--c1)");
    for (const label of ["CIRCUIT", "LENGTH", "CORNERS", "LONGEST STRAIGHT", "GHOST LAP", "DIFFICULTY", "HOMOLOGATED"]) expect(car).toContain(`>${label}<`);
    expect(car).toContain("BUILT FROM YOUR NAME");
    expect(car).toContain("TRACK FORGE");
    expect(car).toContain("not affiliated with any team");
    expect(car).not.toMatch(/oracle|petronas|aramco|logo/i);
    // Two-word names are set as two text elements in both ratios; one-word names stay whole.
    for (const ratio of ["2:3", "1:1"] as const) {
      const am = buildPoster(t, { style: "teamcar", ratio, options: { team: "racing" } }, meta);
      expect(am).toContain(">ASTON<");
      expect(am).toContain(">MARTIN<");
      expect(am).not.toContain(">ASTON MARTIN<");
      expect(am).toContain("not affiliated with any team");
    }
    expect(buildPoster(t, { style: "teamcar", ratio: "2:3", options: { team: "navy" } }, meta)).toContain(">BULL<");
    expect(buildPoster(t, { style: "teamcar", ratio: "1:1", options: { team: "navy" } }, meta)).toContain(">RED BULL<");
    expect(car.length).toBeLessThan(1024 * 1024);
    // An unknown or empty team falls back to the circuit's default, deterministically.
    const a = buildPoster(t, { style: "teamcar", options: { team: "" } }, meta);
    expect(a).toBe(buildPoster(t, { style: "teamcar", options: { team: "nope" } }, meta));
    expect(a).not.toBe(car);
  });

  it("sector poster keeps to five numbers, one credit line and numbered corners only on calm laps", () => {
    for (const ratio of ["2:3", "1:1"] as const) {
      const svg = buildPoster(t, { style: "sector", ratio }, meta);
      for (const label of ["CIRCUIT LENGTH", "CORNERS", "LAPS", "LONGEST STRAIGHT", "GHOST LAP"]) expect(svg).toContain(`>${label}<`);
      expect(svg).not.toContain("DIFFICULTY");
      expect(svg).not.toContain(">HOMOLOGATED<");
      expect(svg).not.toContain("O: circle");
      expect(svg).toContain("Same lap length as Test ring");
      expect((svg.match(/not affiliated with Formula 1/g) ?? []).length).toBe(1);
      expect(t.corners.length).toBeLessThanOrEqual(16);
      expect((svg.match(/class="corner-no"/g) ?? []).length).toBe(t.corners.length);
    }
    // Twenty corners: the rings would crowd the lap, so they are left off.
    const extra = Array.from({ length: 20 - t.corners.length }, (_, i) => ({ ...t.corners[i % t.corners.length], number: t.corners.length + i + 1 }));
    const busy = { ...t, corners: [...t.corners, ...extra] };
    expect(busy.corners.length).toBe(20);
    const svg = buildPoster(busy, { style: "sector" }, meta);
    expect(svg).not.toContain('class="corner-no"');
    expect(svg).toContain(">20<");
  });

  it("builds without shared cartography or hero (computes them itself)", () => {
    expect(buildPoster(t, { style: "engraved" })).toContain(">OIL<");
    expect(buildPoster(t, { style: "teamcar" })).toContain("car-half");
  });

  it("pseudo-coordinates are seeded DMS", () => {
    const a = pseudoCoordinates("OIL", 0);
    expect(a).toMatch(/^\d{1,2}°\d{2}′\d{2}″ [NS] {3}\d{1,3}°\d{2}′\d{2}″ [EW]$/);
    expect(pseudoCoordinates("OIL", 0)).toBe(a);
    expect(pseudoCoordinates("OIL", 1)).not.toBe(a);
  });

  it("sets corner names along the road only for calm laps, and falls back to T-numbers", () => {
    const fit = fitToBox(t.loop, { x: 0, y: 0, width: 1000, height: 600 }, 50);
    const full = cornerNamesAlongPath(t, fit, { offset: 20, fontSize: 14, color: "#000", maxCorners: 16 });
    expect((full.body.match(/<textPath/g) ?? []).length).toBe(t.corners.filter((c) => c.source).length);
    expect(full.body).toMatch(/T\d+ · /);
    const none = cornerNamesAlongPath(t, fit, { offset: 20, fontSize: 14, color: "#000", maxCorners: 0 });
    expect(none.body).toBe("");
    const short = cornerNamesAlongPath(t, fit, { offset: 20, fontSize: 14, color: "#000", maxCorners: 0, shortUpTo: 40 });
    expect((short.body.match(/<textPath/g) ?? []).length).toBe(t.corners.length);
    expect(short.body).not.toContain(" · ");
  });
});
