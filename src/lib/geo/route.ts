import { rezero } from "./project";
import { segmentsIntersect } from "./post";
import type { Pt2, Sample } from "./types";

const EPS = 1e-9;

/** True if two polylines cross. Segment pairs that share an endpoint are ignored (touching joins). */
export function polylinesIntersect(a: Pt2[], b: Pt2[]): boolean {
  for (let i = 0; i < a.length - 1; i++) {
    const p = a[i];
    const q = a[i + 1];
    const minX = Math.min(p.x, q.x);
    const maxX = Math.max(p.x, q.x);
    const minY = Math.min(p.y, q.y);
    const maxY = Math.max(p.y, q.y);
    for (let j = 0; j < b.length - 1; j++) {
      const r = b[j];
      const s = b[j + 1];
      if (Math.max(r.x, s.x) < minX || Math.min(r.x, s.x) > maxX) continue;
      if (Math.max(r.y, s.y) < minY || Math.min(r.y, s.y) > maxY) continue;
      if (same(p, r) || same(p, s) || same(q, r) || same(q, s)) continue;
      if (segmentsIntersect(p, q, r, s)) return true;
    }
  }
  return false;
}

function same(a: Pt2, b: Pt2): boolean {
  return Math.abs(a.x - b.x) < EPS && Math.abs(a.y - b.y) < EPS;
}

/** Centripetal Catmull-Rom spline through the given points, `per` samples per segment (endpoints exact). */
export function catmullRom(pts: Pt2[], per = 10): Pt2[] {
  if (pts.length < 2) return pts.map((p) => ({ ...p }));
  if (pts.length === 2) {
    return Array.from({ length: per + 1 }, (_, i) => {
      const t = i / per;
      return { x: pts[0].x + (pts[1].x - pts[0].x) * t, y: pts[0].y + (pts[1].y - pts[0].y) * t };
    });
  }
  const P = [pts[0], ...pts, pts[pts.length - 1]];
  const out: Pt2[] = [];
  const alpha = 0.5;
  const tj = (ti: number, a: Pt2, b: Pt2) => ti + Math.pow(Math.hypot(b.x - a.x, b.y - a.y), alpha) || ti + 1e-6;
  for (let i = 1; i < P.length - 2; i++) {
    const p0 = P[i - 1];
    const p1 = P[i];
    const p2 = P[i + 1];
    const p3 = P[i + 2];
    const t0 = 0;
    const t1 = tj(t0, p0, p1);
    const t2 = tj(t1, p1, p2);
    const t3 = tj(t2, p2, p3);
    const n = i === P.length - 3 ? per + 1 : per;
    for (let k = 0; k < n; k++) {
      const t = t1 + ((t2 - t1) * k) / per;
      const A1 = lerpT(p0, p1, t0, t1, t);
      const A2 = lerpT(p1, p2, t1, t2, t);
      const A3 = lerpT(p2, p3, t2, t3, t);
      const B1 = lerpT(A1, A2, t0, t2, t);
      const B2 = lerpT(A2, A3, t1, t3, t);
      out.push(lerpT(B1, B2, t1, t2, t));
    }
  }
  out[0] = { ...pts[0] };
  out[out.length - 1] = { ...pts[pts.length - 1] };
  return out;
}

function lerpT(a: Pt2, b: Pt2, ta: number, tb: number, t: number): Pt2 {
  const d = tb - ta;
  if (Math.abs(d) < 1e-12) return { ...a };
  const u = (t - ta) / d;
  return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
}

function cubic(p0: Pt2, t0: Pt2, p1: Pt2, t1: Pt2, k: number, samples = 24, cap = Infinity): Pt2[] {
  const d = Math.hypot(p1.x - p0.x, p1.y - p0.y);
  const L = Math.min(cap, Math.min(0.8, Math.max(0.15, k)) * d);
  const c0 = { x: p0.x + t0.x * L, y: p0.y + t0.y * L };
  const c1 = { x: p1.x - t1.x * L, y: p1.y - t1.y * L };
  return Array.from({ length: samples }, (_, i) => {
    const t = i / (samples - 1);
    const mt = 1 - t;
    return {
      x: mt * mt * mt * p0.x + 3 * mt * mt * t * c0.x + 3 * mt * t * t * c1.x + t * t * t * p1.x,
      y: mt * mt * mt * p0.y + 3 * mt * mt * t * c0.y + 3 * mt * t * t * c1.y + t * t * t * p1.y,
    };
  });
}

export interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface RouteTrace {
  kind: string;
  selfCross: boolean;
  /** Index of the first obstacle hit, or -1. */
  hit: number;
}

export interface RouteOptions {
  /** Vertical band occupied by the letters: detours run at minY - margin or maxY + margin. */
  band: { minY: number; maxY: number };
  /** Clearance below / above the band for detours. */
  margin?: number;
  /** x of the free vertical corridor between the two letters (gap centre). */
  xGap: number;
  /** Bounding box of the letter being left / entered, used to escape along the tangent. */
  fromBox?: BBox;
  toBox?: BBox;
  /** Outline of the letter being left / entered, used to validate escape paths. */
  fromGlyph?: Pt2[];
  toGlyph?: Pt2[];
  /** Prefer detouring under (true) or over (false). Defaults by the entry height. */
  preferUnder?: boolean;
  /** Upper bound on Bezier control length (glyph units), to stop long connectors ballooning. */
  controlCap?: number;
  /** Filled with one entry per candidate tried, for debugging. */
  trace?: RouteTrace[];
}

const ESCAPE_CLEARANCE = 0.12;
const MIN_LEAD = 0.2;
const MAX_LEAD = 1.6;
const HAIRPIN_FWD = 0.12;
const HAIRPIN_SIDE = 0.22;

/** Walk from `p` along `dir` until outside `box` (expanded by a clearance); returns the escape point. */
export function escapePoint(p: Pt2, dir: Pt2, box?: BBox): Pt2 {
  if (!box) return { x: p.x + dir.x * MIN_LEAD, y: p.y + dir.y * MIN_LEAD };
  const inside = (q: Pt2) =>
    q.x > box.minX - ESCAPE_CLEARANCE &&
    q.x < box.maxX + ESCAPE_CLEARANCE &&
    q.y > box.minY - ESCAPE_CLEARANCE &&
    q.y < box.maxY + ESCAPE_CLEARANCE;
  let L = MIN_LEAD;
  let q = { x: p.x + dir.x * L, y: p.y + dir.y * L };
  while (inside(q) && L < MAX_LEAD) {
    L += 0.05;
    q = { x: p.x + dir.x * L, y: p.y + dir.y * L };
  }
  return q;
}

/**
 * Ways to get from a letter end `p` (travelling along `dir`) to open space, as waypoint lists that
 * start with `p`. First the straight run along the tangent; then hairpins that turn back and leave
 * the way the stroke came in (for ends that point into the letter, like a G's inner hook).
 * Paths that cross the letter's own outline are dropped (the straight run is always kept last).
 */
export function escapePaths(p: Pt2, dir: Pt2, box?: BBox, glyph?: Pt2[]): Pt2[][] {
  const direct = [p, escapePoint(p, dir, box)];
  const out: Pt2[][] = [];
  const back = { x: -dir.x, y: -dir.y };
  for (const side of [1, -1]) {
    const n = { x: -dir.y * side, y: dir.x * side };
    const a = { x: p.x + dir.x * HAIRPIN_FWD, y: p.y + dir.y * HAIRPIN_FWD };
    const b = { x: a.x + n.x * HAIRPIN_SIDE, y: a.y + n.y * HAIRPIN_SIDE };
    const c = { x: p.x - dir.x * 0.1 + n.x * HAIRPIN_SIDE, y: p.y - dir.y * 0.1 + n.y * HAIRPIN_SIDE };
    const d = escapePoint(c, back, box);
    out.push([p, a, b, c, d]);
  }
  const valid = (path: Pt2[]) => !glyph || !polylinesIntersect(path, glyph);
  const directOk = valid(direct);
  const hairpins = out.filter(valid);
  return directOk ? [direct, ...hairpins] : [...hairpins, direct];
}

/**
 * Connect exit P (leaving along unit tangent tP) to entry Q (arriving along tQ), avoiding the given
 * obstacle polylines. Tries a smooth tangent-continuous curve first, then escape paths out of each
 * letter joined directly or by a detour under / over the letter band through the gap corridor.
 * Returns points including both endpoints, dist re-zeroed, z = 0.
 */
export function routeConnector(
  P: Pt2,
  tP: Pt2,
  Q: Pt2,
  tQ: Pt2,
  obstacles: Pt2[][],
  opts: RouteOptions,
): { pts: Sample[]; kind: string } {
  const margin = opts.margin ?? 0.35;
  const { band, xGap } = opts;
  const inBand = (q: Pt2) => q.y >= band.minY && q.y <= band.maxY;
  const exits = escapePaths(P, tP, opts.fromBox, opts.fromGlyph);
  // Entry escapes are computed walking backwards from Q, then reversed so they end at Q.
  const entries = escapePaths(Q, { x: -tQ.x, y: -tQ.y }, opts.toBox, opts.toGlyph).map((e) => [...e].reverse());
  const preferUnder = opts.preferUnder ?? Q.y < (band.minY + band.maxY) / 2;
  const yU = band.minY - margin;
  const yO = band.maxY + margin;

  const detour = (ex: Pt2[], en: Pt2[], yDet: number): Pt2[] => {
    const E = ex[ex.length - 1];
    const F = en[0];
    const way: Pt2[] = [...ex];
    if (inBand(E)) {
      way.push({ x: E.x, y: yDet });
    } else {
      const xA = Math.max(xGap, E.x);
      way.push({ x: xA, y: E.y }, { x: xA, y: yDet });
    }
    if (inBand(F)) {
      way.push({ x: F.x, y: yDet });
    } else {
      const xB = Math.min(xGap, F.x);
      way.push({ x: xB, y: yDet }, { x: xB, y: F.y });
    }
    way.push(...en);
    return catmullRom(dedupe(way), 8);
  };

  const cap = opts.controlCap ?? Infinity;
  const candidates: [string, () => Pt2[]][] = [
    ["cubic", () => cubic(P, tP, Q, tQ, 0.4, 24, cap)],
    ["cubic-tight", () => cubic(P, tP, Q, tQ, 0.18, 24, cap)],
  ];
  exits.forEach((ex, i) => {
    entries.forEach((en, j) => {
      const tag = `${i}${j}`;
      candidates.push([`lead${tag}`, () => catmullRom(dedupe([...ex, ...en]), 10)]);
      const u: [string, () => Pt2[]] = [`under${tag}`, () => detour(ex, en, yU)];
      const o: [string, () => Pt2[]] = [`over${tag}`, () => detour(ex, en, yO)];
      candidates.push(preferUnder ? u : o, preferUnder ? o : u);
    });
  });

  let fallback: Pt2[] | null = null;
  for (const [kind, make] of candidates) {
    const pts = make();
    if (!fallback) fallback = pts;
    const sc = selfCrosses(pts);
    const hit = sc ? -1 : obstacles.findIndex((o) => polylinesIntersect(pts, o));
    opts.trace?.push({ kind, selfCross: sc, hit });
    if (!sc && hit < 0) {
      return { pts: rezero(pts.map((p) => ({ ...p, z: 0 }))), kind };
    }
  }
  return { pts: rezero((fallback ?? [P, Q]).map((p) => ({ ...p, z: 0 }))), kind: "fallback" };
}

function dedupe(pts: Pt2[]): Pt2[] {
  const out: Pt2[] = [];
  for (const p of pts) {
    const last = out[out.length - 1];
    if (!last || Math.hypot(p.x - last.x, p.y - last.y) > 1e-6) out.push(p);
  }
  return out;
}

function selfCrosses(pts: Pt2[]): boolean {
  for (let i = 0; i < pts.length - 1; i++) {
    for (let j = i + 2; j < pts.length - 1; j++) {
      if (segmentsIntersect(pts[i], pts[i + 1], pts[j], pts[j + 1])) return true;
    }
  }
  return false;
}
