import { rezero, sampleAt } from "./project";
import type { Circuit, Glyph, LetterSection, Pt2, Sample } from "./types";

export class SectionTooShort extends Error {
  constructor(public readonly section: LetterSection, detail: string) {
    super(`Section ${section.id} too short: ${detail}`);
  }
}

export const MIN_SECTION_LENGTH = 30;
export const MIN_SECTION_SAMPLES = 4;

export function circuitSamples(c: Circuit): Sample[] {
  return c.points.map(([x, y, z, dist]) => ({ x, y, z, dist }));
}

/**
 * Extract the stretch of a closed ring between `start` and `end` distances (ring order).
 * Wraps through dist 0 when end < start. Reverses traversal when section.reverse is set.
 * Output dist is re-zeroed from the first traversed point.
 */
export function extractSection(circuit: Circuit, s: LetterSection): Sample[] {
  const ring = circuitSamples(circuit);
  const total = ring[ring.length - 1].dist;
  const start = ((s.start % total) + total) % total;
  const end = ((s.end % total) + total) % total;
  const pts: Sample[] = [sampleAt(ring, start)];
  const pushInterior = (from: number, to: number) => {
    for (const p of ring) if (p.dist > from && p.dist < to) pts.push(p);
  };
  if (end >= start) {
    pushInterior(start, end);
  } else {
    pushInterior(start, total);
    // skip ring[last] which equals ring[0]
    pushInterior(-1, end);
  }
  pts.push(sampleAt(ring, end));
  const out = rezero(s.reverse ? [...pts].reverse() : pts);
  const len = out[out.length - 1].dist;
  if (out.length < MIN_SECTION_SAMPLES || len < MIN_SECTION_LENGTH) {
    throw new SectionTooShort(s, `${out.length} samples, ${len.toFixed(1)} m`);
  }
  return out;
}

function rotate(p: Pt2, rad: number): Pt2 {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c };
}

function unit(v: Pt2): Pt2 {
  const l = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / l, y: v.y / l };
}

/** Direction from pts[0] towards pts[k] (entry tangent) or pts[n-1-k] towards pts[n-1] (exit). */
export function endTangents(pts: Pt2[], k = 3): { entry: Pt2; exit: Pt2 } {
  const n = pts.length;
  const kk = Math.min(k, n - 1);
  return {
    entry: unit({ x: pts[kk].x - pts[0].x, y: pts[kk].y - pts[0].y }),
    exit: unit({ x: pts[n - 1].x - pts[n - 1 - kk].x, y: pts[n - 1].y - pts[n - 1 - kk].y }),
  };
}

/**
 * Normalise an extracted section into glyph space:
 * centre, rotate by section.rotation, mirror if flipX, scale so bbox height = 1, translate to minX = minY = 0.
 * z is preserved untouched (metres); dist is recomputed in glyph units.
 */
export function normalizeGlyph(pts: Sample[], s: LetterSection): Glyph {
  if (pts.length < 2) throw new SectionTooShort(s, "fewer than 2 samples");
  const cx = pts.reduce((a, p) => a + p.x, 0) / pts.length;
  const cy = pts.reduce((a, p) => a + p.y, 0) / pts.length;
  const rad = (s.rotation * Math.PI) / 180;
  let q = pts.map((p) => {
    const r = rotate({ x: p.x - cx, y: p.y - cy }, rad);
    return { x: s.flipX ? -r.x : r.x, y: r.y, z: p.z };
  });
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of q) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  const h = maxY - minY;
  const w = maxX - minX;
  // Degenerate (near-horizontal) sections scale by width instead so they stay finite.
  const scale = 1 / (h > 1e-6 ? h : w > 1e-6 ? w : 1);
  q = q.map((p) => ({ x: (p.x - minX) * scale, y: (p.y - minY) * scale, z: p.z }));
  const out = rezero(q);
  const t = endTangents(out);
  return {
    pts: out,
    width: w * scale,
    entry: { x: out[0].x, y: out[0].y },
    exit: { x: out[out.length - 1].x, y: out[out.length - 1].y },
    entryTangent: t.entry,
    exitTangent: t.exit,
    section: s,
  };
}

export function glyphFromSection(circuit: Circuit, s: LetterSection): Glyph {
  return normalizeGlyph(extractSection(circuit, s), s);
}

/**
 * Reverse traversal when the glyph's entry lies to the right of its exit, so letters are always
 * entered from the left and left towards the right. A track can be driven either way, so this is
 * purely a layout policy.
 */
export function orientLeftToRight(g: Glyph): Glyph {
  if (g.entry.x <= g.exit.x) return g;
  const pts = rezero([...g.pts].reverse());
  const t = endTangents(pts);
  return { ...g, pts, entry: g.exit, exit: g.entry, entryTangent: t.entry, exitTangent: t.exit };
}
