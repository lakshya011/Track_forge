import type { Circuit } from "./types";

/** Shortest and longest official lap lengths in the data set (Monaco and Spa). */
export const MIN_LAP_M = 3337;
export const MAX_LAP_M = 7004;
/** Letter count at or above which the lap is as long as it gets. */
export const LETTERS_FOR_MAX = 11;

/** Number of A–Z letters in a name; spaces and anything else are ignored. */
export function letterCount(name: string): number {
  let n = 0;
  for (const ch of name.toUpperCase()) if (ch >= "A" && ch <= "Z") n++;
  return n;
}

/**
 * Target lap length in metres for a name: one letter is a Monaco-length lap, eleven or more a
 * Spa-length lap, linear in between.
 */
export function targetLengthFor(name: string): number {
  const n = letterCount(name);
  const t = Math.min(1, Math.max(0, (n - 1) / (LETTERS_FOR_MAX - 1)));
  return MIN_LAP_M + t * (MAX_LAP_M - MIN_LAP_M);
}

/**
 * The circuit whose official lap length is nearest the target for this name (ties go to the
 * shorter circuit). Returning a real circuit keeps "same lap length as X" lines meaningful.
 */
export function lengthCircuitFor(name: string, circuits: Circuit[]): Circuit {
  if (circuits.length === 0) throw new Error("lengthCircuitFor: no circuits");
  const target = targetLengthFor(name);
  let best = circuits[0];
  let bestD = Infinity;
  for (const c of circuits) {
    // Round to the metre so float noise cannot decide a tie.
    const d = Math.round(Math.abs(c.length - target) * 1000) / 1000;
    if (d < bestD || (d === bestD && c.length < best.length)) {
      bestD = d;
      best = c;
    }
  }
  return best;
}
