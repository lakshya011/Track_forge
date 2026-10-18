import { describe, expect, it } from "vitest";
import {
  closeRing,
  cumulativeDist,
  isClosed,
  localToLonLat,
  lonLatToLocal,
  resample,
  sampleAt,
} from "../project";

describe("project", () => {
  it("projects a 0.01 degree latitude step to ~1112 m", () => {
    const pts = lonLatToLocal([
      [5.97, 50.43],
      [5.97, 50.44],
    ]);
    const dy = pts[1].y - pts[0].y;
    expect(dy).toBeGreaterThan(1100);
    expect(dy).toBeLessThan(1125);
  });
  it("round-trips through localToLonLat", () => {
    const coords: [number, number][] = [
      [5.97, 50.43],
      [5.98, 50.44],
      [5.96, 50.45],
    ];
    const local = lonLatToLocal(coords);
    const lon0 = (5.97 + 5.98 + 5.96) / 3;
    const lat0 = (50.43 + 50.44 + 50.45) / 3;
    const back = localToLonLat(local, lon0, lat0);
    back.forEach(([lon, lat], i) => {
      expect(lon).toBeCloseTo(coords[i][0], 6);
      expect(lat).toBeCloseTo(coords[i][1], 6);
    });
  });
  it("cumulativeDist of a unit square perimeter", () => {
    const sq = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
      { x: 0, y: 0 },
    ];
    expect(cumulativeDist(sq)).toEqual([0, 1, 2, 3, 4]);
  });
  it("isClosed and closeRing", () => {
    const open = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
    ];
    expect(isClosed(open)).toBe(false);
    const closed = closeRing(open);
    expect(isClosed(closed)).toBe(true);
    expect(closeRing(closed)).toHaveLength(closed.length);
  });
  it("resample of a 100 m line at 10 m gives 11 points with linear z", () => {
    const line = [
      { x: 0, y: 0, z: 0 },
      { x: 100, y: 0, z: 10 },
    ];
    const s = resample(line, 10);
    expect(s).toHaveLength(11);
    expect(s[0].dist).toBe(0);
    expect(s[10].dist).toBeCloseTo(100);
    expect(s[5].x).toBeCloseTo(50);
    expect(s[5].z).toBeCloseTo(5);
  });
  it("sampleAt interpolates and clamps", () => {
    const s = resample(
      [
        { x: 0, y: 0, z: 0 },
        { x: 100, y: 0, z: 0 },
      ],
      10,
    );
    expect(sampleAt(s, 25).x).toBeCloseTo(25);
    expect(sampleAt(s, -5).x).toBeCloseTo(0);
    expect(sampleAt(s, 500).x).toBeCloseTo(100);
  });
});
