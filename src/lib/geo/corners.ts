import type { Corner, Pt2, Sample, Straight } from "./types";

export interface CornerOptions {
  /** Curvature (rad/m) above which a corner begins. 0.012 ~ 80 m radius. */
  enter: number;
  /** Curvature below which a corner ends. */
  exit: number;
  /** Minimum total turn angle (deg) to count as a corner. */
  minAngleDeg: number;
  /** Same-direction corners closer than this (m) are merged. */
  mergeGap: number;
  /** Half-window in samples for the curvature estimate. */
  window: number;
}

export const DEFAULT_CORNER_OPTIONS: CornerOptions = {
  enter: 0.012,
  exit: 0.006,
  minAngleDeg: 20,
  mergeGap: 40,
  window: 3,
};

const wrap = (i: number, n: number) => ((i % n) + n) % n;

/** Per-segment heading (radians, unwrapped) for a closed loop. Length = loop.length - 1. */
export function headings(loop: Pt2[]): number[] {
  const m = loop.length - 1;
  const out = new Array<number>(m);
  let prev = 0;
  for (let i = 0; i < m; i++) {
    const a = loop[i];
    const b = loop[i + 1];
    let h = Math.atan2(b.y - a.y, b.x - a.x);
    if (i > 0) {
      while (h - prev > Math.PI) h -= 2 * Math.PI;
      while (h - prev < -Math.PI) h += 2 * Math.PI;
    }
    out[i] = h;
    prev = h;
  }
  return out;
}

/** Signed curvature (rad/m) at each sample using a +/- window over the ring. Positive = left turn. */
export function curvature(loop: Sample[], window = 3): number[] {
  const m = loop.length - 1;
  const h = headings(loop);
  const total = loop[m].dist;
  const out = new Array<number>(m);
  for (let i = 0; i < m; i++) {
    const i0 = wrap(i - window, m);
    const i1 = wrap(i + window, m);
    let dh = h[i1] - h[i0];
    // Unwrap across the ring seam.
    while (dh > Math.PI) dh -= 2 * Math.PI;
    while (dh < -Math.PI) dh += 2 * Math.PI;
    let ds = loop[i1].dist - loop[i0].dist;
    if (ds <= 0) ds += total;
    out[i] = ds > 0 ? dh / ds : 0;
  }
  return out;
}

interface Run {
  start: number;
  end: number; // inclusive sample indices (may wrap: start > end)
  angle: number; // radians, signed
  apex: number;
}

export function detectCorners(loop: Sample[], opts: Partial<CornerOptions> = {}): Corner[] {
  const o = { ...DEFAULT_CORNER_OPTIONS, ...opts };
  const m = loop.length - 1;
  if (m < 8) return [];
  const k = curvature(loop, o.window);
  const h = headings(loop);
  const total = loop[m].dist;

  // Find a sample that is definitely not in a corner to start the scan, so wrapping runs are whole.
  let startScan = 0;
  for (let i = 0; i < m; i++) {
    if (Math.abs(k[i]) < o.exit) {
      startScan = i;
      break;
    }
  }

  const runs: Run[] = [];
  let inRun = false;
  let run: Run | null = null;
  let maxK = 0;
  for (let step = 0; step < m; step++) {
    const i = wrap(startScan + step, m);
    const ki = k[i];
    if (!inRun) {
      if (Math.abs(ki) > o.enter) {
        inRun = true;
        run = { start: i, end: i, angle: 0, apex: i };
        maxK = Math.abs(ki);
      }
    } else if (run) {
      if (Math.abs(ki) < o.exit) {
        runs.push(run);
        inRun = false;
        run = null;
      } else {
        run.end = i;
        if (Math.abs(ki) > maxK) {
          maxK = Math.abs(ki);
          run.apex = i;
        }
      }
    }
  }
  if (inRun && run) runs.push(run);

  // Total turn angle over each run from headings.
  for (const r of runs) {
    const a = h[wrap(r.start - o.window, m)];
    const b = h[wrap(r.end + o.window, m)];
    let d = b - a;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    // Long sweeping turns can exceed 180 degrees: integrate instead when the run is long.
    let integ = 0;
    const len = wrap(r.end - r.start, m) + 1;
    for (let s = 0; s < len; s++) {
      const i = wrap(r.start + s, m);
      const j = wrap(i + 1, m);
      let dd = h[j] - h[i];
      while (dd > Math.PI) dd -= 2 * Math.PI;
      while (dd < -Math.PI) dd += 2 * Math.PI;
      integ += dd;
    }
    r.angle = Math.abs(integ) > Math.abs(d) ? integ : d;
  }

  let kept = runs.filter((r) => Math.abs((r.angle * 180) / Math.PI) >= o.minAngleDeg);

  // Merge same-direction neighbours closer than mergeGap.
  const gapBetween = (a: Run, b: Run) => {
    let g = loop[b.start].dist - loop[a.end].dist;
    if (g < 0) g += total;
    return g;
  };
  const merged: Run[] = [];
  for (const r of kept) {
    const prev = merged[merged.length - 1];
    if (prev && Math.sign(prev.angle) === Math.sign(r.angle) && gapBetween(prev, r) < o.mergeGap) {
      prev.end = r.end;
      prev.angle += r.angle;
      if (Math.abs(k[r.apex]) > Math.abs(k[prev.apex])) prev.apex = r.apex;
    } else {
      merged.push({ ...r });
    }
  }
  kept = merged;

  // Order by distance from start/finish and number.
  kept.sort((a, b) => loop[a.apex].dist - loop[b.apex].dist);
  return kept.map((r, idx) => ({
    index: r.apex,
    dist: loop[r.apex].dist,
    startDist: loop[r.start].dist,
    endDist: loop[r.end].dist,
    angleDeg: (r.angle * 180) / Math.PI,
    direction: r.angle > 0 ? "L" : "R",
    number: idx + 1,
    apex: { x: loop[r.apex].x, y: loop[r.apex].y },
  }));
}

/** Sector boundaries at 1/3 and 2/3 of the lap, snapped to the nearest corner exit within `snap` m. */
export function sectors(totalLength: number, corners: Corner[], snap = 150): [number, number, number] {
  const pick = (target: number) => {
    let best = target;
    let bestD = snap;
    for (const c of corners) {
      const d = Math.abs(c.endDist - target);
      if (d < bestD) {
        bestD = d;
        best = c.endDist;
      }
    }
    return best;
  };
  return [0, pick(totalLength / 3), pick((2 * totalLength) / 3)];
}

/** Longest gap between consecutive corners (corner exit to next corner entry), wrapping. */
export function longestStraight(totalLength: number, corners: Corner[]): Straight {
  if (corners.length === 0) return { startDist: 0, endDist: totalLength, length: totalLength };
  if (corners.length === 1) {
    const c = corners[0];
    const len = totalLength - (c.endDist - c.startDist);
    return { startDist: c.endDist, endDist: c.startDist, length: len };
  }
  let best: Straight = { startDist: 0, endDist: 0, length: -1 };
  for (let i = 0; i < corners.length; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % corners.length];
    let len = b.startDist - a.endDist;
    if (len < 0) len += totalLength;
    if (len > best.length) best = { startDist: a.endDist, endDist: b.startDist, length: len };
  }
  return best;
}
