import { describe, expect, it } from "vitest";
import { generateTrack } from "../../geo";
import type { LetterSection } from "../../geo/types";
import { circle, rect, section } from "../../geo/__tests__/fixtures";
import { buildCartography } from "../cartography";
import { POSTER_STYLES, STORY_SHEET, STORY_SIZE, buildPoster, exportScale, posterSize } from "../index";
import { MADE_WITH, attributionRow } from "../primitives";
import { QUIET_ZONE, qrMatrix, qrPath } from "../qr";

const letters: LetterSection[] = [
  section({ letter: "I", circuitId: "rect", start: 1000, end: 1400 }),
  section({ letter: "O", circuitId: "circle", start: 0, end: 2400 }),
  section({ letter: "L", circuitId: "rect", start: 2600, end: 3200 }),
];
const t = generateTrack("OIL", 0, "rect", { circuits: [rect, circle], letters });
const url = "https://lakshya011.github.io/Track_forge/?name=OIL";
const meta = { homologatedYear: 2026, lengthReference: "Test ring", cartography: buildCartography(t) };

describe("qr", () => {
  it("builds a deterministic matrix with a quiet zone and one path per dark module", () => {
    const m = qrMatrix(url);
    expect(m.size).toBeGreaterThanOrEqual(21);
    expect(m.size % 4).toBe(1);
    // The three finder patterns are dark in their corners.
    expect(m.dark(0, 0)).toBe(true);
    expect(m.dark(0, m.size - 1)).toBe(true);
    expect(m.dark(m.size - 1, 0)).toBe(true);
    expect(qrMatrix(url)).toBe(m); // cached
    let dark = 0;
    for (let r = 0; r < m.size; r++) for (let c = 0; c < m.size; c++) if (m.dark(r, c)) dark++;
    const p = qrPath(url, 100, 10, 20);
    expect((p.d.match(/M/g) ?? []).length).toBe(dark);
    expect(p.cell).toBeCloseTo(100 / (m.size + 2 * QUIET_ZONE), 6);
    // The first module sits inside the quiet zone offset from (10, 20).
    expect(p.d.startsWith(`M${Math.round((10 + QUIET_ZONE * p.cell) * 100) / 100} ${Math.round((20 + QUIET_ZONE * p.cell) * 100) / 100}`)).toBe(true);
    // Inset modules are smaller squares.
    const inset = qrPath(url, 100, 0, 0, { inset: 0.8 });
    expect(inset.d).toContain(`h${Math.round(p.cell * 0.8 * 100) / 100}`);
  });

  it("changes with the url", () => {
    expect(qrPath(url, 60).d).not.toBe(qrPath(url + "&seed=1", 60).d);
  });
});

describe("attribution row", () => {
  it("is empty without a share url", () => {
    const row = attributionRow({ W: 1200, body: "sans-serif" }, { x: 0, y: 0, color: "#000" });
    expect(row.markup).toBe("");
    expect(row.width).toBe(0);
  });

  it("draws the code, the caps line and the short link, aligned as asked", () => {
    const ctx = { W: 1200, body: "sans-serif", shareUrl: url };
    const start = attributionRow(ctx, { x: 100, y: 50, align: "start", color: "#111" });
    expect(start.markup).toContain(`>${MADE_WITH}<`);
    expect(start.markup).toContain(">lakshya011.github.io/Track_forge<");
    expect(start.markup).toContain('class="attribution"');
    expect(start.height).toBe(60);
    expect(start.left).toBe(100);
    const end = attributionRow(ctx, { x: 1100, y: 50, align: "end", color: "#111", plate: { fill: "#fff" } });
    expect(end.left).toBeCloseTo(1100 - end.width, 6);
    expect(end.markup).toContain('<rect');
    const mid = attributionRow(ctx, { x: 600, y: 50, align: "middle", color: "#111" });
    expect(mid.left).toBeCloseTo(600 - mid.width / 2, 6);
  });
});

describe("posters carry the row only when they know their link", () => {
  for (const style of POSTER_STYLES) {
    it(`${style} in every ratio`, () => {
      for (const ratio of ["2:3", "1:1", "9:16"] as const) {
        const plain = buildPoster(t, { style, ratio }, meta);
        expect(plain).not.toContain('class="attribution"');
        expect(plain).not.toContain(MADE_WITH);
        const linked = buildPoster(t, { style, ratio }, { ...meta, shareUrl: url });
        expect((linked.match(/class="attribution"/g) ?? []).length).toBe(1);
        expect(linked).toContain(">lakshya011.github.io/Track_forge<");
        expect(linked).toContain('shape-rendering="crispEdges"');
        expect(linked).toContain("not affiliated with Formula 1");
      }
    });
  }
});

describe("story format", () => {
  it("is 1080 × 1920 with the 2:3 sheet scaled to the width and the row in the band below", () => {
    expect(posterSize("9:16")).toEqual({ width: 1080, height: 1920 });
    expect(exportScale("9:16")).toBe(1);
    expect(exportScale("2:3")).toBe(2);
    for (const style of POSTER_STYLES) {
      const svg = buildPoster(t, { style, ratio: "9:16" }, { ...meta, shareUrl: url });
      expect(svg.startsWith(`<svg xmlns="http://www.w3.org/2000/svg" width="${STORY_SIZE.width}" height="${STORY_SIZE.height}"`)).toBe(true);
      expect(svg).toContain(`x="0" y="60" width="${STORY_SHEET.width}" height="${STORY_SHEET.height}" viewBox="0 0 1200 1800"`);
      expect(svg).toContain(">OIL<");
      expect(svg.endsWith("</svg>")).toBe(true);
      for (const tag of ["g", "svg", "defs"]) {
        const open = (svg.match(new RegExp(`<${tag}[\\s>]`, "g")) ?? []).length;
        const close = (svg.match(new RegExp(`</${tag}>`, "g")) ?? []).length;
        expect(close, `${style} ${tag}`).toBe(open);
      }
      // The row sits under the sheet.
      const y = Number(/class="attribution"[^]*?<path d="M[\d.]+ ([\d.]+)/.exec(svg)?.[1]);
      expect(y).toBeGreaterThan(60 + STORY_SHEET.height);
    }
  });

  it("uses the sheet's own paper: wood for engraved, the team's for the car", () => {
    expect(buildPoster(t, { style: "engraved", ratio: "9:16", options: { wood: "walnut" } }, meta)).toMatch(/<rect width="1080" height="1920" fill="#64432a"\/>/);
    expect(buildPoster(t, { style: "teamcar", ratio: "9:16", options: { team: "rosso" } }, meta)).toMatch(/<rect width="1080" height="1920" fill="#f7f2ea"\/>/);
    expect(buildPoster(t, { style: "sector", ratio: "9:16" }, meta)).toMatch(/<rect width="1080" height="1920" fill="#0b0b0f"\/>/);
  });
});
