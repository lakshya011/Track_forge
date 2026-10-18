import { easeAlong } from "./elevation";
import { rezero } from "./project";
import { routeConnector, type RouteTrace } from "./route";
import type { Glyph, Pt2, Sample } from "./types";

export type LayoutItem = Glyph | "space";

export interface PlacedGlyph extends Glyph {
  offsetX: number;
}

export const DEFAULT_GAP = 0.35;
export const DEFAULT_SPACE_GAP = 1.0;
export const DEFAULT_RETURN_OFFSET = 0.6;
export const RETURN_SIDE_MARGIN = 0.4;

export interface LayoutOptions {
  gap?: number;
  spaceGap?: number;
  /** Space letters by stroke clearance instead of bounding boxes so shapes can nest (A next to V). */
  kern?: boolean;
  /** How far (glyph units) the next entry may sit left of the previous exit when kerning. */
  maxBackstep?: number;
}

function subsample(pts: Pt2[], max = 90): Pt2[] {
  if (pts.length <= max) return pts;
  const step = (pts.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => pts[Math.round(i * step)]);
}

function pointSegDist(p: Pt2, a: Pt2, b: Pt2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  let t = l2 > 0 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
}

/** Minimum distance between two polylines (points of each against segments of the other). */
export function polylineClearance(a: Pt2[], b: Pt2[]): number {
  let best = Infinity;
  for (const p of a) for (let j = 0; j < b.length - 1; j++) best = Math.min(best, pointSegDist(p, b[j], b[j + 1]));
  for (const p of b) for (let j = 0; j < a.length - 1; j++) best = Math.min(best, pointSegDist(p, a[j], a[j + 1]));
  return best;
}

/**
 * Lay glyphs left to right on baseline y = 0. A "space" advances the cursor by spaceGap.
 * With `kern`, each glyph slides left from its bounding-box position until its strokes come within
 * `gap` of the previous glyph's strokes, so letters nest optically.
 */
export function layoutGlyphs(items: LayoutItem[], gapOrOpts: number | LayoutOptions = DEFAULT_GAP, spaceGapArg = DEFAULT_SPACE_GAP): PlacedGlyph[] {
  const opts: LayoutOptions = typeof gapOrOpts === "number" ? { gap: gapOrOpts, spaceGap: spaceGapArg } : gapOrOpts;
  const gap = opts.gap ?? DEFAULT_GAP;
  const spaceGap = opts.spaceGap ?? DEFAULT_SPACE_GAP;
  const maxBackstep = opts.maxBackstep ?? 0.6;
  const out: PlacedGlyph[] = [];
  let cx = 0;
  let pendingSpace = 0;
  for (const item of items) {
    if (item === "space") {
      pendingSpace += spaceGap;
      continue;
    }
    let dx = cx + pendingSpace;
    const prev = out[out.length - 1];
    if (opts.kern && prev && pendingSpace === 0) {
      const prevPts = subsample(prev.pts);
      const mine = subsample(item.pts);
      const minDx = prev.exit.x - item.entry.x - maxBackstep;
      const step = 0.02;
      let candidate = dx;
      while (candidate - step >= minDx) {
        const shifted = mine.map((p) => ({ x: p.x + candidate - step, y: p.y }));
        if (polylineClearance(prevPts, shifted) < gap) break;
        candidate -= step;
      }
      dx = candidate;
    }
    pendingSpace = 0;
    out.push({
      ...item,
      offsetX: dx,
      pts: item.pts.map((p) => ({ ...p, x: p.x + dx })),
      entry: { x: item.entry.x + dx, y: item.entry.y },
      exit: { x: item.exit.x + dx, y: item.exit.y },
    });
    cx = Math.max(cx, dx + item.width) + gap;
  }
  return out;
}

function lerp(a: Pt2, b: Pt2, t: number): Pt2 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function cubicPoint(p0: Pt2, c0: Pt2, c1: Pt2, p1: Pt2, t: number): Pt2 {
  const a = lerp(p0, c0, t);
  const b = lerp(c0, c1, t);
  const c = lerp(c1, p1, t);
  const d = lerp(a, b, t);
  const e = lerp(b, c, t);
  return lerp(d, e, t);
}

/**
 * Cubic Bezier from p0 (leaving along unit tangent t0) to p1 (arriving along unit tangent t1).
 * Control length = k * |p1 - p0| clamped to [0.15, 0.8] of that distance. Elevation eased z0 -> z1.
 * Returns `samples` points including both endpoints; dist re-zeroed.
 */
export function connectCubic(
  p0: Pt2,
  t0: Pt2,
  p1: Pt2,
  t1: Pt2,
  z0 = 0,
  z1 = 0,
  k = 0.4,
  samples = 24,
): Sample[] {
  const d = Math.hypot(p1.x - p0.x, p1.y - p0.y);
  const kk = Math.min(0.8, Math.max(0.15, k));
  const L = kk * d;
  const c0 = { x: p0.x + t0.x * L, y: p0.y + t0.y * L };
  const c1 = { x: p1.x - t1.x * L, y: p1.y - t1.y * L };
  const pts = Array.from({ length: samples }, (_, i) => {
    const t = i / (samples - 1);
    const p = cubicPoint(p0, c0, c1, p1, t);
    return { x: p.x, y: p.y, z: 0 };
  });
  return easeAlong(rezero(pts), z0, z1);
}

function straight(a: Pt2, b: Pt2, samples = 16): Sample[] {
  return rezero(
    Array.from({ length: samples }, (_, i) => {
      const p = lerp(a, b, i / (samples - 1));
      return { x: p.x, y: p.y, z: 0 };
    }),
  );
}

export interface ReturnPath {
  pts: Sample[];
  /** Index within pts of the start/finish point (midpoint of the straight). */
  startFinishIndex: number;
  kinds: [string, string];
}

/**
 * The closing "pit straight": last exit -> around the right -> long straight leftwards below the
 * letters -> into the first entry. Both ends are routed around the letter outlines.
 * Elevation eases from zLast to zFirst over the whole path.
 */
export function buildReturnPath(
  lastExit: Pt2,
  lastTangent: Pt2,
  firstEntry: Pt2,
  firstTangent: Pt2,
  bbox: { minX: number; maxX: number; minY: number; maxY: number },
  offset = DEFAULT_RETURN_OFFSET,
  zLast = 0,
  zFirst = 0,
  obstacles: Pt2[][] = [],
  lastBox?: { minX: number; minY: number; maxX: number; maxY: number },
  firstBox?: { minX: number; minY: number; maxX: number; maxY: number },
  lastGlyph?: Pt2[],
  firstGlyph?: Pt2[],
  traces?: RouteTrace[][],
): ReturnPath {
  const y = bbox.minY - offset;
  const B = { x: bbox.maxX + RETURN_SIDE_MARGIN, y };
  const C = { x: bbox.minX - RETURN_SIDE_MARGIN, y };
  // Arrive at B from above so the approach never runs along the straight itself.
  const down = { x: 0, y: -1 };
  const band = { minY: bbox.minY, maxY: bbox.maxY };
  const margin = Math.min(0.35, offset * 0.55);
  const r1 = routeConnector(lastExit, lastTangent, B, down, obstacles, {
    band,
    margin,
    xGap: bbox.maxX + RETURN_SIDE_MARGIN / 2,
    fromBox: lastBox,
    fromGlyph: lastGlyph,
    preferUnder: true,
    controlCap: 0.45,
    trace: traces?.[0],
  });
  const seg1 = r1.pts;
  const seg2 = straight(B, C);
  const r3 = routeConnector(C, { x: 0, y: 1 }, firstEntry, firstTangent, [...obstacles, seg1], {
    band,
    margin,
    xGap: bbox.minX - RETURN_SIDE_MARGIN / 2,
    toBox: firstBox,
    toGlyph: firstGlyph,
    preferUnder: firstEntry.y < (bbox.minY + bbox.maxY) / 2,
    controlCap: 0.45,
    trace: traces?.[1],
  });
  const seg3 = r3.pts;
  const merged = [...seg1, ...seg2.slice(1), ...seg3.slice(1)].map((p) => ({ x: p.x, y: p.y, z: 0 }));
  const pts = easeAlong(rezero(merged), zLast, zFirst);
  const sfIndex = seg1.length - 1 + Math.floor((seg2.length - 1) / 2);
  return { pts, startFinishIndex: sfIndex, kinds: [r1.kind, r3.kind] };
}

export interface AssembledLoop {
  /** Closed loop in glyph units starting at the start/finish point; first === last. */
  loop: Sample[];
  /** Indices into `loop` where glyphs meet connectors or the return path. */
  joinIndices: number[];
  /** Index ranges [start, end) of each glyph within `loop`, in letter order. */
  glyphRanges: [number, number][];
  /** Route kind chosen for each connector (letters-1 entries) then the two return-path legs. */
  routeKinds: string[];
}

export function bboxOf(pts: Pt2[]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY };
}

const zOf = (p: Sample) => p.z;

/** Concatenate glyphs with connectors and the return path into a closed loop starting at start/finish. */
export function assembleLoop(placed: PlacedGlyph[], offset = DEFAULT_RETURN_OFFSET, traces?: RouteTrace[][]): AssembledLoop {
  if (placed.length === 0) throw new Error("assembleLoop: no glyphs");
  const parts: Sample[][] = [];
  const isGlyph: boolean[] = [];
  const all = placed.flatMap((g) => g.pts);
  const bb = bboxOf(all);
  const band = { minY: bb.minY, maxY: bb.maxY };
  const obstacles: Pt2[][] = placed.map((g) => g.pts);
  const routeKinds: string[] = [];
  for (let i = 0; i < placed.length; i++) {
    const g = placed[i];
    parts.push(g.pts);
    isGlyph.push(true);
    if (i < placed.length - 1) {
      const n = placed[i + 1];
      const gb = bboxOf(g.pts);
      const nb = bboxOf(n.pts);
      const route = routeConnector(g.exit, g.exitTangent, n.entry, n.entryTangent, obstacles, {
        band,
        xGap: (gb.maxX + nb.minX) / 2,
        fromBox: gb,
        toBox: nb,
        fromGlyph: g.pts,
        toGlyph: n.pts,
        trace: traces?.[i],
      });
      routeKinds.push(route.kind);
      const routed = route.pts;
      const conn = easeAlong(routed, zOf(g.pts[g.pts.length - 1]), zOf(n.pts[0]));
      parts.push(conn);
      isGlyph.push(false);
      obstacles.push(conn);
    }
  }
  const first = placed[0];
  const last = placed[placed.length - 1];
  const ret = buildReturnPath(
    last.exit,
    last.exitTangent,
    first.entry,
    first.entryTangent,
    bb,
    offset,
    zOf(last.pts[last.pts.length - 1]),
    zOf(first.pts[0]),
    obstacles,
    bboxOf(last.pts),
    bboxOf(first.pts),
    last.pts,
    first.pts,
    traces ? [traces[placed.length - 1] ?? [], traces[placed.length] ?? []] : undefined,
  );
  parts.push(ret.pts);
  isGlyph.push(false);

  // Concatenate, dropping duplicated shared endpoints between consecutive parts.
  const seq: Sample[] = [];
  // Index 0 is where the return path closes back onto the first glyph.
  const joins: number[] = [0];
  const ranges: [number, number][] = [];
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    const startIdx = seq.length === 0 ? 0 : seq.length - 1;
    const slice = i === 0 ? p : p.slice(1);
    if (i > 0) joins.push(startIdx);
    seq.push(...slice.map((q) => ({ x: q.x, y: q.y, z: q.z, dist: 0 })));
    if (isGlyph[i]) ranges.push([startIdx, seq.length]);
  }
  // seq now ends at first.entry (== seq[0]); drop that duplicate before rotating.
  const open = seq.slice(0, -1);
  const retStartInSeq = seq.length - ret.pts.length; // index of ret.pts[0] in seq
  const sfIndex = retStartInSeq + ret.startFinishIndex;
  const rotated = [...open.slice(sfIndex), ...open.slice(0, sfIndex)];
  const rot = (i: number) => (((i - sfIndex) % open.length) + open.length) % open.length;
  const loop = rezero([...rotated, { ...rotated[0] }]);
  return {
    loop,
    joinIndices: joins.map(rot).sort((a, b) => a - b),
    glyphRanges: ranges.map(([a, b]) => [rot(a), rot(a) + (b - a)]),
    routeKinds: [...routeKinds, ...ret.kinds],
  };
}
