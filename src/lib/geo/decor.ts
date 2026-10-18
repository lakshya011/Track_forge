import { sampleAt } from "./project";
import type { Corner, Pt2, Sample, Straight, Track, TrackSource } from "./types";

/**
 * Track furniture derived from a Track: kerbs, gravel traps, braking boards, sector flags, the DRS
 * detection line and grandstands. Everything is returned in track metres so the 2D view, the poster
 * and the 3D ribbon can each map it with their own scale.
 */

export const wrapDist = (d: number, length: number) => ((d % length) + length) % length;

/** Sample at distance `d` along the closed loop, wrapping. */
export function pointAt(loop: Sample[], d: number): Sample {
  const L = loop[loop.length - 1].dist;
  return sampleAt(loop, wrapDist(d, L));
}

/** Unit tangent of travel at loop index i. */
export function tangentAt(loop: Pt2[], i: number): Pt2 {
  const n = loop.length - 1;
  const a = loop[((i - 1) % n + n) % n];
  const b = loop[(i + 1) % n];
  const tx = b.x - a.x;
  const ty = b.y - a.y;
  const l = Math.hypot(tx, ty) || 1;
  return { x: tx / l, y: ty / l };
}

/** Unit normal pointing to the driver's left at loop index i. */
export function leftNormal(loop: Pt2[], i: number): Pt2 {
  const t = tangentAt(loop, i);
  return { x: -t.y, y: t.x };
}

/** Unit normal pointing to the inside of a corner (left for a left-hander). */
export function insideNormal(loop: Pt2[], i: number, direction: "L" | "R"): Pt2 {
  const n = leftNormal(loop, i);
  return direction === "L" ? n : { x: -n.x, y: -n.y };
}

/** Tangent and left normal at an arbitrary distance along the loop. */
export function frameAt(loop: Sample[], d: number): { p: Sample; t: Pt2; n: Pt2 } {
  const L = loop[loop.length - 1].dist;
  const dd = wrapDist(d, L);
  let lo = 0;
  let hi = loop.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (loop[mid].dist <= dd) lo = mid;
    else hi = mid;
  }
  const t = tangentAt(loop, lo);
  return { p: sampleAt(loop, dd), t, n: { x: -t.y, y: t.x } };
}

/** Loop samples with dist in [start, end], wrapping through start/finish when end < start. */
export function rangeSamples(loop: Sample[], start: number, end: number): Sample[] {
  const L = loop[loop.length - 1].dist;
  const s = wrapDist(start, L);
  const e = wrapDist(end, L);
  const body = loop.slice(0, -1);
  if (e >= s) return body.filter((p) => p.dist >= s && p.dist <= e);
  return [...body.filter((p) => p.dist >= s), ...body.filter((p) => p.dist <= e)];
}

/** Indices of loop samples with dist in [start, end], wrapping. */
export function rangeIndices(loop: Sample[], start: number, end: number): number[] {
  const L = loop[loop.length - 1].dist;
  const s = wrapDist(start, L);
  const e = wrapDist(end, L);
  const out: number[] = [];
  const n = loop.length - 1;
  if (e >= s) {
    for (let i = 0; i < n; i++) if (loop[i].dist >= s && loop[i].dist <= e) out.push(i);
  } else {
    for (let i = 0; i < n; i++) if (loop[i].dist >= s) out.push(i);
    for (let i = 0; i < n; i++) if (loop[i].dist <= e) out.push(i);
  }
  return out;
}

/** Metres of corner-free road before a corner's entry, wrapping. */
export function straightBefore(track: Pick<Track, "corners" | "length">, idx: number): number {
  const cs = track.corners;
  if (cs.length === 0) return track.length;
  const c = cs[idx];
  const prev = cs[(idx - 1 + cs.length) % cs.length];
  if (cs.length === 1) return track.length - (c.endDist - c.startDist);
  let d = c.startDist - prev.endDist;
  if (d < 0) d += track.length;
  return d;
}

export interface Kerb {
  corner: Corner;
  /** Polyline along the inside edge of the corner, offset `offset` metres from the centreline. */
  pts: Pt2[];
}

/** Inside-edge kerb for every corner. `offset` is in metres (negative numbers flip to the outside). */
export function kerbs(track: Pick<Track, "loop" | "corners">, offset: number): Kerb[] {
  const loop = track.loop;
  return track.corners
    .map((c) => {
      const idx = rangeIndices(loop, c.startDist, c.endDist);
      const pts = idx.map((i) => {
        const n = insideNormal(loop, i, c.direction);
        return { x: loop[i].x + n.x * offset, y: loop[i].y + n.y * offset };
      });
      return { corner: c, pts };
    })
    .filter((k) => k.pts.length >= 2);
}

export interface GravelTrap {
  corner: Corner;
  /** Closed polygon (not repeated at the end). */
  polygon: Pt2[];
}

export interface GravelOptions {
  /** Distance from the centreline to the near edge of the sand, metres. */
  edge: number;
  /** Depth of the sand at its widest, metres. */
  depth: number;
  /** Corners must turn at least this much (degrees). */
  minAngle?: number;
  /** ...and follow at least this much straight (metres). */
  minStraight?: number;
}

/** Run-off wedges outside heavy-braking corners. */
export function gravelTraps(track: Pick<Track, "loop" | "corners" | "length">, opts: GravelOptions): GravelTrap[] {
  const minAngle = opts.minAngle ?? 70;
  const minStraight = opts.minStraight ?? 300;
  const loop = track.loop;
  const out: GravelTrap[] = [];
  track.corners.forEach((c, k) => {
    if (Math.abs(c.angleDeg) <= minAngle || straightBefore(track, k) < minStraight) return;
    // The wedge covers the entry through to just past the apex.
    const span = c.endDist >= c.startDist ? c.endDist - c.startDist : c.endDist + track.length - c.startDist;
    const idx = rangeIndices(loop, c.startDist - Math.min(60, span * 0.3), c.startDist + span * 0.75);
    if (idx.length < 3) return;
    const inner: Pt2[] = [];
    const outer: Pt2[] = [];
    idx.forEach((i, j) => {
      const n = insideNormal(loop, i, c.direction);
      const o = { x: -n.x, y: -n.y };
      const t = j / (idx.length - 1);
      // Depth rises quickly on entry, peaks before the apex, tapers to nothing on exit.
      const bulge = Math.sin(Math.PI * Math.min(1, t / 0.85)) * (t < 0.85 ? 1 : 1 - (t - 0.85) / 0.15);
      const depth = opts.depth * Math.max(0, bulge);
      inner.push({ x: loop[i].x + o.x * opts.edge, y: loop[i].y + o.y * opts.edge });
      outer.push({ x: loop[i].x + o.x * (opts.edge + depth), y: loop[i].y + o.y * (opts.edge + depth) });
    });
    out.push({ corner: c, polygon: [...inner, ...outer.reverse()] });
  });
  return out;
}

export interface BrakingBoard {
  corner: Corner;
  /** Metres before the corner entry (100 or 50). */
  metres: number;
  p: Pt2;
  /** Unit normal pointing to the outside of the corner. */
  n: Pt2;
}

/** 100 m and 50 m boards before each corner that has room for them. */
export function brakingBoards(track: Pick<Track, "loop" | "corners" | "length">, marks: number[] = [100, 50]): BrakingBoard[] {
  const out: BrakingBoard[] = [];
  track.corners.forEach((c, k) => {
    const room = straightBefore(track, k);
    for (const m of marks) {
      if (room < m + 20) continue;
      const f = frameAt(track.loop, c.startDist - m);
      const inside = c.direction === "L" ? f.n : { x: -f.n.x, y: -f.n.y };
      out.push({ corner: c, metres: m, p: f.p, n: { x: -inside.x, y: -inside.y } });
    }
  });
  return out;
}

export interface Marker {
  p: Pt2;
  /** Unit tangent of travel. */
  t: Pt2;
  /** Unit normal pointing away from the loop's centroid. */
  n: Pt2;
  dist: number;
}

function outwardAt(loop: Sample[], d: number): Marker {
  const f = frameAt(loop, d);
  const n = loop.length - 1;
  let cx = 0;
  let cy = 0;
  for (let k = 0; k < n; k++) {
    cx += loop[k].x;
    cy += loop[k].y;
  }
  cx /= n;
  cy /= n;
  const towardCentre = (f.p.x + f.n.x - cx) ** 2 + (f.p.y + f.n.y - cy) ** 2 < (f.p.x - f.n.x - cx) ** 2 + (f.p.y - f.n.y - cy) ** 2;
  return { p: f.p, t: f.t, n: towardCentre ? { x: -f.n.x, y: -f.n.y } : f.n, dist: f.p.dist };
}

/** Sector 2 and sector 3 boundaries. */
export function sectorFlags(track: Pick<Track, "loop" | "sectors">): [Marker, Marker] {
  return [outwardAt(track.loop, track.sectors[1]), outwardAt(track.loop, track.sectors[2])];
}

/** DRS detection line `before` metres ahead of the longest straight, if the straight is long enough. */
export function drsDetection(track: Pick<Track, "loop" | "longestStraight" | "length">, before = 200, minStraight = 450): Marker | null {
  if (track.longestStraight.length < minStraight) return null;
  return outwardAt(track.loop, track.longestStraight.startDist - before);
}

export interface Grandstand {
  /** Which straight this stand faces. */
  along: "start-finish" | "longest";
  blocks: Pt2[][];
}

export interface GrandstandOptions {
  /** Centreline to the front of the stand, metres. */
  offset: number;
  depth: number;
  /** Block length and gap between blocks along the straight, metres. */
  block?: number;
  gap?: number;
  /** Share of the straight the stand may occupy, centred. */
  coverage?: number;
}

/** The straight that contains the start/finish line. */
export function startFinishStraight(track: Pick<Track, "corners" | "length">): Straight {
  const cs = track.corners;
  if (cs.length === 0) return { startDist: 0, endDist: track.length, length: track.length };
  // Corner whose exit is last before dist 0 (wrapping) and the first corner after it.
  const last = cs[cs.length - 1];
  const first = cs[0];
  if (cs.length === 1) return { startDist: last.endDist, endDist: last.startDist, length: track.length - (last.endDist - last.startDist) };
  let len = first.startDist - last.endDist;
  if (len < 0) len += track.length;
  return { startDist: last.endDist, endDist: first.startDist, length: len };
}

function blocksAlong(loop: Sample[], straight: Straight, opts: GrandstandOptions): Pt2[][] {
  const L = loop[loop.length - 1].dist;
  const block = opts.block ?? 70;
  const gap = opts.gap ?? 18;
  const coverage = opts.coverage ?? 0.6;
  const usable = straight.length * coverage;
  const count = Math.floor((usable + gap) / (block + gap));
  if (count < 1) return [];
  const rowLen = count * block + (count - 1) * gap;
  const mid = wrapDist(straight.startDist + straight.length / 2, L);
  const start = mid - rowLen / 2;
  const out: Pt2[][] = [];
  for (let k = 0; k < count; k++) {
    const d0 = start + k * (block + gap);
    const d1 = d0 + block;
    const m = outwardAt(loop, (d0 + d1) / 2);
    const a = pointAt(loop, d0);
    const b = pointAt(loop, d1);
    const o0 = opts.offset;
    const o1 = opts.offset + opts.depth;
    out.push([
      { x: a.x + m.n.x * o0, y: a.y + m.n.y * o0 },
      { x: b.x + m.n.x * o0, y: b.y + m.n.y * o0 },
      { x: b.x + m.n.x * o1, y: b.y + m.n.y * o1 },
      { x: a.x + m.n.x * o1, y: a.y + m.n.y * o1 },
    ]);
  }
  return out;
}

/** Stands outside the start/finish straight and the longest straight (once if they coincide). */
export function grandstands(track: Pick<Track, "loop" | "corners" | "length" | "longestStraight">, opts: GrandstandOptions): Grandstand[] {
  const sf = startFinishStraight(track);
  const out: Grandstand[] = [{ along: "start-finish", blocks: blocksAlong(track.loop, sf, opts) }];
  const ls = track.longestStraight;
  const same = Math.abs(ls.startDist - sf.startDist) < 1 && Math.abs(ls.endDist - sf.endDist) < 1;
  if (!same && ls.length >= 250) out.push({ along: "longest", blocks: blocksAlong(track.loop, ls, { ...opts, coverage: (opts.coverage ?? 0.6) * 0.8 }) });
  return out.filter((g) => g.blocks.length > 0);
}

/** "T3 · La Source" when the section is labelled, else "T3 · Spa Francorchamps", else "T3". */
export function cornerName(c: Corner, sources: TrackSource[]): string {
  const base = `T${c.number}`;
  if (!c.source) return base;
  const src = sources[c.source.letterIndex];
  const place = c.source.label ?? src?.circuit.location;
  return place ? `${base} · ${place}` : base;
}

/** Normalised 0..1 elevation for every loop sample (0 = lowest point). */
export function elevationSkin(loop: Sample[]): number[] {
  let lo = Infinity;
  let hi = -Infinity;
  for (const p of loop) {
    lo = Math.min(lo, p.z);
    hi = Math.max(hi, p.z);
  }
  const range = hi - lo;
  return loop.map((p) => (range > 1e-6 ? (p.z - lo) / range : 0.5));
}

/** Linear blend between two hex colours, t in 0..1. */
export function mixHex(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  const tt = Math.min(1, Math.max(0, t));
  return "#" + pa.map((v, i) => Math.round(v + (pb[i] - v) * tt).toString(16).padStart(2, "0")).join("");
}

/** Low ground to high ground: blue, teal, yellow, orange. */
export const ELEVATION_RAMP = ["#3b82f6", "#2dd4bf", "#facc15", "#f97316"] as const;

/** Colour for a normalised elevation, through a multi-stop ramp so the middle never turns grey. */
export function rampHex(t: number, stops: readonly string[] = ELEVATION_RAMP): string {
  const tt = Math.min(1, Math.max(0, t)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(tt));
  return mixHex(stops[i], stops[i + 1], tt - i);
}

/** Corner numbers each letter contributed, indexed like `Track.sources`. */
export function cornerNumbersByLetter(track: Pick<Track, "corners" | "sources">): number[][] {
  const out: number[][] = track.sources.map(() => []);
  for (const c of track.corners) if (c.source && out[c.source.letterIndex]) out[c.source.letterIndex].push(c.number);
  return out;
}

/** "T3–T5" for a run, "T3, T7" for scattered numbers, "" for none. */
export function formatCornerRun(nums: number[]): string {
  if (nums.length === 0) return "";
  const sorted = [...nums].sort((a, b) => a - b);
  const runs: string[] = [];
  let start = sorted[0];
  let prev = sorted[0];
  const flush = () => runs.push(start === prev ? `T${start}` : `T${start}–T${prev}`);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === prev + 1) {
      prev = sorted[i];
      continue;
    }
    flush();
    start = sorted[i];
    prev = sorted[i];
  }
  flush();
  return runs.join(", ");
}
