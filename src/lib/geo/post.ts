import { resample, rezero } from "./project";
import type { Pt2, Sample } from "./types";

/**
 * Moving-average (window 3) smoothing applied only within `radius` samples of each join index,
 * `passes` times. Point count and loop endpoints are preserved. z is smoothed too.
 */
export function smoothJoins(loop: Sample[], joinIndices: number[], radius = 4, passes = 2): Sample[] {
  const n = loop.length;
  if (n < 5) return loop;
  const mask = new Array<boolean>(n).fill(false);
  for (const j of joinIndices) {
    for (let k = -radius; k <= radius; k++) {
      const i = (((j + k) % n) + n) % n;
      mask[i] = true;
    }
  }
  // Treat index 0 and n-1 as the same point (closed ring).
  let cur = loop.map((p) => ({ ...p }));
  for (let pass = 0; pass < passes; pass++) {
    const next = cur.map((p) => ({ ...p }));
    for (let i = 0; i < n; i++) {
      if (!mask[i]) continue;
      const prev = cur[i === 0 ? n - 2 : i - 1];
      const nxt = cur[i === n - 1 ? 1 : i + 1];
      next[i].x = (prev.x + cur[i].x + nxt.x) / 3;
      next[i].y = (prev.y + cur[i].y + nxt.y) / 3;
      next[i].z = (prev.z + cur[i].z + nxt.z) / 3;
    }
    // Keep the ring closed.
    next[n - 1] = { ...next[0], dist: next[n - 1].dist };
    cur = next;
  }
  return rezero(cur);
}

export function loopLength(loop: Sample[]): number {
  return loop[loop.length - 1].dist;
}

/** Scale x and y so the loop length matches `target` metres. z is unchanged. */
export function scaleToLength(loop: Sample[], target: number): { loop: Sample[]; scale: number } {
  const len = loopLength(loop);
  const scale = len > 0 ? target / len : 1;
  return { loop: rezero(loop.map((p) => ({ x: p.x * scale, y: p.y * scale, z: p.z }))), scale };
}

export function resampleLoop(loop: Sample[], step = 10): Sample[] {
  return resample(loop, step);
}

function orient(a: Pt2, b: Pt2, c: Pt2): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function onSegment(a: Pt2, b: Pt2, p: Pt2): boolean {
  return (
    Math.min(a.x, b.x) - 1e-9 <= p.x &&
    p.x <= Math.max(a.x, b.x) + 1e-9 &&
    Math.min(a.y, b.y) - 1e-9 <= p.y &&
    p.y <= Math.max(a.y, b.y) + 1e-9
  );
}

export function segmentsIntersect(a: Pt2, b: Pt2, c: Pt2, d: Pt2): boolean {
  const o1 = orient(a, b, c);
  const o2 = orient(a, b, d);
  const o3 = orient(c, d, a);
  const o4 = orient(c, d, b);
  if (o1 * o2 < 0 && o3 * o4 < 0) return true;
  if (Math.abs(o1) < 1e-12 && onSegment(a, b, c)) return true;
  if (Math.abs(o2) < 1e-12 && onSegment(a, b, d)) return true;
  if (Math.abs(o3) < 1e-12 && onSegment(c, d, a)) return true;
  if (Math.abs(o4) < 1e-12 && onSegment(c, d, b)) return true;
  return false;
}

/**
 * O(n^2) self-intersection test on a closed loop (first === last). Adjacent segments and the
 * closing pair are skipped. Returns the first intersecting segment index pair, or null.
 */
export function findSelfIntersection(loop: Pt2[]): [number, number] | null {
  const m = loop.length - 1; // number of segments
  for (let i = 0; i < m; i++) {
    const a = loop[i];
    const b = loop[i + 1];
    const minX = Math.min(a.x, b.x);
    const maxX = Math.max(a.x, b.x);
    const minY = Math.min(a.y, b.y);
    const maxY = Math.max(a.y, b.y);
    for (let j = i + 2; j < m; j++) {
      if (i === 0 && j === m - 1) continue; // closing pair shares the start/finish point
      const c = loop[j];
      const d = loop[j + 1];
      if (Math.max(c.x, d.x) < minX || Math.min(c.x, d.x) > maxX) continue;
      if (Math.max(c.y, d.y) < minY || Math.min(c.y, d.y) > maxY) continue;
      if (segmentsIntersect(a, b, c, d)) return [i, j];
    }
  }
  return null;
}

export function selfIntersects(loop: Pt2[]): boolean {
  return findSelfIntersection(loop) !== null;
}
