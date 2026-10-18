import { describe, expect, it } from "vitest";
import {
  brakingBoards,
  cornerName,
  cornerNumbersByLetter,
  drsDetection,
  elevationSkin,
  formatCornerRun,
  grandstands,
  gravelTraps,
  insideNormal,
  kerbs,
  mixHex,
  rampHex,
  rangeSamples,
  sectorFlags,
  startFinishStraight,
  straightBefore,
} from "../decor";
import { generateTrack } from "../index";
import type { Corner, LetterSection, Sample, Track } from "../types";
import { circle, rect, section } from "./fixtures";

/** Counter-clockwise 1000 x 500 rectangle lap starting mid-way along the bottom edge, heading +x. */
function rectTrack(): Track {
  const pts: Sample[] = [];
  const push = (x: number, y: number) => pts.push({ x, y, z: 0, dist: pts.length * 10 });
  for (let x = 500; x < 1000; x += 10) push(x, 0);
  for (let y = 0; y < 500; y += 10) push(1000, y);
  for (let x = 1000; x > 0; x -= 10) push(x, 500);
  for (let y = 500; y > 0; y -= 10) push(0, y);
  for (let x = 0; x < 500; x += 10) push(x, 0);
  push(500, 0);
  const length = pts[pts.length - 1].dist; // 3000
  const corner = (k: number, d: number): Corner => ({
    index: d / 10,
    dist: d,
    startDist: d - 40,
    endDist: d + 40,
    angleDeg: 90,
    direction: "L",
    number: k + 1,
    apex: { x: pts[d / 10].x, y: pts[d / 10].y },
  });
  const corners = [corner(0, 500), corner(1, 1000), corner(2, 2000), corner(3, 2500)];
  return {
    name: "RECT",
    seed: 0,
    lengthCircuitId: "rect",
    loop: pts,
    length,
    corners,
    sectors: [0, 1040, 2040],
    longestStraight: { startDist: 1040, endDist: 1960, length: 920 },
    sources: [],
    ligatures: [],
    letterRanges: [],
    debug: { joinIndices: [], gap: 0.35, offset: 0.6, attempts: 1, kerned: false },
  };
}

describe("rangeSamples", () => {
  it("wraps through start/finish", () => {
    const t = rectTrack();
    const r = rangeSamples(t.loop, 2900, 100);
    expect(r.length).toBe(21);
    expect(r[0].dist).toBe(2900);
    expect(r[r.length - 1].dist).toBe(100);
  });
});

describe("kerbs", () => {
  it("sit on the inside of each corner", () => {
    const t = rectTrack();
    const ks = kerbs(t, 6);
    expect(ks).toHaveLength(4);
    // First corner at (1000, 0), a left-hander: inside is towards the centre of the rectangle (-x, +y).
    const k0 = ks[0];
    const centre = { x: 500, y: 250 };
    const apex = t.loop[t.corners[0].index];
    const dApex = Math.hypot(apex.x - centre.x, apex.y - centre.y);
    for (const p of k0.pts) expect(Math.hypot(p.x - centre.x, p.y - centre.y)).toBeLessThan(dApex + 1);
    const n = insideNormal(t.loop, 10, "L");
    expect(n.y).toBeGreaterThan(0.99); // travelling +x along the bottom, left is +y
  });
});

describe("gravelTraps and braking boards", () => {
  it("only trap corners that follow a long straight, on the outside", () => {
    const t = rectTrack();
    const traps = gravelTraps(t, { edge: 8, depth: 30 });
    // Straights before corners: 920, 420, 920, 420 m; all clear the default 300 m.
    expect(traps.map((g) => g.corner.number)).toEqual([1, 2, 3, 4]);
    const strict = gravelTraps(t, { edge: 8, depth: 30, minStraight: 900 });
    expect(strict.map((g) => g.corner.number)).toEqual([1, 3]);
    const trap3 = strict[1];
    // Every sand point clears the track edge; the deepest one reaches the full depth.
    const nearest = (p: { x: number; y: number }) => Math.min(...t.loop.map((q) => Math.hypot(q.x - p.x, q.y - p.y)));
    const dists = trap3.polygon.map(nearest);
    expect(Math.min(...dists)).toBeGreaterThan(7);
    expect(Math.max(...dists)).toBeGreaterThan(8 + 30 * 0.8);
    expect(trap3.polygon.length).toBeGreaterThan(6);
  });
  it("places 100 m and 50 m boards before corners with room", () => {
    const t = rectTrack();
    const boards = brakingBoards(t);
    expect(boards.filter((b) => b.corner.number === 1).map((b) => b.metres)).toEqual([100, 50]);
    const b100 = boards.find((b) => b.corner.number === 1 && b.metres === 100)!;
    expect(b100.p.x).toBeCloseTo(1000 - 40 - 100, 5);
    expect(b100.n.y).toBeLessThan(-0.99); // outside of a left-hander on the bottom edge points -y
    expect(straightBefore(t, 2)).toBe(920);
  });
});

describe("markers", () => {
  it("sector flags sit at the sector boundaries, DRS detection 200 m before the longest straight", () => {
    const t = rectTrack();
    const [s2, s3] = sectorFlags(t);
    expect(s2.dist).toBe(1040);
    expect(s3.dist).toBe(2040);
    const drs = drsDetection(t)!;
    expect(drs.dist).toBe(840);
    expect(drsDetection({ ...t, longestStraight: { startDist: 0, endDist: 100, length: 100 } })).toBeNull();
    // Wrap: a straight starting 50 m after the line puts detection 150 m before it.
    const wrapped = drsDetection({ ...t, longestStraight: { startDist: 50, endDist: 600, length: 550 } })!;
    expect(wrapped.dist).toBe(2850);
  });
});

describe("grandstands", () => {
  it("line the start/finish straight and the longest straight with four-point blocks", () => {
    const t = rectTrack();
    const sf = startFinishStraight(t);
    expect(sf.startDist).toBe(2540);
    expect(sf.endDist).toBe(460);
    expect(sf.length).toBe(920);
    const gs = grandstands(t, { offset: 12, depth: 10 });
    expect(gs.map((g) => g.along)).toEqual(["start-finish", "longest"]);
    for (const g of gs) {
      expect(g.blocks.length).toBeGreaterThan(2);
      for (const b of g.blocks) expect(b).toHaveLength(4);
    }
    // Start/finish stands sit below the bottom straight (outside).
    for (const b of gs[0].blocks) for (const p of b) expect(p.y).toBeLessThan(-10);
  });
});

describe("cornerName and skins", () => {
  it("names corners from labels or circuits", () => {
    const letters: LetterSection[] = [
      section({ letter: "I", circuitId: "rect", start: 1000, end: 1400 }),
      section({ letter: "O", circuitId: "circle", start: 0, end: 2400, label: "The Bowl" }),
    ];
    const t = generateTrack("OI", 0, "rect", { circuits: [rect, circle], letters });
    const named = t.corners.map((c) => cornerName(c, t.sources));
    expect(named.some((n) => n.endsWith("· The Bowl"))).toBe(true);
    expect(named.every((n) => /^T\d+/.test(n))).toBe(true);
    const bare: Corner = { ...t.corners[0], source: undefined };
    expect(cornerName(bare, t.sources)).toBe(`T${bare.number}`);
  });
  it("groups corner numbers by letter and formats runs", () => {
    const letters: LetterSection[] = [
      section({ letter: "I", circuitId: "rect", start: 1000, end: 1400 }),
      section({ letter: "O", circuitId: "circle", start: 0, end: 2400 }),
    ];
    const t = generateTrack("OI", 0, "rect", { circuits: [rect, circle], letters });
    const by = cornerNumbersByLetter(t);
    expect(by).toHaveLength(2);
    const all = by.flat();
    expect(all.length).toBe(t.corners.filter((c) => c.source).length);
    expect(formatCornerRun([3, 4, 5])).toBe("T3–T5");
    expect(formatCornerRun([7, 3])).toBe("T3, T7");
    expect(formatCornerRun([1, 2, 5, 6, 9])).toBe("T1–T2, T5–T6, T9");
    expect(formatCornerRun([])).toBe("");
  });
  it("elevationSkin normalises to 0..1 and mixHex blends", () => {
    const skin = elevationSkin([
      { x: 0, y: 0, z: 10, dist: 0 },
      { x: 0, y: 0, z: 30, dist: 1 },
      { x: 0, y: 0, z: 20, dist: 2 },
    ]);
    expect(skin).toEqual([0, 1, 0.5]);
    expect(mixHex("#000000", "#ffffff", 0.5)).toBe("#808080");
    expect(mixHex("#ff0000", "#0000ff", 0)).toBe("#ff0000");
    expect(rampHex(0)).toBe("#3b82f6");
    expect(rampHex(1)).toBe("#f97316");
    expect(rampHex(1 / 3)).toBe("#2dd4bf");
  });
});
