import { describe, expect, it } from "vitest";
import { CAR_BOX, CAR_GROUND, carMarkup, carSvg } from "../car";
import { TEAMS } from "../teams";

describe("team car", () => {
  it("draws every part of the car once, mirrored, with livery variables", () => {
    const svg = carMarkup({ id: "x", colours: TEAMS.rosso, number: "14", font: "Test" });
    for (const cls of ["car-back", "car-half", "car-mid", "car-nose"]) expect(svg).toContain(`class="${cls}"`);
    expect(svg).toContain('<use href="#x-hb" transform="scale(-1,1)"/>');
    expect(svg).toContain('<use href="#x-hf" transform="scale(-1,1)"/>');
    expect(svg).toContain("--c1:#d8161c;--c2:#141414;--c3:#ffd400;--accent:#ffffff");
    for (const v of ["c1", "c2", "c3", "accent"]) expect(svg).toContain(`fill:var(--${v})`);
    expect(svg).toContain(">14<");
    expect(svg).toContain(">TRACK FORGE<");
    expect(svg).not.toMatch(/sponsor|Ferrari|McLaren|Mercedes|Red Bull|Pirelli/i);
    expect(svg.length).toBeLessThan(40_000);
    // Every id in the defs is prefixed so two cars can share a document.
    const ids = [...svg.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
    expect(ids.length).toBeGreaterThan(5);
    expect(ids.every((id) => id === "x" || id.startsWith("x-"))).toBe(true);
  });

  it("standalone preview is a well-formed SVG in the car box", () => {
    const svg = carSvg({ colours: TEAMS.onyx, number: "9" }, 1000);
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" width="1000"')).toBe(true);
    expect(svg).toContain(`viewBox="${CAR_BOX.x} ${CAR_BOX.y} ${CAR_BOX.width} ${CAR_BOX.height}"`);
    expect(CAR_GROUND).toBeLessThan(CAR_BOX.y + CAR_BOX.height);
    for (const tag of ["g", "defs", "svg"]) {
      const open = (svg.match(new RegExp(`<${tag}[\\s>]`, "g")) ?? []).length;
      const close = (svg.match(new RegExp(`</${tag}>`, "g")) ?? []).length;
      expect(close, tag).toBe(open);
    }
  });
});
