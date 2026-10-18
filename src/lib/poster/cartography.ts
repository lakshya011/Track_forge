import { gravelTraps, grandstands, insideNormal, pointAt, rangeIndices, startFinishStraight, straightBefore, wrapDist } from "../geo/decor";
import { hashString, mulberry32 } from "../geo/rng";
import { outwardNormal } from "../geo/svg";
import type { Pt2, Track } from "../geo/types";

/*
 * Procedural, fictional surroundings for a stitched lap, in track metres and deterministic for
 * (name, seed). Nothing here pretends the lap sits on real land: a town plan is laid out around the
 * loop so the map styles have something to frame the circuit with. Highways curve across the sheet,
 * arterials branch off them, two or three settlements carry local street grids packed with building
 * footprints, field parcels and woodland fill the countryside, a river crosses the sheet with ponds
 * in the voids, and the circuit itself gets its pit complex, grandstands, car parks, run-off and
 * service roads. Density is highest near the circuit and tapers to the edges. Output is
 * style-agnostic geometry; the engraved style draws it as line-art on wood, the cartographic style
 * as a grey hierarchy on charcoal with pale-blue water.
 */

export interface Extent {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export type FieldKind = "hatch" | "rows" | "cross" | "orchard" | "plain";

export interface FieldCell {
  polygon: Pt2[];
  kind: FieldKind;
  /** Hatch angle in degrees. */
  angle: number;
}

export type RoadKind = "highway" | "arterial" | "access" | "perimeter" | "through" | "street" | "service";

export interface Road {
  pts: Pt2[];
  kind: RoadKind;
}

export interface CarPark {
  outline: Pt2[];
  /** Parking lanes parallel to the straight. */
  rows: Pt2[][];
}

export type Water = { kind: "lake"; polygon: Pt2[]; centre: Pt2; radius: number } | { kind: "river"; pts: Pt2[]; width: number };

export interface Contour {
  level: number;
  /** Line segments in metres; drawn as one path per level. */
  segments: [Pt2, Pt2][];
}

export interface Settlement {
  centre: Pt2;
  radius: number;
  /** Blob outline of the built-up area. */
  outline: Pt2[];
  /** Block polygons between the streets; the streets themselves are roads of kind "street". */
  blocks: Pt2[][];
  plan: "grid" | "organic";
}

export interface Cartography {
  seed: number;
  extent: Extent;
  /** Size factor: 1 for a loop about 1200 m across. */
  unit: number;
  fields: FieldCell[];
  roads: Road[];
  settlements: Settlement[];
  carParks: CarPark[];
  pitLane: Pt2[];
  pitBuilding: Pt2[];
  paddock: Pt2[][];
  /** Every building footprint: town blocks, road frontage, farmsteads. */
  buildings: Pt2[][];
  /** Grandstand blocks outside the straights and the two biggest corners. */
  stands: Pt2[][];
  /** Gravel run-off outside heavy-braking corners. */
  runoffs: Pt2[][];
  /** Roads that pass under the circuit (paddock to the car park). */
  tunnels: Pt2[][];
  /** Woodland patches. */
  woods: Pt2[][];
  /** The main body of water (a river across the sheet, or a lake). */
  water: Water | null;
  /** Smaller ponds in the voids. */
  ponds: Water[];
  contours: Contour[];
}

export const CARTOGRAPHY_SALT = 0xc4a7;

/** The RNG seed the surroundings use for a given name and seed. */
export function cartographySeed(name: string, seed: number): number {
  return (hashString(name) ^ (seed >>> 0) ^ CARTOGRAPHY_SALT) >>> 0;
}
/* ---------- small geometry helpers ---------- */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function bbox(pts: Pt2[]): Extent {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

export function pointInPolygon(p: Pt2, poly: Pt2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

function orient(a: Pt2, b: Pt2, c: Pt2): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

/** Proper or touching intersection of segments ab and cd. */
export function segmentsIntersect(a: Pt2, b: Pt2, c: Pt2, d: Pt2): boolean {
  const o1 = orient(a, b, c);
  const o2 = orient(a, b, d);
  const o3 = orient(c, d, a);
  const o4 = orient(c, d, b);
  if (o1 * o2 < 0 && o3 * o4 < 0) return true;
  const on = (p: Pt2, q: Pt2, r: Pt2) => Math.min(p.x, r.x) <= q.x && q.x <= Math.max(p.x, r.x) && Math.min(p.y, r.y) <= q.y && q.y <= Math.max(p.y, r.y);
  if (o1 === 0 && on(a, c, b)) return true;
  if (o2 === 0 && on(a, d, b)) return true;
  if (o3 === 0 && on(c, a, d)) return true;
  if (o4 === 0 && on(c, b, d)) return true;
  return false;
}

/** True when polyline `a` crosses polyline `b` anywhere. */
export function polylinesCross(a: Pt2[], b: Pt2[]): boolean {
  const bb = bbox(b);
  for (let i = 0; i + 1 < a.length; i++) {
    const p = a[i];
    const q = a[i + 1];
    if (Math.max(p.x, q.x) < bb.minX || Math.min(p.x, q.x) > bb.maxX || Math.max(p.y, q.y) < bb.minY || Math.min(p.y, q.y) > bb.maxY) continue;
    for (let j = 0; j + 1 < b.length; j++) if (segmentsIntersect(p, q, b[j], b[j + 1])) return true;
  }
  return false;
}

export function convexHull(pts: Pt2[]): Pt2[] {
  const s = [...pts].sort((a, b) => a.x - b.x || a.y - b.y);
  if (s.length < 3) return s;
  const lower: Pt2[] = [];
  for (const p of s) {
    while (lower.length >= 2 && orient(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Pt2[] = [];
  for (let i = s.length - 1; i >= 0; i--) {
    const p = s[i];
    while (upper.length >= 2 && orient(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  upper.pop();
  lower.pop();
  return [...lower, ...upper];
}

/** Offset a counter-clockwise convex polygon outward by `d` (mitred, miter length capped). */
export function offsetConvex(poly: Pt2[], d: number): Pt2[] {
  const n = poly.length;
  const out: Pt2[] = [];
  for (let i = 0; i < n; i++) {
    const prev = poly[(i - 1 + n) % n];
    const cur = poly[i];
    const next = poly[(i + 1) % n];
    const e1 = norm({ x: cur.x - prev.x, y: cur.y - prev.y });
    const e2 = norm({ x: next.x - cur.x, y: next.y - cur.y });
    // CCW polygon: outward normal is (y, -x).
    const n1 = { x: e1.y, y: -e1.x };
    const n2 = { x: e2.y, y: -e2.x };
    const bis = norm({ x: n1.x + n2.x, y: n1.y + n2.y });
    const cos = clamp(bis.x * n1.x + bis.y * n1.y, 0.35, 1);
    const len = d / cos;
    out.push({ x: cur.x + bis.x * len, y: cur.y + bis.y * len });
  }
  return out;
}

function norm(v: Pt2): Pt2 {
  const l = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / l, y: v.y / l };
}

/** Chaikin corner cutting; `closed` keeps the ring closed. */
export function chaikin(pts: Pt2[], iterations = 1, closed = false): Pt2[] {
  let cur = pts;
  for (let k = 0; k < iterations; k++) {
    const out: Pt2[] = [];
    const n = cur.length;
    if (n < 3) return cur;
    if (!closed) out.push(cur[0]);
    const last = closed ? n : n - 1;
    for (let i = 0; i < last; i++) {
      const a = cur[i];
      const b = cur[(i + 1) % n];
      out.push({ x: lerp(a.x, b.x, 0.25), y: lerp(a.y, b.y, 0.25) });
      out.push({ x: lerp(a.x, b.x, 0.75), y: lerp(a.y, b.y, 0.75) });
    }
    if (!closed) out.push(cur[n - 1]);
    cur = out;
  }
  return cur;
}

function pointSegDist(p: Pt2, a: Pt2, b: Pt2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy || 1e-9;
  const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / l2, 0, 1);
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
}

export function simplify(pts: Pt2[], tol: number): Pt2[] {
  if (pts.length <= 2) return pts;
  let maxD = 0;
  let idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = pointSegDist(pts[i], pts[0], pts[pts.length - 1]);
    if (d > maxD) {
      maxD = d;
      idx = i;
    }
  }
  if (maxD <= tol) return [pts[0], pts[pts.length - 1]];
  const left = simplify(pts.slice(0, idx + 1), tol);
  const right = simplify(pts.slice(idx), tol);
  return [...left.slice(0, -1), ...right];
}

/** Axis-aligned rectangle in a local frame: centre c, along unit t, across unit n. */
function rect(c: Pt2, t: Pt2, n: Pt2, halfLen: number, halfDepth: number): Pt2[] {
  return [
    { x: c.x - t.x * halfLen - n.x * halfDepth, y: c.y - t.y * halfLen - n.y * halfDepth },
    { x: c.x + t.x * halfLen - n.x * halfDepth, y: c.y + t.y * halfLen - n.y * halfDepth },
    { x: c.x + t.x * halfLen + n.x * halfDepth, y: c.y + t.y * halfLen + n.y * halfDepth },
    { x: c.x - t.x * halfLen + n.x * halfDepth, y: c.y - t.y * halfLen + n.y * halfDepth },
  ];
}

const centroid = (poly: Pt2[]): Pt2 => ({ x: poly.reduce((s, p) => s + p.x, 0) / poly.length, y: poly.reduce((s, p) => s + p.y, 0) / poly.length });

/* ---------- distance field ---------- */

function makeDistToLoop(loop: Pt2[], every = 1) {
  const pts: Pt2[] = [];
  for (let i = 0; i < loop.length - 1; i += every) pts.push(loop[i]);
  return (p: Pt2): number => {
    let best = Infinity;
    for (const q of pts) {
      const d = (q.x - p.x) ** 2 + (q.y - p.y) ** 2;
      if (d < best) best = d;
    }
    return Math.sqrt(best);
  };
}

/* ---------- grid A* ---------- */

interface Grid {
  cols: number;
  rows: number;
  cell: number;
  origin: Pt2;
  blocked: Uint8Array;
}

function makeGrid(extent: Extent, cell: number, isBlocked: (p: Pt2) => boolean): Grid {
  const cols = Math.ceil((extent.maxX - extent.minX) / cell);
  const rows = Math.ceil((extent.maxY - extent.minY) / cell);
  const blocked = new Uint8Array(cols * rows);
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const p = { x: extent.minX + (i + 0.5) * cell, y: extent.minY + (j + 0.5) * cell };
      blocked[j * cols + i] = isBlocked(p) ? 1 : 0;
    }
  return { cols, rows, cell, origin: { x: extent.minX, y: extent.minY }, blocked };
}

const cellCentre = (g: Grid, i: number, j: number): Pt2 => ({ x: g.origin.x + (i + 0.5) * g.cell, y: g.origin.y + (j + 0.5) * g.cell });
const toCell = (g: Grid, p: Pt2): [number, number] => [clamp(Math.floor((p.x - g.origin.x) / g.cell), 0, g.cols - 1), clamp(Math.floor((p.y - g.origin.y) / g.cell), 0, g.rows - 1)];

const DIRS: [number, number, number][] = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, Math.SQRT2],
  [1, -1, Math.SQRT2],
  [-1, 1, Math.SQRT2],
  [-1, -1, Math.SQRT2],
];

/** Nearest unblocked cell to p (spiral search). */
function freeCellNear(g: Grid, p: Pt2): [number, number] | null {
  const [ci, cj] = toCell(g, p);
  for (let r = 0; r < Math.max(g.cols, g.rows); r++) {
    for (let dj = -r; dj <= r; dj++)
      for (let di = -r; di <= r; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
        const i = ci + di;
        const j = cj + dj;
        if (i < 0 || j < 0 || i >= g.cols || j >= g.rows) continue;
        if (!g.blocked[j * g.cols + i]) return [i, j];
      }
  }
  return null;
}

/** A* over the grid with a turn penalty so routes run straight where they can. Returns cell centres. */
function routeOnGrid(g: Grid, from: Pt2, to: Pt2, turnPenalty = 0.6): Pt2[] | null {
  const s = freeCellNear(g, from);
  const t = freeCellNear(g, to);
  if (!s || !t) return null;
  const N = g.cols * g.rows;
  // State = cell * 9 + (dir + 1); dir 8 = none.
  const key = (i: number, j: number, d: number) => (j * g.cols + i) * 9 + d;
  const gScore = new Float64Array(N * 9).fill(Infinity);
  const came = new Int32Array(N * 9).fill(-1);
  const closed = new Uint8Array(N * 9);
  const h = (i: number, j: number) => Math.hypot(i - t[0], j - t[1]);
  // Binary heap of [f, state].
  const heap: [number, number][] = [];
  const push = (f: number, st: number) => {
    heap.push([f, st]);
    let k = heap.length - 1;
    while (k > 0) {
      const par = (k - 1) >> 1;
      if (heap[par][0] <= heap[k][0]) break;
      [heap[par], heap[k]] = [heap[k], heap[par]];
      k = par;
    }
  };
  const pop = (): [number, number] | undefined => {
    if (heap.length === 0) return undefined;
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let k = 0;
      for (;;) {
        const l = 2 * k + 1;
        const r = l + 1;
        let m = k;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === k) break;
        [heap[m], heap[k]] = [heap[k], heap[m]];
        k = m;
      }
    }
    return top;
  };
  const start = key(s[0], s[1], 8);
  gScore[start] = 0;
  push(h(s[0], s[1]), start);
  let found = -1;
  while (heap.length) {
    const [, st] = pop()!;
    if (closed[st]) continue;
    closed[st] = 1;
    const cellIdx = Math.floor(st / 9);
    const dir = st % 9;
    const i = cellIdx % g.cols;
    const j = Math.floor(cellIdx / g.cols);
    if (i === t[0] && j === t[1]) {
      found = st;
      break;
    }
    for (let d = 0; d < 8; d++) {
      const [di, dj, cost] = DIRS[d];
      const ni = i + di;
      const nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= g.cols || nj >= g.rows) continue;
      if (g.blocked[nj * g.cols + ni]) continue;
      // No corner cutting past blocked cells.
      if (di && dj && (g.blocked[j * g.cols + ni] || g.blocked[nj * g.cols + i])) continue;
      const nk = key(ni, nj, d);
      if (closed[nk]) continue;
      const turn = dir === 8 || dir === d ? 0 : turnPenalty;
      const ng = gScore[st] + cost + turn;
      if (ng < gScore[nk]) {
        gScore[nk] = ng;
        came[nk] = st;
        push(ng + h(ni, nj), nk);
      }
    }
  }
  if (found < 0) return null;
  const out: Pt2[] = [];
  for (let st = found; st >= 0; st = came[st]) {
    const cellIdx = Math.floor(st / 9);
    out.push(cellCentre(g, cellIdx % g.cols, Math.floor(cellIdx / g.cols)));
  }
  return out.reverse();
}


/* ---------- blobs ---------- */

interface Blob {
  centre: Pt2;
  radius: number;
  outline: Pt2[];
  /** Radius of the blob in direction theta. */
  radiusAt: (theta: number) => number;
  inside: (p: Pt2, margin?: number) => boolean;
}

/** A wobbly disc: three low harmonics on a circle. */
function makeBlob(centre: Pt2, radius: number, rng: () => number, wobble = 1, n = 40): Blob {
  const a = [(0.16 + rng() * 0.12) * wobble, (0.07 + rng() * 0.09) * wobble, (0.03 + rng() * 0.05) * wobble];
  const ph = [rng() * Math.PI * 2, rng() * Math.PI * 2, rng() * Math.PI * 2];
  const radiusAt = (t: number) => radius * (1 + a[0] * Math.sin(2 * t + ph[0]) + a[1] * Math.sin(3 * t + ph[1]) + a[2] * Math.sin(5 * t + ph[2]));
  const outline: Pt2[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const r = radiusAt(t);
    outline.push({ x: centre.x + Math.cos(t) * r, y: centre.y + Math.sin(t) * r });
  }
  const inside = (p: Pt2, margin = 0) => Math.hypot(p.x - centre.x, p.y - centre.y) < radiusAt(Math.atan2(p.y - centre.y, p.x - centre.x)) + margin;
  return { centre, radius, outline, radiusAt, inside };
}

/** Rectangles packed along one edge of a block, inside it. */
function buildingsAlongEdge(a: Pt2, b: Pt2, inward: Pt2, k: number, fill: number, rng: () => number, out: Pt2[][]) {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  if (len < 10 * k) return;
  const t = norm({ x: b.x - a.x, y: b.y - a.y });
  let cursor = (1.5 + rng() * 3) * k;
  while (cursor < len - 3 * k) {
    const bl = (6 + rng() * 9) * k;
    if (cursor + bl > len - 1.5 * k) break;
    const depth = (5 + rng() * 5.5) * k;
    if (rng() < fill) {
      const c = { x: a.x + t.x * (cursor + bl / 2) + inward.x * (depth / 2 + 1.2 * k), y: a.y + t.y * (cursor + bl / 2) + inward.y * (depth / 2 + 1.2 * k) };
      out.push(rect(c, t, inward, bl / 2, depth / 2));
    }
    cursor += bl + (1.5 + rng() * 4) * k;
  }
}

/** Buildings along every edge of a convex-ish block (inward = toward the centroid). */
function fillBlock(block: Pt2[], k: number, fill: number, rng: () => number, out: Pt2[][]) {
  const c = centroid(block);
  for (let i = 0; i < block.length; i++) {
    const a = block[i];
    const b = block[(i + 1) % block.length];
    const t = norm({ x: b.x - a.x, y: b.y - a.y });
    let n = { x: -t.y, y: t.x };
    if ((c.x - a.x) * n.x + (c.y - a.y) * n.y < 0) n = { x: -n.x, y: -n.y };
    buildingsAlongEdge(a, b, n, k, fill, rng, out);
  }
}

/** Shrink a polygon toward its centroid by `d`. */
function inset(poly: Pt2[], d: number): Pt2[] {
  const c = centroid(poly);
  return poly.map((p) => {
    const v = norm({ x: c.x - p.x, y: c.y - p.y });
    const dist = Math.hypot(c.x - p.x, c.y - p.y);
    const dd = Math.min(d, dist * 0.45);
    return { x: p.x + v.x * dd, y: p.y + v.y * dd };
  });
}

/* ---------- the map ---------- */

export interface CartographyOptions {
  /** Grid cell for the road router, metres (scaled by unit). */
  routeCell?: number;
  /** Contour interval in metres. */
  contourStep?: number;
}

/** Build the fictional surroundings for a track. Deterministic for (track.name, track.seed). */
export function buildCartography(track: Track, opts: CartographyOptions = {}): Cartography {
  const seed = cartographySeed(track.name, track.seed);
  const rng = mulberry32(seed);
  const loop = track.loop;
  const body = loop.slice(0, -1);
  const lb = bbox(body);
  const w = lb.maxX - lb.minX;
  const hgt = lb.maxY - lb.minY;
  const size = Math.max(w, hgt);
  const k = clamp(size / 1200, 0.6, 2);
  const cx = (lb.minX + lb.maxX) / 2;
  const cy = (lb.minY + lb.maxY) / 2;
  // Taller than wide: the portrait poster shows about 1.7× the loop's width in height, the square one 1.1×.
  const halfX = size * 0.72 + 160 * k;
  const halfY = size * 0.9 + 160 * k;
  const half = Math.max(halfX, halfY);
  const extent: Extent = { minX: cx - halfX, minY: cy - halfY, maxX: cx + halfX, maxY: cy + halfY };
  const inExtent = (p: Pt2) => p.x >= extent.minX && p.x <= extent.maxX && p.y >= extent.minY && p.y <= extent.maxY;
  const clampPt = (p: Pt2): Pt2 => ({ x: clamp(p.x, extent.minX, extent.maxX), y: clamp(p.y, extent.minY, extent.maxY) });
  const distToLoop = makeDistToLoop(loop, 1);
  const distToLoopFast = makeDistToLoop(loop, 3);
  const distToEdge = (p: Pt2) => Math.min(p.x - extent.minX, extent.maxX - p.x, p.y - extent.minY, extent.maxY - p.y);
  const inLoop = (p: Pt2) => pointInPolygon(p, body);
  /** 1 near the circuit, fading to ~0.15 at the far edges: how built-up the countryside gets. */
  const density = (p: Pt2) => clamp(1.15 - distToLoopFast(p) / (0.95 * half), 0.15, 1);

  // Approximate asphalt scale the poster styles draw with (metres per stroke width).
  const m0 = 0.02 * size;
  const asphaltHalf = 0.95 * m0;

  /* Pit complex inside the start/finish straight. */
  const sf = startFinishStraight(track);
  const L = track.length;
  const sfMid = wrapDist(sf.startDist + sf.length / 2, L);
  const sfMidPt = pointAt(loop, sfMid);
  const sfOut = outwardNormal(loop, Math.round(sfMid / (loop[1].dist - loop[0].dist)) % body.length);
  const sfIn = { x: -sfOut.x, y: -sfOut.y };
  const sfA = pointAt(loop, wrapDist(sfMid - sf.length * 0.3, L));
  const sfB = pointAt(loop, wrapDist(sfMid + sf.length * 0.3, L));
  const sfT = norm({ x: sfB.x - sfA.x, y: sfB.y - sfA.y });
  // Room inside the straight before the loop comes back (the letter band).
  let room = Infinity;
  for (const p of body) {
    const along = (p.x - sfMidPt.x) * sfT.x + (p.y - sfMidPt.y) * sfT.y;
    const across = (p.x - sfMidPt.x) * sfIn.x + (p.y - sfMidPt.y) * sfIn.y;
    if (Math.abs(along) < sf.length * 0.32 && across > 3 * m0) room = Math.min(room, across);
  }
  if (!Number.isFinite(room)) room = 8 * m0;
  const laneOff = Math.min(2.3 * m0, room * 0.26);
  const pitLane: Pt2[] = (() => {
    const d0 = sfMid - sf.length * 0.34;
    const d1 = sfMid + sf.length * 0.34;
    const taper = Math.min(45 * k, sf.length * 0.08);
    const at = (d: number, off: number) => {
      const p = pointAt(loop, wrapDist(d, L));
      return { x: p.x + sfIn.x * off, y: p.y + sfIn.y * off };
    };
    return [at(d0, 0), at(d0 + taper, laneOff), at(d1 - taper, laneOff), at(d1, 0)];
  })();
  const bld0 = Math.min(2.8 * m0, room * 0.34);
  const bld1 = Math.min(bld0 + 17 * k, room * 0.5);
  const pitBuilding = rect({ x: sfMidPt.x + sfIn.x * ((bld0 + bld1) / 2), y: sfMidPt.y + sfIn.y * ((bld0 + bld1) / 2) }, sfT, sfIn, sf.length * 0.24, (bld1 - bld0) / 2);
  const paddock: Pt2[][] = [];
  const pad0 = Math.min(bld1 + 10 * k, room * 0.56);
  const pad1 = Math.min(pad0 + 18 * k, room * 0.8);
  if (pad1 - pad0 > 6 * k) {
    const blocks = 3;
    const total = sf.length * 0.44;
    const gap = total * 0.08;
    const bl = (total - gap * (blocks - 1)) / blocks;
    for (let b = 0; b < blocks; b++) {
      const along = -total / 2 + bl / 2 + b * (bl + gap);
      const c = { x: sfMidPt.x + sfT.x * along + sfIn.x * ((pad0 + pad1) / 2), y: sfMidPt.y + sfT.y * along + sfIn.y * ((pad0 + pad1) / 2) };
      paddock.push(rect(c, sfT, sfIn, bl / 2, (pad1 - pad0) / 2));
    }
    // A second row of smaller hospitality units when the band is deep enough.
    const hos0 = pad1 + 8 * k;
    const hos1 = hos0 + 10 * k;
    if (hos1 < room * 0.92) {
      const units = 6;
      const span = sf.length * 0.4;
      const ul = span / units;
      for (let u = 0; u < units; u++) {
        const along = -span / 2 + ul * (u + 0.5);
        const c = { x: sfMidPt.x + sfT.x * along + sfIn.x * ((hos0 + hos1) / 2), y: sfMidPt.y + sfT.y * along + sfIn.y * ((hos0 + hos1) / 2) };
        paddock.push(rect(c, sfT, sfIn, ul * 0.36, (hos1 - hos0) / 2));
      }
    }
  }

  /* Car park outside the start/finish grandstands. */
  const cpNear = 2.8 * m0;
  const cpFar = cpNear + 60 * k;
  const cpHalfLen = sf.length * 0.27;
  const cpCentre = { x: sfMidPt.x + sfOut.x * ((cpNear + cpFar) / 2), y: sfMidPt.y + sfOut.y * ((cpNear + cpFar) / 2) };
  const carPark: CarPark = { outline: rect(cpCentre, sfT, sfOut, cpHalfLen, (cpFar - cpNear) / 2), rows: [] };
  const rowGap = 12 * k;
  for (let off = cpNear + rowGap; off < cpFar - rowGap * 0.5; off += rowGap) {
    const c = { x: sfMidPt.x + sfOut.x * off, y: sfMidPt.y + sfOut.y * off };
    carPark.rows.push([
      { x: c.x - sfT.x * (cpHalfLen - 6 * k), y: c.y - sfT.y * (cpHalfLen - 6 * k) },
      { x: c.x + sfT.x * (cpHalfLen - 6 * k), y: c.y + sfT.y * (cpHalfLen - 6 * k) },
    ]);
  }
  const carParks = [carPark];
  const tunnels: Pt2[][] = [[{ x: cpCentre.x + sfIn.x * (cpFar - cpNear) * 0.5, y: cpCentre.y + sfIn.y * (cpFar - cpNear) * 0.5 }, centroid(pitBuilding)]];

  /* Grandstands and run-off from the shared furniture, plus stands and car parks at the two biggest corners. */
  const stands: Pt2[][] = grandstands(track, { offset: asphaltHalf + 0.55 * m0, depth: 1.0 * m0, block: 7 * m0, gap: 1.6 * m0 }).flatMap((g) => g.blocks);
  const runoffs: Pt2[][] = gravelTraps(track, { edge: asphaltHalf + 0.15 * m0, depth: 2.4 * m0 }).map((g) => g.polygon);
  const gravelCorners = new Set(gravelTraps(track, { edge: asphaltHalf + 0.15 * m0, depth: 2.4 * m0 }).map((g) => g.corner.number));
  const bigCorners = track.corners
    .map((c, i) => ({ c, i, score: Math.abs(c.angleDeg) * (0.5 + Math.min(1, straightBefore(track, i) / 400)) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);
  for (const { c } of bigCorners) {
    const span = c.endDist >= c.startDist ? c.endDist - c.startDist : c.endDist + L - c.startDist;
    const idx = rangeIndices(loop, c.startDist + span * 0.1, c.endDist - span * 0.1);
    if (idx.length < 3) continue;
    const o0 = gravelCorners.has(c.number) ? asphaltHalf + 0.15 * m0 + 2.4 * m0 + 0.35 * m0 : asphaltHalf + 0.9 * m0;
    const o1 = o0 + 1.1 * m0;
    const front: Pt2[] = [];
    const back: Pt2[] = [];
    for (const i of idx) {
      const n = insideNormal(loop, i, c.direction);
      const o = { x: -n.x, y: -n.y };
      front.push({ x: loop[i].x + o.x * o0, y: loop[i].y + o.y * o0 });
      back.push({ x: loop[i].x + o.x * o1, y: loop[i].y + o.y * o1 });
    }
    // Only where the stand does not run into another part of the lap.
    if (back.some((p) => distToLoop(p) < o1 - 0.3 * m0)) continue;
    stands.push([...front, ...back.reverse()]);
    // Car park behind the stand, square to the apex tangent.
    const ai = c.index;
    const n = insideNormal(loop, ai, c.direction);
    const o = { x: -n.x, y: -n.y };
    const t = { x: -o.y, y: o.x };
    const pNear = o1 + 0.9 * m0;
    const pFar = pNear + 2.2 * m0;
    const halfLen = Math.min(span * 0.5, 4 * m0);
    const centre = { x: c.apex.x + o.x * ((pNear + pFar) / 2), y: c.apex.y + o.y * ((pNear + pFar) / 2) };
    const outline = rect(centre, t, o, halfLen, (pFar - pNear) / 2);
    if (outline.some((p) => distToLoop(p) < pNear - 0.3 * m0 || !inExtent(p))) continue;
    const rows: Pt2[][] = [];
    for (let off = pNear + rowGap; off < pFar - rowGap * 0.4; off += rowGap) {
      const rc = { x: c.apex.x + o.x * off, y: c.apex.y + o.y * off };
      rows.push([
        { x: rc.x - t.x * (halfLen - 4 * k), y: rc.y - t.y * (halfLen - 4 * k) },
        { x: rc.x + t.x * (halfLen - 4 * k), y: rc.y + t.y * (halfLen - 4 * k) },
      ]);
    }
    carParks.push({ outline, rows });
  }

  /* Perimeter road: the loop's hull pushed out past the car parks, rounded. */
  const furthest = Math.max(cpFar + 28 * k, ...carParks.slice(1).flatMap((p) => p.outline).map((p) => distToLoop(p) + 20 * k));
  const perimOff = Math.max(95 * k, furthest);
  const hull = convexHull(body);
  const perimeter = chaikin(offsetConvex(hull, perimOff), 2, true);
  const roads: Road[] = [{ pts: [...perimeter, perimeter[0]], kind: "perimeter" }];

  /* Overflow parking in the ring between the lap and the perimeter road, at hull corners away from the pits. */
  {
    const ring = offsetConvex(hull, perimOff * 0.55);
    const cands = ring
      .map((p, i) => ({ p, i }))
      .filter(({ p }) => Math.hypot(p.x - cpCentre.x, p.y - cpCentre.y) > sf.length * 0.5 && carParks.every((cp) => Math.hypot(p.x - centroid(cp.outline).x, p.y - centroid(cp.outline).y) > 5 * m0))
      .sort((a, b) => distToLoop(b.p) - distToLoop(a.p));
    let placed = 0;
    for (const { p, i } of cands) {
      if (placed >= 3) break;
      const prev = ring[(i - 1 + ring.length) % ring.length];
      const next = ring[(i + 1) % ring.length];
      const t = norm({ x: next.x - prev.x, y: next.y - prev.y });
      const nn = { x: -t.y, y: t.x };
      const halfLen = (2.2 + rng() * 1.6) * m0;
      const halfDepth = (0.9 + rng() * 0.5) * m0;
      const outline = rect(p, t, nn, halfLen, halfDepth);
      if (outline.some((q) => distToLoop(q) < 2.1 * m0 || distToLoop(q) > perimOff - 12 * k)) continue;
      if (carParks.some((cp) => Math.hypot(p.x - centroid(cp.outline).x, p.y - centroid(cp.outline).y) < halfLen + 3 * m0)) continue;
      const rows: Pt2[][] = [];
      for (let off = -halfDepth + rowGap; off < halfDepth - rowGap * 0.4; off += rowGap) {
        const rc = { x: p.x + nn.x * off, y: p.y + nn.y * off };
        rows.push([
          { x: rc.x - t.x * (halfLen - 4 * k), y: rc.y - t.y * (halfLen - 4 * k) },
          { x: rc.x + t.x * (halfLen - 4 * k), y: rc.y + t.y * (halfLen - 4 * k) },
        ]);
      }
      carParks.push({ outline, rows });
      placed++;
    }
  }

  /* Circuit buildings in the ring: medical centre, marshal huts, race control, scattered along the inside of the perimeter road. */
  const buildings: Pt2[][] = [];
  {
    const n = 6 + Math.floor(rng() * 5);
    for (let q = 0; q < n; q++) {
      const i = Math.floor(rng() * perimeter.length);
      const p = perimeter[i];
      const nxt = perimeter[(i + 1) % perimeter.length];
      const t = norm({ x: nxt.x - p.x, y: nxt.y - p.y });
      const inward = norm({ x: cx - p.x, y: cy - p.y });
      const off = (12 + rng() * 30) * k;
      const c = { x: p.x + inward.x * off + t.x * (rng() - 0.5) * 30 * k, y: p.y + inward.y * off + t.y * (rng() - 0.5) * 30 * k };
      if (distToLoop(c) < 2.4 * m0 || Math.hypot(c.x - cpCentre.x, c.y - cpCentre.y) < sf.length * 0.35) continue;
      if (carParks.some((cp) => Math.hypot(c.x - centroid(cp.outline).x, c.y - centroid(cp.outline).y) < 3 * m0)) continue;
      buildings.push(rect(c, t, inward, (7 + rng() * 10) * k, (5 + rng() * 6) * k));
    }
  }

  /* Water: a river across the sheet (usually) or a lake, in the largest void. */
  let water: Water | null = null;
  {
    let best: Pt2 | null = null;
    let bestD = 0;
    let bestScore = 0;
    const step = 40 * k;
    // A seeded preferred direction so the water does not always settle in the same corner of the map.
    const theta = rng() * Math.PI * 2;
    for (let y = extent.minY + step; y < extent.maxY; y += step)
      for (let x = extent.minX + step; x < extent.maxX; x += step) {
        const p = { x, y };
        const d = Math.min(distToLoopFast(p) - perimOff, distToEdge(p) * 0.9);
        const score = d * (1 + 0.4 * Math.cos(Math.atan2(y - cy, x - cx) - theta));
        if (score > bestScore) {
          bestScore = score;
          bestD = d;
          best = p;
        }
      }
    if (best && bestD > 60 * k) {
      if (rng() < 0.25) {
        const R = clamp(bestD * 0.6, 60 * k, 320 * k);
        const b = makeBlob(best, R, rng, 1.2, 56);
        water = { kind: "lake", polygon: chaikin(b.outline, 1, true).map(clampPt), centre: best, radius: R };
      } else {
        const g = makeGrid(extent, 30 * k, (p) => distToLoopFast(p) < perimOff + 25 * k);
        const horizontal = Math.abs(best.y - cy) > Math.abs(best.x - cx) ? true : rng() < 0.5;
        const a = horizontal ? { x: extent.minX, y: best.y + (rng() - 0.5) * half * 0.6 } : { x: best.x + (rng() - 0.5) * half * 0.6, y: extent.minY };
        const b = horizontal ? { x: extent.maxX, y: best.y + (rng() - 0.5) * half * 0.6 } : { x: best.x + (rng() - 0.5) * half * 0.6, y: extent.maxY };
        const p1 = routeOnGrid(g, a, best, 0.15);
        const p2 = routeOnGrid(g, best, b, 0.15);
        if (p1 && p2) {
          // Meander: push every other vertex sideways before smoothing so the river bends like one.
          const spine = simplify([...p1, ...p2.slice(1)], 20 * k);
          const bent = spine.map((p, i) => {
            if (i === 0 || i === spine.length - 1) return p;
            const t = norm({ x: spine[i + 1].x - spine[i - 1].x, y: spine[i + 1].y - spine[i - 1].y });
            const amp = (i % 2 === 0 ? 1 : -1) * (25 + rng() * 30) * k;
            return { x: p.x - t.y * amp, y: p.y + t.x * amp };
          });
          const pts = chaikin(bent, 3).map(clampPt);
          if (!polylinesCross(pts, loop)) water = { kind: "river", pts, width: (18 + rng() * 14) * k };
          else water = { kind: "river", pts: chaikin(spine, 3).map(clampPt), width: (18 + rng() * 14) * k };
        }
      }
    }
  }
  const ponds: Water[] = [];
  const nearWater = (p: Pt2, margin: number): boolean => {
    for (const wtr of [water, ...ponds]) {
      if (!wtr) continue;
      if (wtr.kind === "lake") {
        if (Math.hypot(p.x - wtr.centre.x, p.y - wtr.centre.y) < wtr.radius * 1.3 + margin) return true;
      } else {
        for (let i = 0; i + 1 < wtr.pts.length; i++) if (pointSegDist(p, wtr.pts[i], wtr.pts[i + 1]) < wtr.width / 2 + margin) return true;
      }
    }
    return false;
  };
  {
    const want = 1 + Math.floor(rng() * 3);
    const step = 45 * k;
    const cands: { p: Pt2; d: number }[] = [];
    for (let y = extent.minY + step; y < extent.maxY; y += step)
      for (let x = extent.minX + step; x < extent.maxX; x += step) {
        const p = { x, y };
        const d = Math.min(distToLoopFast(p) - perimOff - 25 * k, distToEdge(p) - 15 * k);
        if (d > 40 * k && !nearWater(p, 70 * k)) cands.push({ p, d });
      }
    for (let i = 0; i < want && cands.length; i++) {
      const pick = cands[Math.floor(rng() * cands.length)];
      const R = clamp(pick.d * 0.45, 22 * k, 60 * k);
      const b = makeBlob(pick.p, R, rng, 1.1, 28);
      ponds.push({ kind: "lake", polygon: b.outline.map(clampPt), centre: pick.p, radius: R });
      for (let j = cands.length - 1; j >= 0; j--) if (Math.hypot(cands[j].p.x - pick.p.x, cands[j].p.y - pick.p.y) < R * 2 + 120 * k) cands.splice(j, 1);
    }
  }

  /* Settlements: a town and one or two villages in the voids, away from water and the circuit. */
  const blobs: Blob[] = [];
  const settlements: Settlement[] = [];
  const inSettlement = (p: Pt2, margin = 0) => blobs.some((b) => b.inside(p, margin));
  {
    const wanted = [
      { R: (175 + rng() * 55) * k, plan: rng() < 0.6 ? "grid" : "organic" },
      { R: (115 + rng() * 45) * k, plan: rng() < 0.5 ? "grid" : "organic" },
      { R: (95 + rng() * 40) * k, plan: rng() < 0.5 ? "grid" : "organic" },
    ] as const;
    const step = 35 * k;
    const theta = rng() * Math.PI * 2;
    for (const wnt of wanted) {
      let best: Pt2 | null = null;
      let bestScore = 0;
      for (let y = extent.minY + step; y < extent.maxY; y += step)
        for (let x = extent.minX + step; x < extent.maxX; x += step) {
          const p = { x, y };
          const toLoop = distToLoopFast(p) - perimOff - wnt.R * 0.85;
          const toEdge = distToEdge(p) - wnt.R - 30 * k;
          let toOther = Infinity;
          for (const b of blobs) toOther = Math.min(toOther, Math.hypot(p.x - b.centre.x, p.y - b.centre.y) - b.radius - wnt.R - 60 * k);
          let s = Math.min(toLoop, toEdge, toOther);
          if (s <= 0 || nearWater(p, wnt.R * 0.9)) continue;
          // Prefer sitting above or below the circuit (the portrait sheet is tall) and a seeded direction.
          const dir = Math.atan2(y - cy, x - cx);
          // The first settlement follows a seeded direction; the next ones prefer the other side of the circuit.
          const lean = blobs.length === 0 ? theta : Math.atan2(cy - blobs[blobs.length - 1].centre.y, cx - blobs[blobs.length - 1].centre.x);
          s = Math.min(s, 220 * k) * (1 + 0.35 * Math.cos(dir - lean)) - Math.max(0, Math.abs(x - cx) - halfX * 0.72) * 0.6;
          if (s > bestScore) {
            bestScore = s;
            best = p;
          }
        }
      if (!best) continue;
      const b = makeBlob(best, wnt.R, rng, 1, 48);
      blobs.push(b);
      settlements.push({ centre: best, radius: wnt.R, outline: b.outline, blocks: [], plan: wnt.plan });
    }
  }

  /* Highways: two or three curving across the sheet, skirting the circuit, towns and lakes. */
  const lakes = [water, ...ponds].filter((x): x is Extract<Water, { kind: "lake" }> => x !== null && x.kind === "lake");
  const routeBlocked = (p: Pt2, loopMargin: number, townMargin: number) =>
    distToLoopFast(p) < perimOff + loopMargin || inSettlement(p, townMargin) || lakes.some((l) => Math.hypot(p.x - l.centre.x, p.y - l.centre.y) < l.radius * 1.15 + 15 * k);
  const highways: Road[] = [];
  {
    const cell = 32 * k;
    const g = makeGrid(extent, cell, (p) => routeBlocked(p, 45 * k, 25 * k));
    const edgePt = (edge: 0 | 1 | 2 | 3, t: number): Pt2 =>
      edge === 0 ? { x: extent.minX, y: lerp(extent.minY, extent.maxY, t) } : edge === 1 ? { x: extent.maxX, y: lerp(extent.minY, extent.maxY, t) } : edge === 2 ? { x: lerp(extent.minX, extent.maxX, t), y: extent.minY } : { x: lerp(extent.minX, extent.maxX, t), y: extent.maxY };
    const sideRoom = (p: Pt2) => distToLoopFast(p);
    // First: left to right, on whichever side of the loop has more room. Second: top to bottom. Third: a diagonal.
    const above = sideRoom({ x: cx, y: cy + halfY * 0.55 }) > sideRoom({ x: cx, y: cy - halfY * 0.55 });
    const ty = above ? 0.62 + rng() * 0.25 : 0.13 + rng() * 0.25;
    const plans: [Pt2, Pt2][] = [
      [edgePt(0, ty + (rng() - 0.5) * 0.2), edgePt(1, ty + (rng() - 0.5) * 0.2)],
      [edgePt(2, rng() < 0.5 ? 0.1 + rng() * 0.2 : 0.7 + rng() * 0.2), edgePt(3, rng() < 0.5 ? 0.1 + rng() * 0.2 : 0.7 + rng() * 0.2)],
    ];
    if (rng() < 0.65) plans.push([edgePt(above ? 3 : 2, 0.05 + rng() * 0.3), edgePt(rng() < 0.5 ? 0 : 1, above ? 0.3 + rng() * 0.3 : 0.4 + rng() * 0.3)]);
    for (const [a, b] of plans) {
      const route = routeOnGrid(g, a, b, 0.5);
      if (!route || route.length < 3) continue;
      const pts = chaikin(simplify(route, 24 * k), 2).map(clampPt);
      pts[0] = clampPt(a);
      pts[pts.length - 1] = clampPt(b);
      if (polylinesCross(pts, loop)) continue;
      highways.push({ pts, kind: "highway" });
    }
    roads.push(...highways);
  }

  /* Arterials: each settlement to the perimeter road and to the nearest highway; access roads from the edges. */
  {
    const cell = (opts.routeCell ?? 25) * k;
    const g = makeGrid(extent, cell, (p) => distToLoop(p) < perimOff - 10 * k || lakes.some((l) => Math.hypot(p.x - l.centre.x, p.y - l.centre.y) < l.radius * 1.25 + 20 * k));
    const nearestOn = (pts: Pt2[], p: Pt2): Pt2 => pts.reduce((b, q) => (Math.hypot(q.x - p.x, q.y - p.y) < Math.hypot(b.x - p.x, b.y - p.y) ? q : b), pts[0]);
    const addRoute = (from: Pt2, to: Pt2, kind: RoadKind, tol = 12 * k) => {
      const route = routeOnGrid(g, from, to);
      if (!route || route.length < 2) return;
      const pts = chaikin(simplify(route, tol), 1).map(clampPt);
      pts[0] = clampPt(from);
      pts[pts.length - 1] = clampPt(to);
      if (polylinesCross(pts, loop)) return;
      roads.push({ pts, kind });
    };
    const edgePoint = (dir: Pt2, around: Pt2, jitter: number): Pt2 => {
      // Walk from `around` in direction `dir` to the extent edge, then slide along it a little.
      const tx = dir.x > 0 ? (extent.maxX - around.x) / dir.x : dir.x < 0 ? (extent.minX - around.x) / dir.x : Infinity;
      const ty = dir.y > 0 ? (extent.maxY - around.y) / dir.y : dir.y < 0 ? (extent.minY - around.y) / dir.y : Infinity;
      const t = Math.min(tx, ty);
      const p = { x: around.x + dir.x * t, y: around.y + dir.y * t };
      const slide = (rng() - 0.5) * 2 * jitter;
      return clampPt(tx < ty ? { x: p.x, y: p.y + slide } : { x: p.x + slide, y: p.y });
    };
    const addAccess = (dir: Pt2, around: Pt2) => {
      const target = nearestOn(perimeter, { x: around.x + dir.x * perimOff, y: around.y + dir.y * perimOff });
      addRoute(edgePoint(dir, target, half * 0.35), target, "access");
    };
    addAccess(sfOut, sfMidPt);
    // A far corner: the apex farthest from the pit straight.
    let far = track.corners[0];
    let farD = -1;
    for (const c of track.corners) {
      const d = Math.hypot(c.apex.x - sfMidPt.x, c.apex.y - sfMidPt.y);
      if (d > farD) {
        farD = d;
        far = c;
      }
    }
    if (far) {
      const n = outwardNormal(loop, far.index);
      // Lean the direction away from the pit side so the two roads leave on different edges.
      const dir = norm({ x: n.x - sfOut.x * 0.4, y: n.y - sfOut.y * 0.4 });
      addAccess(dir, far.apex);
    }
    const highwayPts = highways.flatMap((h) => h.pts);
    for (const s of settlements) {
      addRoute(s.centre, nearestOn(perimeter, s.centre), "arterial");
      if (highwayPts.length) {
        const hp = nearestOn(highwayPts, s.centre);
        if (Math.hypot(hp.x - s.centre.x, hp.y - s.centre.y) > 30 * k) addRoute(s.centre, hp, "arterial");
      }
    }
  }

  /* Streets, blocks and buildings inside each settlement. */
  settlements.forEach((s, si) => {
    const b = blobs[si];
    const R = s.radius;
    const free = (p: Pt2) => b.inside(p) && distToLoopFast(p) > perimOff + 8 * k && !nearWater(p, 8 * k) && inExtent(p);
    const townFill = (p: Pt2) => clamp(0.98 - 0.45 * (Math.hypot(p.x - s.centre.x, p.y - s.centre.y) / R) ** 2, 0.3, 1) * clamp(0.55 + density(p) * 0.6, 0.5, 1);
    if (s.plan === "grid") {
      const sp = (si === 0 ? 30 + rng() * 10 : 24 + rng() * 7) * k;
      const ang = rng() * Math.PI;
      const u = { x: Math.cos(ang), y: Math.sin(ang) };
      const v = { x: -u.y, y: u.x };
      const N = Math.ceil((1.3 * R) / sp);
      const offsets = (): number[] => {
        const out: number[] = [];
        for (let i = -N; i <= N; i++) if (rng() > 0.1) out.push(i * sp + (rng() - 0.5) * sp * 0.22);
        return out;
      };
      const offU = offsets();
      const offV = offsets();
      const at = (ou: number, ov: number): Pt2 => ({ x: s.centre.x + u.x * ou + v.x * ov, y: s.centre.y + u.y * ou + v.y * ov });
      // Street lines clipped to the blob: contiguous free runs along each line.
      const emit = (fixed: number, alongU: boolean) => {
        let run: Pt2[] = [];
        const flush = () => {
          if (run.length >= 2 && Math.hypot(run[0].x - run[run.length - 1].x, run[0].y - run[run.length - 1].y) > sp * 1.2) roads.push({ pts: [run[0], run[run.length - 1]], kind: "street" });
          run = [];
        };
        for (let t = -1.3 * R; t <= 1.3 * R; t += 5 * k) {
          const p = alongU ? at(t, fixed) : at(fixed, t);
          if (free(p)) run.push(p);
          else flush();
        }
        flush();
      };
      for (const ov of offV) emit(ov, true);
      for (const ou of offU) emit(ou, false);
      for (let i = 0; i + 1 < offU.length; i++)
        for (let j = 0; j + 1 < offV.length; j++) {
          const quad = [at(offU[i], offV[j]), at(offU[i + 1], offV[j]), at(offU[i + 1], offV[j + 1]), at(offU[i], offV[j + 1])];
          if (!quad.every(free)) continue;
          const block = inset(quad, 2.5 * k);
          s.blocks.push(block);
          fillBlock(block, k, townFill(centroid(block)), rng, buildings);
        }
    } else {
      const sp = (si === 0 ? 32 + rng() * 8 : 26 + rng() * 6) * k;
      const rings = Math.max(2, Math.floor(R / sp));
      const spokes = 5 + Math.floor(rng() * 4);
      const angles: number[] = [];
      for (let m = 0; m < spokes; m++) angles.push((m / spokes) * Math.PI * 2 + (rng() - 0.5) * (Math.PI / spokes) * 0.8);
      const ringR = (j: number) => (j + 1) * sp * (1 + (rng() - 0.5) * 0.08);
      const radii = Array.from({ length: rings }, (_, j) => ringR(j));
      const at = (r: number, t: number): Pt2 => ({ x: s.centre.x + Math.cos(t) * r * (b.radiusAt(t) / R), y: s.centre.y + Math.sin(t) * r * (b.radiusAt(t) / R) });
      const arc = (r: number, t0: number, t1: number): Pt2[] => {
        const n = Math.max(2, Math.ceil(((t1 - t0) * r) / (14 * k)));
        const out: Pt2[] = [];
        for (let i = 0; i <= n; i++) out.push(at(r, lerp(t0, t1, i / n)));
        return out;
      };
      // Ring streets (broken where the ground is not free) and spokes.
      for (const r of radii) {
        let run: Pt2[] = [];
        const flush = () => {
          if (run.length >= 3) roads.push({ pts: run, kind: "street" });
          run = [];
        };
        const n = Math.ceil((Math.PI * 2 * r) / (12 * k));
        for (let i = 0; i <= n; i++) {
          const p = at(r, (i / n) * Math.PI * 2);
          if (free(p)) run.push(p);
          else flush();
        }
        flush();
      }
      for (const t of angles) {
        const run: Pt2[] = [];
        for (let r = sp * 0.3; r <= radii[radii.length - 1] + sp * 0.4; r += 6 * k) {
          const p = at(r, t);
          if (!free(p)) break;
          run.push(p);
        }
        if (run.length >= 2) roads.push({ pts: [run[0], run[run.length - 1]], kind: "street" });
      }
      for (let j = 0; j + 1 < radii.length; j++)
        for (let m = 0; m < spokes; m++) {
          const t0 = angles[m];
          const t1 = m + 1 < spokes ? angles[m + 1] : angles[0] + Math.PI * 2;
          const sector = [...arc(radii[j], t0, t1), ...arc(radii[j + 1], t0, t1).reverse()];
          if (!sector.every(free)) continue;
          const block = inset(sector, 2.5 * k);
          s.blocks.push(block);
          fillBlock(block, k, townFill(centroid(block)), rng, buildings);
        }
      // The core block around the centre.
      const core = arc(radii[0], 0, Math.PI * 2);
      if (core.every(free)) {
        const block = inset(core, 2.5 * k);
        s.blocks.push(block);
        fillBlock(block, k, 1, rng, buildings);
      }
    }
  });

  /* Frontage along the bigger roads, thinning with distance from the circuit; farmsteads later with the fields. */
  for (const road of roads) {
    if (road.kind === "street" || road.kind === "perimeter" || road.kind === "service") continue;
    let carry = (20 + rng() * 40) * k;
    for (let i = 0; i + 1 < road.pts.length; i++) {
      const a = road.pts[i];
      const bq = road.pts[i + 1];
      const segLen = Math.hypot(bq.x - a.x, bq.y - a.y);
      const t = norm({ x: bq.x - a.x, y: bq.y - a.y });
      const nn = { x: -t.y, y: t.x };
      while (carry < segLen) {
        const p = { x: a.x + t.x * carry, y: a.y + t.y * carry };
        carry += (34 + rng() * 50) * k;
        const pd = density(p) * (road.kind === "highway" ? 0.35 : 0.6);
        if (rng() > pd) continue;
        if (inSettlement(p, 10 * k) || distToLoop(p) < perimOff + 22 * k || distToEdge(p) < 18 * k || nearWater(p, 22 * k)) continue;
        const side = rng() < 0.5 ? -1 : 1;
        const count = 1 + (rng() < 0.4 ? 1 : 0);
        for (let q = 0; q < count; q++) {
          const off = side * ((road.kind === "highway" ? 22 : 13) + rng() * 10) * k;
          const along = (q - (count - 1) / 2) * 16 * k;
          const c = { x: p.x + t.x * along + nn.x * off, y: p.y + t.y * along + nn.y * off };
          if (!inExtent(c) || distToLoop(c) < perimOff + 12 * k) continue;
          buildings.push(rect(c, t, nn, (5 + rng() * 7) * k, (4.5 + rng() * 4.5) * k));
        }
      }
      carry -= segLen;
    }
  }

  /* Woodland patches in the countryside. */
  const woods: Pt2[][] = [];
  const woodBlobs: Blob[] = [];
  {
    const want = 4 + Math.floor(rng() * 4);
    const step = 40 * k;
    for (let attempt = 0; attempt < want * 12 && woods.length < want; attempt++) {
      const p = { x: lerp(extent.minX + step, extent.maxX - step, rng()), y: lerp(extent.minY + step, extent.maxY - step, rng()) };
      const R = (70 + rng() * 110) * k;
      if (distToLoopFast(p) < perimOff + R * 0.7 + 20 * k) continue;
      if (inSettlement(p, R * 0.9) || nearWater(p, R * 0.6)) continue;
      if (woodBlobs.some((b) => Math.hypot(b.centre.x - p.x, b.centre.y - p.y) < b.radius + R + 40 * k)) continue;
      const b = makeBlob(p, R, rng, 1.5, 36);
      woodBlobs.push(b);
      woods.push(b.outline.map(clampPt));
    }
  }
  const inWood = (p: Pt2, margin = 0) => woodBlobs.some((b) => b.inside(p, margin));

  /* Fields: jittered grid cells split into parcel strips, clipped away from everything built. */
  const fields: FieldCell[] = [];
  {
    const cell = 150 * k;
    // Low-frequency noise leaves a few open commons between the farmed areas.
    const ph = [rng() * Math.PI * 2, rng() * Math.PI * 2, rng() * Math.PI * 2];
    const lam = [half * (0.55 + rng() * 0.3), half * (0.5 + rng() * 0.3), half * (0.8 + rng() * 0.4)];
    const cluster = (p: Pt2) => 0.6 * Math.sin(p.x / lam[0] + ph[0]) * Math.cos(p.y / lam[1] + ph[1]) + 0.4 * Math.sin((p.x + p.y) / lam[2] + ph[2]);
    const cols = Math.ceil((extent.maxX - extent.minX) / cell) + 1;
    const rows = Math.ceil((extent.maxY - extent.minY) / cell) + 1;
    const verts: Pt2[] = [];
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        verts.push(clampPt({ x: extent.minX + i * cell + (rng() - 0.5) * cell * 0.4, y: extent.minY + j * cell + (rng() - 0.5) * cell * 0.4 }));
      }
    const v = (i: number, j: number) => verts[j * cols + i];
    const occupied = [...carParks.map((c) => c.outline), pitBuilding, ...paddock, ...stands].map((poly) => ({ c: centroid(poly), r: Math.max(...poly.map((p) => Math.hypot(p.x - centroid(poly).x, p.y - centroid(poly).y))) }));
    const clearance = 34 * k;
    const crossedBy = (quad: Pt2[]) => {
      const qb = bbox(quad);
      for (let si = 0; si < body.length; si += 2) {
        const p = body[si];
        if (p.x < qb.minX || p.x > qb.maxX || p.y < qb.minY || p.y > qb.maxY) continue;
        if (pointInPolygon(p, quad)) return true;
      }
      return false;
    };
    const farm = (quad: Pt2[], c: Pt2, angle: number) => {
      if (rng() >= 0.1 * density(c) + 0.03 || distToEdge(c) < 40 * k) return;
      const corner = quad[Math.floor(rng() * 4)];
      const fc = { x: lerp(corner.x, c.x, 0.2), y: lerp(corner.y, c.y, 0.2) };
      if (distToLoop(fc) <= perimOff + 30 * k || nearWater(fc, 25 * k) || inSettlement(fc, 20 * k)) return;
      const t = norm({ x: Math.cos(angle * 0.0174533), y: Math.sin(angle * 0.0174533) });
      const nn = { x: -t.y, y: t.x };
      const n = 2 + Math.floor(rng() * 2);
      for (let q = 0; q < n; q++) {
        const cc = { x: fc.x + t.x * ((q - 1) * 14 * k) + nn.x * (rng() - 0.5) * 16 * k, y: fc.y + t.y * ((q - 1) * 14 * k) + nn.y * (rng() - 0.5) * 16 * k };
        if (inExtent(cc)) buildings.push(rect(cc, t, nn, (5 + rng() * 7) * k, (4 + rng() * 4) * k));
      }
    };
    /** Try a cell; near the lap, split it in four and try the quarters so parcels run right up to the circuit. */
    const place = (quad: Pt2[], depth: number) => {
      const c = centroid(quad);
      const kindRoll = rng();
      const angle = [0, 30, 60, 90, 120, 150][Math.floor(rng() * 6)];
      const strips = depth === 0 ? 1 + Math.floor(rng() * 3) : 1 + Math.floor(rng() * 2);
      const alongX = rng() < 0.5;
      const tooClose = quad.some((p) => distToLoop(p) < clearance) || distToLoop(c) < clearance * 1.5;
      const blocked =
        tooClose ||
        crossedBy(quad) ||
        occupied.some((o) => Math.hypot(o.c.x - c.x, o.c.y - c.y) < o.r + Math.hypot(quad[0].x - c.x, quad[0].y - c.y) * 0.9) ||
        inSettlement(c, cell * 0.25) ||
        quad.some((p) => inSettlement(p, 8 * k)) ||
        nearWater(c, 20 * k) ||
        (water?.kind === "lake" && quad.some((p) => pointInPolygon(p, water!.polygon))) ||
        inWood(c, 10 * k);
      if (blocked) {
        if (depth < 2 && (tooClose || crossedBy(quad))) {
          // Split and retry the quarters: the lap only blocks the parcels it actually passes through.
          const m01 = { x: (quad[0].x + quad[1].x) / 2, y: (quad[0].y + quad[1].y) / 2 };
          const m12 = { x: (quad[1].x + quad[2].x) / 2, y: (quad[1].y + quad[2].y) / 2 };
          const m23 = { x: (quad[2].x + quad[3].x) / 2, y: (quad[2].y + quad[3].y) / 2 };
          const m30 = { x: (quad[3].x + quad[0].x) / 2, y: (quad[3].y + quad[0].y) / 2 };
          for (const q of [
            [quad[0], m01, c, m30],
            [m01, quad[1], m12, c],
            [c, m12, quad[2], m23],
            [m30, c, m23, quad[3]],
          ])
            place(q, depth + 1);
        }
        return;
      }
      // Parcels: strips across the cell, each with its own hatch.
      const A = quad[0];
      const B = alongX ? quad[1] : quad[3];
      const D = alongX ? quad[3] : quad[1];
      const Cq = quad[2];
      for (let st = 0; st < strips; st++) {
        const t0 = st / strips;
        const t1 = (st + 1) / strips;
        const poly = [
          { x: lerp(A.x, B.x, t0), y: lerp(A.y, B.y, t0) },
          { x: lerp(A.x, B.x, t1), y: lerp(A.y, B.y, t1) },
          { x: lerp(D.x, Cq.x, t1), y: lerp(D.y, Cq.y, t1) },
          { x: lerp(D.x, Cq.x, t0), y: lerp(D.y, Cq.y, t0) },
        ];
        const pc = centroid(poly);
        if (inWood(pc) || inSettlement(pc) || nearWater(pc, 10 * k)) continue;
        const roll = (kindRoll + st * 0.37) % 1;
        const kind: FieldKind = roll < 0.34 ? "hatch" : roll < 0.52 ? "rows" : roll < 0.6 ? "cross" : roll < 0.7 ? "orchard" : "plain";
        fields.push({ polygon: inset(poly, 4 * k), kind, angle: (angle + (st % 2) * 90) % 180 });
      }
      if (depth === 0) farm(quad, c, angle);
    };
    for (let j = 0; j + 1 < rows; j++)
      for (let i = 0; i + 1 < cols; i++) {
        const quad = [v(i, j), v(i + 1, j), v(i + 1, j + 1), v(i, j + 1)];
        if (cluster(centroid(quad)) < -0.5) continue;
        place(quad, 0);
      }
  }

  /* Service roads inside the loop: paddock to the inside of the two biggest corners. */
  {
    const cell = Math.max(6 * k, 0.45 * m0);
    const g = makeGrid({ minX: lb.minX, minY: lb.minY, maxX: lb.maxX, maxY: lb.maxY }, cell, (p) => !inLoop(p) || distToLoop(p) < 1.45 * m0);
    const start = paddock.length ? centroid(paddock[Math.floor(paddock.length / 2)]) : { x: sfMidPt.x + sfIn.x * room * 0.6, y: sfMidPt.y + sfIn.y * room * 0.6 };
    for (const { c } of bigCorners) {
      const n = insideNormal(loop, c.index, c.direction);
      const target = { x: c.apex.x + n.x * 2.4 * m0, y: c.apex.y + n.y * 2.4 * m0 };
      if (!inLoop(target)) continue;
      const route = routeOnGrid(g, start, target, 0.8);
      if (!route || route.length < 3) continue;
      const pts = chaikin(simplify(route, 0.5 * m0), 1);
      if (polylinesCross(pts, loop) || pts.some((p) => distToLoop(p) < 1.1 * m0)) continue;
      roads.push({ pts, kind: "service" });
    }
  }

  /* Contours from the loop's own elevation, blended into gentle seeded hills further out. */
  const contours: Contour[] = [];
  {
    const zs = body.map((p) => p.z);
    const zMean = zs.reduce((s, z) => s + z, 0) / zs.length;
    const zRange = Math.max(...zs) - Math.min(...zs);
    const samples: { x: number; y: number; z: number }[] = [];
    for (let i = 0; i < body.length; i += 4) samples.push(body[i]);
    const bumps = Array.from({ length: 4 }, () => {
      const ang = rng() * Math.PI * 2;
      const r = half * (0.45 + rng() * 0.45);
      return { x: cx + Math.cos(ang) * r, y: cy + Math.sin(ang) * r, amp: (rng() < 0.5 ? -1 : 1) * (8 + rng() * 16) * Math.max(0.5, zRange / 30), sigma: half * (0.25 + rng() * 0.3) };
    });
    const falloff = 170 * k;
    const z = (p: Pt2): number => {
      let num = 0;
      let den = 0;
      for (const s of samples) {
        const d2 = (s.x - p.x) ** 2 + (s.y - p.y) ** 2 + 25;
        const wgt = 1 / (d2 * d2);
        num += wgt * s.z;
        den += wgt;
      }
      const idw = num / den;
      const d = distToLoopFast(p);
      const w = Math.exp(-((d / falloff) ** 2));
      let hills = zMean;
      for (const b of bumps) hills += b.amp * Math.exp(-((p.x - b.x) ** 2 + (p.y - b.y) ** 2) / (2 * b.sigma ** 2));
      return w * idw + (1 - w) * hills;
    };
    const n = 72;
    const dx = (extent.maxX - extent.minX) / n;
    const dy = (extent.maxY - extent.minY) / n;
    const field = new Float64Array((n + 1) * (n + 1));
    let zMin = Infinity;
    let zMax = -Infinity;
    for (let j = 0; j <= n; j++)
      for (let i = 0; i <= n; i++) {
        const v = z({ x: extent.minX + i * dx, y: extent.minY + j * dy });
        field[j * (n + 1) + i] = v;
        zMin = Math.min(zMin, v);
        zMax = Math.max(zMax, v);
      }
    const step = opts.contourStep ?? 5;
    const at = (i: number, j: number) => field[j * (n + 1) + i];
    const px = (i: number) => extent.minX + i * dx;
    const py = (j: number) => extent.minY + j * dy;
    for (let level = Math.ceil(zMin / step) * step; level < zMax; level += step) {
      const segments: [Pt2, Pt2][] = [];
      for (let j = 0; j < n; j++)
        for (let i = 0; i < n; i++) {
          const a = at(i, j);
          const b = at(i + 1, j);
          const c = at(i + 1, j + 1);
          const d = at(i, j + 1);
          const idx = (a >= level ? 8 : 0) | (b >= level ? 4 : 0) | (c >= level ? 2 : 0) | (d >= level ? 1 : 0);
          if (idx === 0 || idx === 15) continue;
          const interp = (p: Pt2, q: Pt2, vp: number, vq: number): Pt2 => {
            const t = (level - vp) / (vq - vp || 1e-9);
            return { x: lerp(p.x, q.x, t), y: lerp(p.y, q.y, t) };
          };
          const top = interp({ x: px(i), y: py(j) }, { x: px(i + 1), y: py(j) }, a, b);
          const right = interp({ x: px(i + 1), y: py(j) }, { x: px(i + 1), y: py(j + 1) }, b, c);
          const bottom = interp({ x: px(i), y: py(j + 1) }, { x: px(i + 1), y: py(j + 1) }, d, c);
          const left = interp({ x: px(i), y: py(j) }, { x: px(i), y: py(j + 1) }, a, d);
          const table: Record<number, [Pt2, Pt2][]> = {
            1: [[left, bottom]],
            2: [[bottom, right]],
            3: [[left, right]],
            4: [[top, right]],
            5: [
              [left, top],
              [bottom, right],
            ],
            6: [[top, bottom]],
            7: [[left, top]],
            8: [[left, top]],
            9: [[top, bottom]],
            10: [
              [left, bottom],
              [top, right],
            ],
            11: [[top, right]],
            12: [[left, right]],
            13: [[bottom, right]],
            14: [[left, bottom]],
          };
          for (const sgm of table[idx]) segments.push(sgm);
        }
      if (segments.length) contours.push({ level, segments });
    }
  }

  return {
    seed,
    extent,
    unit: k,
    fields,
    roads,
    settlements,
    carParks,
    pitLane,
    pitBuilding,
    paddock,
    buildings: buildings.filter((b) => b.every(inExtent)),
    stands,
    runoffs,
    tunnels,
    woods,
    water,
    ponds,
    contours,
  };
}
