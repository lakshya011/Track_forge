import { describe, expect, it } from "vitest";
import { generateTrack } from "../index";
import { cornerAt, cornerCueText, sectorAt } from "../hud";
import { kmh, lapProfile } from "../speed";
import type { LetterSection } from "../types";
import { circle, rect, section } from "./fixtures";

const letters: LetterSection[] = [
  section({ letter: "I", circuitId: "rect", start: 1000, end: 1400 }),
  section({ letter: "O", circuitId: "circle", start: 0, end: 2400 }),
  section({ letter: "L", circuitId: "rect", start: 2600, end: 3200 }),
];
const data = { circuits: [rect, circle], letters };
const t = generateTrack("OIL", 0, "rect", data);
const LAP = 95;
const prof = lapProfile(t, LAP);

const inCorner = (d: number) => t.corners.some((c) => (c.startDist <= c.endDist ? d >= c.startDist && d <= c.endDist : d >= c.startDist || d <= c.endDist));
const inStraight = (d: number) => {
  const s = t.longestStraight;
  return s.startDist <= s.endDist ? d >= s.startDist && d <= s.endDist : d >= s.startDist || d <= s.endDist;
};

describe("lap speed profile", () => {
  it("runs forward in time and takes exactly the lap time", () => {
    expect(prof.times[0]).toBe(0);
    expect(prof.times[prof.times.length - 1]).toBeCloseTo(LAP, 9);
    for (let i = 1; i < prof.times.length; i++) expect(prof.times[i]).toBeGreaterThan(prof.times[i - 1]);
    expect(prof.times.length).toBe(t.loop.length);
    expect(prof.speeds.length).toBe(t.loop.length);
    expect(prof.speeds[0]).toBeCloseTo(prof.speeds[prof.speeds.length - 1], 9);
  });

  it("is slowest inside a corner and fastest on the longest straight", () => {
    let slow = 0;
    let fast = 0;
    prof.speeds.forEach((v, i) => {
      if (v < prof.speeds[slow]) slow = i;
      if (v > prof.speeds[fast]) fast = i;
    });
    expect(inCorner(t.loop[slow].dist)).toBe(true);
    expect(inStraight(t.loop[fast].dist)).toBe(true);
    expect(prof.maxSpeed / prof.minSpeed).toBeGreaterThan(1.8);
    expect(kmh(prof.maxSpeed)).toBeLessThan(400);
    expect(kmh(prof.minSpeed)).toBeGreaterThan(40);
  });

  it("brakes and accelerates within the caps", () => {
    const o = { accel: 12, brake: 40 };
    for (let i = 1; i < prof.times.length; i++) {
      const dt = prof.times[i] - prof.times[i - 1];
      const dv = prof.speeds[i] - prof.speeds[i - 1];
      const a = dv / dt;
      expect(a).toBeLessThan(o.accel * 1.05 + 0.5);
      expect(a).toBeGreaterThan(-o.brake * 1.05 - 0.5);
    }
  });

  it("maps time to distance and back, wrapping", () => {
    expect(prof.distAt(0)).toBe(0);
    expect(prof.distAt(LAP - 1e-6)).toBeCloseTo(t.length, 1);
    expect(prof.distAt(LAP)).toBeCloseTo(0, 6);
    expect(prof.distAt(-1)).toBeCloseTo(prof.distAt(LAP - 1), 6);
    for (const d of [0, 123.4, t.length / 2, t.length - 7]) {
      expect(prof.distAt(prof.timeAt(d))).toBeCloseTo(d, 3);
      expect(prof.speedAt(d)).toBeGreaterThan(0);
    }
    const half = prof.distAt(LAP / 2);
    expect(half).toBeGreaterThan(t.length * 0.3);
    expect(half).toBeLessThan(t.length * 0.7);
  });

  it("emits SMIL key points that climb from 0 to 1 in step with key times", () => {
    const kp = prof.keyPoints.split(";").map(Number);
    const kt = prof.keyTimes.split(";").map(Number);
    expect(kp.length).toBe(121);
    expect(kt.length).toBe(121);
    expect(kp[0]).toBe(0);
    expect(kp[kp.length - 1]).toBe(1);
    expect(kt[0]).toBe(0);
    expect(kt[kt.length - 1]).toBe(1);
    for (let i = 1; i < kp.length; i++) {
      expect(kp[i]).toBeGreaterThanOrEqual(kp[i - 1]);
      expect(kt[i]).toBeGreaterThan(kt[i - 1]);
    }
    // Not uniform: the car covers less of the path per tick through the corners.
    const steps = kp.slice(1).map((p, i) => p - kp[i]);
    expect(Math.max(...steps) / Math.min(...steps)).toBeGreaterThan(1.5);
    expect(lapProfile(t, LAP, {}, 10).keyPoints.split(";").length).toBe(11);
  });
});

describe("hud cues", () => {
  it("knows which corner the car is in or approaching", () => {
    const c = t.corners[1];
    const at = cornerAt(t, c.dist);
    expect(at?.state).toBe("in");
    expect(at?.corner.number).toBe(c.number);
    const before = cornerAt(t, c.startDist - 50);
    expect(before?.state).toBe("approach");
    expect(before?.corner.number).toBe(c.number);
    expect(before?.metresTo).toBeCloseTo(50, 3);
    expect(cornerCueText(t, c.startDist - 52)).toBe(`T${c.number} in 50 m`);
    expect(cornerCueText(t, c.dist)).toMatch(new RegExp(`^T${c.number}`));
    expect(cornerAt({ corners: [], length: 1000 }, 10)).toBeNull();
    expect(cornerCueText({ corners: [], length: 1000, sources: [] }, 10)).toBe("");
  });

  it("wraps the approach through the start line", () => {
    const first = t.corners[0];
    const cue = cornerAt(t, t.length - 10);
    expect(cue?.corner.number).toBe(first.number);
    if (cue?.state === "approach") expect(cue.metresTo).toBeCloseTo(first.startDist + 10, 3);
  });

  it("reports the sector", () => {
    expect(sectorAt(t, 0)).toBe(1);
    expect(sectorAt(t, t.sectors[1] - 1)).toBe(1);
    expect(sectorAt(t, t.sectors[1] + 1)).toBe(2);
    expect(sectorAt(t, t.sectors[2] + 1)).toBe(3);
    expect(sectorAt(t, t.length + 5)).toBe(1);
  });
});
