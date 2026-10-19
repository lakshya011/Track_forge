import { describe, expect, it } from "vitest";
import { generateTrack, homologate } from "../../geo";
import type { LetterSection } from "../../geo/types";
import { circle, rect, section } from "../../geo/__tests__/fixtures";
import { DNA_COLORS, LICENCE_FORMATS, LICENCE_SIZES, buildLicenceCardSvg } from "../licence";

const letters: LetterSection[] = [
  section({ letter: "I", circuitId: "rect", start: 1000, end: 1400 }),
  section({ letter: "O", circuitId: "circle", start: 0, end: 2400 }),
  section({ letter: "L", circuitId: "rect", start: 2600, end: 3200 }),
];
const t = generateTrack("OIL", 0, "rect", { circuits: [rect, circle], letters });
const h = homologate(t, letters);
const url = "https://lakshya011.github.io/Track_forge/?name=OIL";

describe("licence card picture", () => {
  for (const format of LICENCE_FORMATS) {
    it(`${format} carries the name, grade, licence number, meter, DNA, ghost lap and link`, () => {
      const svg = buildLicenceCardSvg(t, h, { format, year: 2026, shareUrl: url, fontFace: "@font-face{font-family:'X'}" });
      const size = LICENCE_SIZES[format];
      expect(svg.startsWith(`<svg xmlns="http://www.w3.org/2000/svg" width="${size.width}" height="${size.height}"`)).toBe(true);
      expect(svg).toContain(">OIL<");
      expect(svg).toContain(`>${h.grade.replace(/\D/g, "") || "1"}<`);
      expect(svg).toContain(`No. ${h.licence} · Homologated 2026`);
      expect(svg).toContain(">TRACK FORGE · CIRCUIT LICENCE<");
      expect(svg).toContain(">DIFFICULTY<");
      expect(svg).toContain(`>${h.difficulty}<`);
      expect(svg).toContain(">CIRCUIT DNA<");
      expect(svg).toContain(">GHOST LAP<");
      expect(svg).toContain(`>${h.lapTime.formatted}<`);
      for (const tag of h.tags) expect(svg).toContain(`>${tag}<`);
      for (const d of h.dna) expect(svg).toContain(`>${d.country}<`);
      expect(svg).toContain("Not an FIA document");
      expect(svg).toContain("@font-face{font-family:'X'}");
      expect(svg).toContain('class="attribution"');
      expect(svg).toContain(">lakshya011.github.io/Track_forge<");
      // Ten meter cells: the lit ones in the three traffic colours, the rest off.
      expect((svg.match(/#26262e/g) ?? []).length).toBe(10 - h.difficulty);
      expect(svg).toContain('<path d="M'); // the outline
      expect(svg.endsWith("</svg>")).toBe(true);
      for (const tag of ["g", "svg", "defs", "clipPath"]) {
        const open = (svg.match(new RegExp(`<${tag}[\\s>]`, "g")) ?? []).length;
        const close = (svg.match(new RegExp(`</${tag}>`, "g")) ?? []).length;
        expect(close, `${format} ${tag}`).toBe(open);
      }
    });
  }

  it("omits the attribution row without a link and lists the badges when there are any", () => {
    const svg = buildLicenceCardSvg(t, h, { format: "square" });
    expect(svg).not.toContain('class="attribution"');
    if (h.badges.length) {
      expect(svg).toContain(">RARITY<");
      expect(svg).toContain(`>${h.badges[0].label.toUpperCase()}<`);
    }
  });

  it("colours the DNA bar from the shared palette", () => {
    const svg = buildLicenceCardSvg(t, h, { format: "wide" });
    expect(svg).toContain(DNA_COLORS[0]);
    expect(DNA_COLORS).toHaveLength(8);
  });
});
