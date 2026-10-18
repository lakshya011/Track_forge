import { describe, expect, it } from "vitest";
import { countChicanes, formatLapTime, ghostLapSeconds, homologate, licenceNumber } from "../homologation";
import type { Circuit, Corner, LetterSection, Sample, Track, TrackSource } from "../types";
import { circle, rect, section } from "./fixtures";

const ringCircuit = (id: string, country: string, opened: number): Circuit => ({
  id,
  name: id,
  location: id,
  country,
  opened,
  firstgp: opened,
  length: 5000,
  ringLength: 5000,
  step: 10,
  points: [],
});

/** A flat square lap of 4 km with four gentle 90° corners spaced 1 km apart. */
function squareTrack(overrides: Partial<Track> = {}): Track {
  const length = 4000;
  const loop: Sample[] = Array.from({ length: 401 }, (_, i) => ({ x: i, y: 0, z: 0, dist: i * 10 }));
  const corners: Corner[] = [0, 1, 2, 3].map((k) => ({
    index: k * 100 + 50,
    dist: k * 1000 + 500,
    startDist: k * 1000 + 450,
    endDist: k * 1000 + 550,
    angleDeg: 40,
    direction: "L",
    number: k + 1,
    apex: { x: 0, y: 0 },
  }));
  const circuitA = ringCircuit("a", "GB", 1948);
  const sources: TrackSource[] = [
    { letter: "I", section: section({ letter: "I", circuitId: "a", start: 0, end: 100 }), circuit: circuitA },
    { letter: "O", section: section({ letter: "O", circuitId: "a", start: 0, end: 100 }), circuit: circuitA },
  ];
  return {
    name: "IO",
    seed: 0,
    lengthCircuitId: "a",
    loop,
    length,
    corners,
    sectors: [0, 1333, 2666],
    longestStraight: { startDist: 550, endDist: 1450, length: 900 },
    sources,
    ligatures: [],
    letterRanges: [
      { letter: "I", letterIndex: 0, startDist: 0, endDist: 1000 },
      { letter: "O", letterIndex: 1, startDist: 1000, endDist: 2000 },
    ],
    debug: { joinIndices: [], gap: 0.35, offset: 0.6, attempts: 1, kerned: true },
    ...overrides,
  };
}

/** Hairpin after hairpin, alternating direction so every pair is a chicane. */
function hairpinTrack(): Track {
  const base = squareTrack();
  const corners: Corner[] = Array.from({ length: 20 }, (_, k) => ({
    index: k * 20,
    dist: k * 200,
    startDist: k * 200 - 80,
    endDist: k * 200 + 80,
    angleDeg: k % 2 ? 160 : -160,
    direction: k % 2 ? "L" : "R",
    number: k + 1,
    apex: { x: 0, y: 0 },
  }));
  const loop = base.loop.map((p, i) => ({ ...p, z: 40 * Math.sin((i / 400) * Math.PI * 2) }));
  return { ...base, corners, loop, longestStraight: { startDist: 100, endDist: 150, length: 50 } };
}

describe("formatLapTime", () => {
  it("formats m:ss.mmm", () => {
    expect(formatLapTime(0)).toBe("0:00.000");
    expect(formatLapTime(83.4567)).toBe("1:23.457");
    expect(formatLapTime(119.9996)).toBe("1:59.999");
  });
});

describe("ghostLapSeconds", () => {
  it("grows with corners and relief", () => {
    const none = ghostLapSeconds(5000, [], 0);
    const one = ghostLapSeconds(5000, [{ angleDeg: 90 }], 0);
    const two = ghostLapSeconds(5000, [{ angleDeg: 90 }, { angleDeg: -45 }], 0);
    expect(one).toBeGreaterThan(none);
    expect(two).toBeGreaterThan(one);
    expect(ghostLapSeconds(5000, [], 100)).toBeGreaterThan(none);
    // 5 km at 215 km/h is about 83.7 s of cruising.
    expect(none).toBeCloseTo(83.72, 1);
  });
});

describe("countChicanes", () => {
  it("counts opposite-direction neighbours within 80 m, wrapping", () => {
    const sq = squareTrack();
    expect(countChicanes(sq.corners, sq.length)).toBe(0);
    const hp = hairpinTrack();
    expect(countChicanes(hp.corners, hp.length)).toBe(20);
  });
});

describe("homologate", () => {
  it("calls a flat square Flat and Flowing, and gives it an easy difficulty", () => {
    const h = homologate(squareTrack());
    expect(h.tags).toContain("Flat");
    expect(h.tags).toContain("Flowing");
    expect(h.tags).toContain("High-speed");
    expect(h.tags).toContain("Classic");
    expect(h.tags.length).toBeLessThanOrEqual(4);
    expect(h.difficulty).toBeLessThanOrEqual(3);
    expect(h.grade).toBe("Grade 1");
  });
  it("calls a hairpin-heavy ring Technical and Hairpin heaven with a hard difficulty", () => {
    const h = homologate(hairpinTrack());
    expect(h.tags).toContain("Technical");
    expect(h.tags).toContain("Hairpin heaven");
    expect(h.tags).toContain("Hilly");
    expect(h.difficulty).toBeGreaterThanOrEqual(8);
    expect(h.difficulty).toBeLessThanOrEqual(10);
    expect(h.lapTime.seconds).toBeGreaterThan(homologate(squareTrack()).lapTime.seconds);
  });
  it("awards Rare letter for a thin pool, Ligature for shared strokes, Sprint for short names", () => {
    const pool: LetterSection[] = [
      section({ letter: "I", circuitId: "a", start: 0, end: 100 }),
      section({ letter: "I", circuitId: "a", start: 200, end: 300 }),
      section({ letter: "I", circuitId: "a", start: 400, end: 500 }),
      section({ letter: "O", circuitId: "a", start: 0, end: 100 }),
      section({ letter: "O", circuitId: "a", start: 200, end: 300 }),
    ];
    const h = homologate(squareTrack({ ligatures: [0] }), pool);
    const ids = h.badges.map((b) => b.id);
    expect(ids).toContain("rare-letter");
    expect(h.badges.find((b) => b.id === "rare-letter")?.detail).toMatch(/^O:/);
    expect(ids).toContain("ligature");
    expect(ids).toContain("sprint");
    expect(ids).not.toContain("full-house");
    const plain = homologate(squareTrack(), pool);
    expect(plain.badges.map((b) => b.id)).not.toContain("ligature");
  });
  it("gives Full house for five countries and Marathon for twelve letters", () => {
    const sources: TrackSource[] = "ABCDEFGHIJKL".split("").map((l, i) => ({
      letter: l,
      section: section({ letter: l, circuitId: `c${i}`, start: 0, end: 100 }),
      circuit: ringCircuit(`c${i}`, ["GB", "IT", "BE", "JP", "BR", "US"][i % 6], 2000),
    }));
    const h = homologate(squareTrack({ name: "ABCDEFGHIJKL", sources, letterRanges: [] }));
    const ids = h.badges.map((b) => b.id);
    expect(ids).toContain("full-house");
    expect(ids).toContain("marathon");
    expect(ids).not.toContain("sprint");
    expect(h.tags).not.toContain("Classic");
  });
  it("tags street circuits when half the sources run on public roads", () => {
    const monaco = ringCircuit("mc-1929", "MC", 1929);
    const t = squareTrack({
      sources: [
        { letter: "I", section: section({ letter: "I", circuitId: "mc-1929", start: 0, end: 100 }), circuit: monaco },
        { letter: "O", section: section({ letter: "O", circuitId: "a", start: 0, end: 100 }), circuit: ringCircuit("a", "GB", 1990) },
      ],
    });
    expect(homologate(t).tags).toContain("Street circuit");
  });
  it("splits DNA by country from the letter ranges and sums to one", () => {
    const it = ringCircuit("it", "IT", 1922);
    const be = ringCircuit("be", "BE", 1925);
    const t = squareTrack({
      sources: [
        { letter: "I", section: section({ letter: "I", circuitId: "it", start: 0, end: 100 }), circuit: it },
        { letter: "O", section: section({ letter: "O", circuitId: "be", start: 0, end: 100 }), circuit: be },
      ],
      letterRanges: [
        { letter: "I", letterIndex: 0, startDist: 0, endDist: 300 },
        { letter: "O", letterIndex: 1, startDist: 300, endDist: 1200 },
      ],
    });
    const h = homologate(t);
    expect(h.dna[0].country).toBe("BE");
    expect(h.dna[0].share).toBeCloseTo(0.75);
    expect(h.dna[1].share).toBeCloseTo(0.25);
    expect(h.dna.reduce((s, d) => s + d.share, 0)).toBeCloseTo(1);
  });
  it("issues a stable licence number that changes with name or seed", () => {
    expect(licenceNumber("LEWIS", 0)).toBe(licenceNumber("LEWIS", 0));
    expect(licenceNumber("LEWIS", 0)).toMatch(/^TF-[0-9A-F]{4}-[0-9A-F]{4}$/);
    expect(licenceNumber("LEWIS", 1)).not.toBe(licenceNumber("LEWIS", 0));
    expect(licenceNumber("LEWIS", 0)).not.toBe(licenceNumber("MAX", 0));
  });
  it("works on a generated track end to end", () => {
    const letters: LetterSection[] = [
      section({ letter: "I", circuitId: "rect", start: 1000, end: 1400 }),
      section({ letter: "O", circuitId: "circle", start: 0, end: 2400 }),
      section({ letter: "L", circuitId: "rect", start: 2600, end: 3200 }),
    ];
    // Imported lazily to keep this suite focused on the stats module.
    return import("../index").then(({ generateTrack }) => {
      const t = generateTrack("OIL", 0, "rect", { circuits: [rect, circle], letters });
      const h = homologate(t, letters);
      expect(h.difficulty).toBeGreaterThanOrEqual(1);
      expect(h.difficulty).toBeLessThanOrEqual(10);
      expect(h.tags.length).toBeGreaterThanOrEqual(2);
      expect(h.lapTime.formatted).toMatch(/^\d:\d\d\.\d\d\d$/);
      expect(h.dna.length).toBe(1);
      expect(h.dna[0].country).toBe("XX");
    });
  });
});
