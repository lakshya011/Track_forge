import { closeRing, resample } from "../project";
import type { Circuit, LetterSection } from "../types";

/** Build a synthetic closed-ring circuit from 2D points (z optional). */
export function makeCircuit(id: string, pts: { x: number; y: number; z?: number }[], step = 10): Circuit {
  const ring = closeRing(pts.map((p) => ({ x: p.x, y: p.y, z: p.z ?? 0 })));
  const s = resample(ring, step);
  return {
    id,
    name: id,
    location: id,
    country: "XX",
    opened: 2000,
    firstgp: 2000,
    length: Math.round(s[s.length - 1].dist),
    ringLength: s[s.length - 1].dist,
    step,
    points: s.map((p) => [p.x, p.y, p.z, p.dist]),
  };
}

/** 1000 m x 500 m rectangle, perimeter 3000 m, counter-clockwise from origin. */
export const rect = makeCircuit("rect", [
  { x: 0, y: 0 },
  { x: 1000, y: 0 },
  { x: 1000, y: 500 },
  { x: 0, y: 500 },
]);

/** Circle of radius 500 m (perimeter ~3142 m), with a gentle elevation wave. */
export const circle = makeCircuit(
  "circle",
  Array.from({ length: 120 }, (_, i) => {
    const a = (i / 120) * Math.PI * 2;
    return { x: 500 * Math.cos(a), y: 500 * Math.sin(a), z: 100 + 20 * Math.sin(a) };
  }),
);

export function section(partial: Partial<LetterSection> & Pick<LetterSection, "letter" | "circuitId" | "start" | "end">): LetterSection {
  return {
    id: `${partial.letter}-${partial.circuitId}-${partial.start}`,
    reverse: false,
    rotation: 0,
    flipX: false,
    ...partial,
  };
}
