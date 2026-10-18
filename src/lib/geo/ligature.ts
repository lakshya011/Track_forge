import { rezero, sampleAt } from "./project";
import { polylinesIntersect } from "./route";
import { endTangents } from "./section";
import type { Glyph, Pt2, Sample } from "./types";

/** Max lateral deviation (glyph units) from the chord for a stretch to count as one straight run. */
const RUN_DEVIATION = 0.07;
/** Max angle (radians) between an exit run and the next entry run to share them. */
const SHARE_ANGLE = 0.52; // ~30 degrees
/** Minimum shared length in glyph units (cap height = 1). */
const MIN_SHARED = 0.25;

const angleBetween = (a: Pt2, b: Pt2) => {
  const d = Math.max(-1, Math.min(1, a.x * b.x + a.y * b.y));
  return Math.acos(d);
};

export interface Run {
  /** Length along the polyline. */
  length: number;
  /** Unit chord direction, in travel order. */
  dir: Pt2;
}

function lateral(p: Pt2, a: Pt2, b: Pt2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l = Math.hypot(dx, dy) || 1;
  return Math.abs((p.x - a.x) * dy - (p.y - a.y) * dx) / l;
}

/** Longest straight-ish prefix/suffix of a polyline, judged by lateral deviation from its chord. */
function chordRun(pts: Sample[], fromEnd: boolean): Run {
  const n = pts.length;
  const at = (i: number) => (fromEnd ? pts[n - 1 - i] : pts[i]);
  let best = 1;
  for (let k = 2; k < n; k++) {
    const a = at(0);
    const b = at(k);
    let ok = true;
    for (let j = 1; j < k; j++) {
      if (lateral(at(j), a, b) > RUN_DEVIATION) {
        ok = false;
        break;
      }
    }
    if (!ok) break;
    best = k;
  }
  const a = at(0);
  const b = at(best);
  const length = Math.abs(b.dist - a.dist);
  // Direction in travel order: for the exit run that is from b (earlier) to a (the end).
  const dx = fromEnd ? a.x - b.x : b.x - a.x;
  const dy = fromEnd ? a.y - b.y : b.y - a.y;
  const l = Math.hypot(dx, dy) || 1;
  return { length, dir: { x: dx / l, y: dy / l } };
}

/** The straight run that ends a glyph. */
export function exitRun(g: Glyph): Run {
  return chordRun(g.pts, true);
}

/** The straight run that starts a glyph. */
export function entryRun(g: Glyph): Run {
  return chordRun(g.pts, false);
}

export const exitRunLength = (g: Glyph) => exitRun(g).length;
export const entryRunLength = (g: Glyph) => entryRun(g).length;

function rotateAbout(p: Pt2, c: Pt2, rad: number): Pt2 {
  const cs = Math.cos(rad);
  const sn = Math.sin(rad);
  const x = p.x - c.x;
  const y = p.y - c.y;
  return { x: c.x + x * cs - y * sn, y: c.y + x * sn + y * cs };
}

/** Translate so minX = minY = 0 and recompute width / endpoints. Scale is untouched. */
export function renormalize(pts: Sample[], first: Glyph, mergedCount: number): Glyph {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
  }
  const out = rezero(pts.map((p) => ({ x: p.x - minX, y: p.y - minY, z: p.z })));
  const t = endTangents(out);
  return {
    pts: out,
    width: maxX - minX,
    entry: { x: out[0].x, y: out[0].y },
    exit: { x: out[out.length - 1].x, y: out[out.length - 1].y },
    entryTangent: t.entry,
    exitTangent: t.exit,
    section: first.section,
    merged: mergedCount,
  };
}

/**
 * If `g` ends with a straight run pointing the same way `n` begins, let the two letters share that
 * stroke: trim the shared length off `g`'s end, rotate `n` slightly so its entry run is parallel,
 * and place `n`'s entry where the trimmed run began. Returns the compound glyph or null.
 */
export function tryShareStroke(g: Glyph, n: Glyph): Glyph | null {
  const er = exitRun(g);
  const nr = entryRun(n);
  if (angleBetween(er.dir, nr.dir) > SHARE_ANGLE) return null;
  const shared = Math.min(er.length, nr.length);
  if (shared < MIN_SHARED) return null;
  const gLen = g.pts[g.pts.length - 1].dist;
  const cutAt = gLen - shared;
  if (cutAt <= 0) return null;
  const cut = sampleAt(g.pts, cutAt);
  const head = [...g.pts.filter((p) => p.dist < cutAt), cut];
  // Rotate n so its entry run is parallel to g's exit run, then move its entry onto the cut.
  const rot = Math.atan2(er.dir.y, er.dir.x) - Math.atan2(nr.dir.y, nr.dir.x);
  const tail: Sample[] = n.pts.map((p) => {
    const r = rotateAbout(p, n.entry, rot);
    return { x: r.x - n.entry.x + cut.x, y: r.y - n.entry.y + cut.y, z: p.z, dist: 0 };
  });
  // The two bodies must not cross each other (the shared run itself touches by design).
  if (polylinesIntersect(head.slice(0, -1), tail.slice(1))) return null;
  // Keep the next letter from dropping far below the baseline.
  const minY = Math.min(...tail.map((p) => p.y));
  if (minY < -0.35) return null;
  const merged = [...head, ...tail.slice(1)];
  return renormalize(merged, g, (g.merged ?? 1) + (n.merged ?? 1));
}

/** Merge consecutive glyphs that can share a stroke. Spaces break chains. */
export function mergeChain<T>(items: (Glyph | T)[], isGlyph: (x: Glyph | T) => x is Glyph): { items: (Glyph | T)[]; merges: number[] } {
  const out: (Glyph | T)[] = [];
  const merges: number[] = [];
  let letterIndex = 0;
  for (const item of items) {
    const prev = out[out.length - 1];
    if (isGlyph(item) && prev !== undefined && isGlyph(prev)) {
      const m = tryShareStroke(prev, item);
      if (m) {
        out[out.length - 1] = m;
        merges.push(letterIndex - 1);
        letterIndex++;
        continue;
      }
    }
    out.push(item);
    if (isGlyph(item)) letterIndex++;
  }
  return { items: out, merges };
}

/**
 * A glyph that is essentially a vertical stroke (entry and exit at the same x) can be driven either
 * way. Pick the direction that continues the previous glyph's exit heading.
 */
export function alignReversible(prevExitTangent: Pt2, g: Glyph): Glyph {
  if (Math.abs(g.entry.x - g.exit.x) > 0.08) return g;
  const fwd = prevExitTangent.x * g.entryTangent.x + prevExitTangent.y * g.entryTangent.y;
  const back = -(prevExitTangent.x * g.exitTangent.x + prevExitTangent.y * g.exitTangent.y);
  if (back <= fwd) return g;
  const pts = rezero([...g.pts].reverse());
  const t = endTangents(pts);
  return { ...g, pts, entry: g.exit, exit: g.entry, entryTangent: t.entry, exitTangent: t.exit };
}
