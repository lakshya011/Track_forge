import { curvature } from "./corners";
import { wrapDist } from "./decor";
import type { Sample, Track } from "./types";

/*
 * A speed profile for the ghost lap. Cornering speed is set by lateral grip (v = sqrt(aLat / |k|))
 * and clamped to a hairpin crawl and a top speed; a forward pass caps acceleration and a backward
 * pass caps braking so the car brakes into corners and builds speed out of them. The result is
 * scaled so the lap takes exactly the homologation card's time, which keeps the 2D ghost, the 3D
 * car and the lap clock in step. Everything is in metres and seconds.
 */

export interface SpeedOptions {
  /** Lateral acceleration budget in m/s² (about 3 g). */
  aLat: number;
  /** Slowest cornering speed in m/s (a hairpin). */
  vMin: number;
  /** Top speed in m/s before scaling. */
  vMax: number;
  /** Acceleration cap in m/s². */
  accel: number;
  /** Braking cap in m/s². */
  brake: number;
  /** Half-window in samples for the curvature estimate. */
  window: number;
}

export const DEFAULT_SPEED_OPTIONS: SpeedOptions = { aLat: 30, vMin: 18, vMax: 85, accel: 12, brake: 40, window: 4 };

export interface LapProfile {
  lapSeconds: number;
  length: number;
  /** Cumulative time at each loop sample; the last equals lapSeconds. */
  times: number[];
  /** Speed in m/s at each loop sample (after scaling to the lap time); the last equals the first. */
  speeds: number[];
  minSpeed: number;
  maxSpeed: number;
  /** Distance along the lap at time t (wrapping). */
  distAt: (t: number) => number;
  /** Time at distance d (wrapping). */
  timeAt: (d: number) => number;
  /** Speed in m/s at distance d (wrapping). */
  speedAt: (d: number) => number;
  /** SMIL `keyPoints` / `keyTimes` for an animateMotion with calcMode="linear". */
  keyPoints: string;
  keyTimes: string;
}

/** Find the segment index i with xs[i] <= x < xs[i+1] by binary search (xs ascending). */
function segment(xs: number[], x: number): number {
  let lo = 0;
  let hi = xs.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (xs[mid] <= x) lo = mid;
    else hi = mid;
  }
  return lo;
}

export function lapProfile(track: Pick<Track, "loop" | "length">, lapSeconds: number, opts: Partial<SpeedOptions> = {}, knots = 120): LapProfile {
  const o = { ...DEFAULT_SPEED_OPTIONS, ...opts };
  const loop: Sample[] = track.loop;
  const m = loop.length - 1;
  const L = loop[m].dist;
  const k = curvature(loop, o.window);

  // Grip-limited target speed per sample.
  const v = new Array<number>(m);
  for (let i = 0; i < m; i++) {
    const kk = Math.abs(k[i]);
    v[i] = kk > 1e-9 ? Math.min(o.vMax, Math.max(o.vMin, Math.sqrt(o.aLat / kk))) : o.vMax;
  }
  const ds = (i: number) => {
    const j = (i + 1) % m;
    const d = (j === 0 ? L : loop[j].dist) - loop[i].dist;
    return d > 0 ? d : L / m;
  };
  // Two passes around the ring in each direction so the seam carries over.
  for (let pass = 0; pass < 2; pass++) {
    for (let s = 0; s < m; s++) {
      const i = s % m;
      const j = (i + 1) % m;
      v[j] = Math.min(v[j], Math.sqrt(v[i] * v[i] + 2 * o.accel * ds(i)));
    }
    for (let s = m; s > 0; s--) {
      const j = s % m;
      const i = (j - 1 + m) % m;
      v[i] = Math.min(v[i], Math.sqrt(v[j] * v[j] + 2 * o.brake * ds(i)));
    }
  }

  // Integrate time, then scale to the card's lap time.
  const raw = new Array<number>(m + 1);
  raw[0] = 0;
  for (let i = 0; i < m; i++) raw[i + 1] = raw[i] + ds(i) / ((v[i] + v[(i + 1) % m]) / 2);
  const scale = lapSeconds / raw[m];
  const times = raw.map((t) => t * scale);
  times[m] = lapSeconds;
  const speeds = v.map((s) => s / scale);
  speeds.push(speeds[0]);
  const minSpeed = Math.min(...speeds);
  const maxSpeed = Math.max(...speeds);

  const dists = loop.map((p) => p.dist);
  const distAt = (t: number) => {
    const tt = ((t % lapSeconds) + lapSeconds) % lapSeconds;
    const i = segment(times, tt);
    const span = times[i + 1] - times[i];
    const f = span > 0 ? (tt - times[i]) / span : 0;
    return dists[i] + (dists[i + 1] - dists[i]) * f;
  };
  const timeAt = (d: number) => {
    const dd = wrapDist(d, L);
    const i = segment(dists, dd);
    const span = dists[i + 1] - dists[i];
    const f = span > 0 ? (dd - dists[i]) / span : 0;
    return times[i] + (times[i + 1] - times[i]) * f;
  };
  const speedAt = (d: number) => {
    const dd = wrapDist(d, L);
    const i = segment(dists, dd);
    const span = dists[i + 1] - dists[i];
    const f = span > 0 ? (dd - dists[i]) / span : 0;
    return speeds[i] + (speeds[i + 1] - speeds[i]) * f;
  };

  const kp: string[] = [];
  const kt: string[] = [];
  for (let j = 0; j <= knots; j++) {
    const f = j / knots;
    kp.push(j === knots ? "1" : (distAt(f * lapSeconds) / L).toFixed(5));
    kt.push(f.toFixed(5));
  }

  return { lapSeconds, length: L, times, speeds, minSpeed, maxSpeed, distAt, timeAt, speedAt, keyPoints: kp.join(";"), keyTimes: kt.join(";") };
}

/** m/s to a rounded km/h figure for the HUD. */
export const kmh = (ms: number) => Math.round(ms * 3.6);
