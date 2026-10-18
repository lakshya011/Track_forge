import type { Pt2, Pt3, Sample } from "./types";

const EARTH_RADIUS = 6371000;

/** Equirectangular projection about the centroid. Returns metres. */
export function lonLatToLocal(coords: [number, number][]): Pt2[] {
  if (coords.length === 0) return [];
  let lon0 = 0;
  let lat0 = 0;
  for (const [lon, lat] of coords) {
    lon0 += lon;
    lat0 += lat;
  }
  lon0 /= coords.length;
  lat0 /= coords.length;
  const cosLat = Math.cos((lat0 * Math.PI) / 180);
  return coords.map(([lon, lat]) => ({
    x: (EARTH_RADIUS * ((lon - lon0) * Math.PI)) / 180 * cosLat,
    y: (EARTH_RADIUS * ((lat - lat0) * Math.PI)) / 180,
  }));
}

/** Inverse of lonLatToLocal for a given origin (used by the bake script). */
export function localToLonLat(pts: Pt2[], lon0: number, lat0: number): [number, number][] {
  const cosLat = Math.cos((lat0 * Math.PI) / 180);
  return pts.map((p) => [
    lon0 + ((p.x / (EARTH_RADIUS * cosLat)) * 180) / Math.PI,
    lat0 + ((p.y / EARTH_RADIUS) * 180) / Math.PI,
  ]);
}

export function dist2(a: Pt2, b: Pt2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function isClosed(pts: Pt2[], tol = 5): boolean {
  return pts.length > 2 && dist2(pts[0], pts[pts.length - 1]) < tol;
}

/** Ensure the ring ends exactly where it starts (appends a copy of the first point). */
export function closeRing<T extends Pt2>(pts: T[]): T[] {
  if (pts.length === 0) return pts;
  const first = pts[0];
  const last = pts[pts.length - 1];
  if (dist2(first, last) < 0.01) return [...pts.slice(0, -1), { ...first }];
  return [...pts, { ...first }];
}

export function cumulativeDist(pts: Pt2[]): number[] {
  const out = new Array<number>(pts.length);
  let d = 0;
  for (let i = 0; i < pts.length; i++) {
    if (i > 0) d += dist2(pts[i - 1], pts[i]);
    out[i] = d;
  }
  return out;
}

/**
 * Resample a polyline at uniform arc-length spacing. Linear interpolation of x, y, z.
 * The last output sample is always the exact last input point.
 */
export function resample(pts: Pt3[], step = 10): Sample[] {
  if (pts.length === 0) return [];
  if (pts.length === 1) return [{ ...pts[0], dist: 0 }];
  const cum = cumulativeDist(pts);
  const total = cum[cum.length - 1];
  const out: Sample[] = [];
  let seg = 0;
  const n = Math.max(1, Math.round(total / step));
  const actualStep = total / n;
  for (let i = 0; i <= n; i++) {
    const target = i === n ? total : i * actualStep;
    while (seg < pts.length - 2 && cum[seg + 1] < target) seg++;
    const a = pts[seg];
    const b = pts[seg + 1];
    const segLen = cum[seg + 1] - cum[seg];
    const t = segLen > 0 ? (target - cum[seg]) / segLen : 0;
    out.push({
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      z: a.z + (b.z - a.z) * t,
      dist: target,
    });
  }
  return out;
}

/** Linear interpolation of a sample at distance d along a polyline (d clamped). */
export function sampleAt(pts: Sample[], d: number): Sample {
  if (pts.length === 0) throw new Error("sampleAt: empty polyline");
  const total = pts[pts.length - 1].dist;
  const target = Math.min(Math.max(d, 0), total);
  let lo = 0;
  let hi = pts.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (pts[mid].dist <= target) lo = mid;
    else hi = mid;
  }
  const a = pts[lo];
  const b = pts[hi];
  const segLen = b.dist - a.dist;
  const t = segLen > 0 ? (target - a.dist) / segLen : 0;
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
    dist: target,
  };
}

export function polylineLength(pts: Pt2[]): number {
  let d = 0;
  for (let i = 1; i < pts.length; i++) d += dist2(pts[i - 1], pts[i]);
  return d;
}

/** Recompute dist from geometry, starting at 0. */
export function rezero(pts: Pt3[]): Sample[] {
  const cum = cumulativeDist(pts);
  return pts.map((p, i) => ({ x: p.x, y: p.y, z: p.z, dist: cum[i] }));
}
