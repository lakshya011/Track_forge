import { describe, expect, it } from "vitest";
import { catmullRom, polylinesIntersect, routeConnector } from "../route";

describe("route", () => {
  it("polylinesIntersect ignores shared endpoints but catches crossings", () => {
    const a = [{ x: 0, y: 0 }, { x: 1, y: 1 }];
    const b = [{ x: 1, y: 1 }, { x: 2, y: 0 }];
    expect(polylinesIntersect(a, b)).toBe(false);
    const c = [{ x: 0, y: 1 }, { x: 1, y: 0 }];
    expect(polylinesIntersect(a, c)).toBe(true);
  });
  it("catmullRom passes through its control points", () => {
    const pts = [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 0 }, { x: 3, y: 1 }];
    const s = catmullRom(pts, 10);
    expect(s[0]).toEqual(pts[0]);
    expect(s[s.length - 1]).toEqual(pts[3]);
    expect(s).toHaveLength(31);
    expect(s[10].x).toBeCloseTo(1, 6);
    expect(s[10].y).toBeCloseTo(1, 6);
  });
  it("uses a smooth cubic when nothing is in the way", () => {
    const r = routeConnector({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 0 }, [], { band: { minY: 0, maxY: 1 }, xGap: 0.5 });
    expect(r.kind).toBe("cubic");
    expect(r.pts[0].x).toBe(0);
    expect(r.pts[r.pts.length - 1].x).toBe(1);
    expect(r.pts[0].dist).toBe(0);
  });
  it("detours under a wall that blocks the direct path", () => {
    // Wall from (1, 0) up to (1, 1.5) between P and Q; Q is low so the detour goes under.
    const wall = [{ x: 1, y: 0 }, { x: 1, y: 1.5 }];
    const r = routeConnector({ x: 0, y: 0.2 }, { x: 1, y: 0 }, { x: 2, y: 0.2 }, { x: 1, y: 0 }, [wall], { band: { minY: 0, maxY: 1 }, xGap: 1 });
    expect(r.kind.startsWith("under")).toBe(true);
    expect(Math.min(...r.pts.map((p) => p.y))).toBeLessThan(0);
    expect(polylinesIntersect(r.pts, wall)).toBe(false);
  });
});
