import type { Sample } from "./types";

/** Cosine ease between two heights, t in [0, 1]. */
export function cosineEase(z0: number, z1: number, t: number): number {
  return z0 + ((z1 - z0) * (1 - Math.cos(Math.PI * Math.min(Math.max(t, 0), 1)))) / 2;
}

/** Max relief (metres) a single letter may contribute before it is compressed. */
export const DEFAULT_MAX_RELIEF = 60;

/**
 * Re-centre a glyph's elevation around 0 and compress its range so it spans at most maxRelief metres.
 * Keeps real-world shape of the profile while preventing a 400 m Spa section next to a 20 m Monaco one.
 */
export function normalizeRelief(pts: Sample[], maxRelief = DEFAULT_MAX_RELIEF): Sample[] {
  if (pts.length === 0) return pts;
  let min = Infinity;
  let max = -Infinity;
  for (const p of pts) {
    min = Math.min(min, p.z);
    max = Math.max(max, p.z);
  }
  const range = max - min;
  const mean = (min + max) / 2;
  const gain = range > maxRelief ? maxRelief / range : 1;
  return pts.map((p) => ({ ...p, z: (p.z - mean) * gain }));
}

/** Assign eased z along a polyline from z0 (first point) to z1 (last point). */
export function easeAlong(pts: Sample[], z0: number, z1: number): Sample[] {
  const total = pts[pts.length - 1].dist || 1;
  return pts.map((p) => ({ ...p, z: cosineEase(z0, z1, p.dist / total) }));
}
