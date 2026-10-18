import { cornerName, wrapDist } from "./decor";
import type { Corner, Track } from "./types";

/*
 * What the onboard HUD says at a distance along the lap: which corner the car is in or approaching,
 * how far away it is, and which sector it is in.
 */

export interface CornerCue {
  corner: Corner;
  /** "in" while the car is between the corner's entry and exit, else "approach". */
  state: "in" | "approach";
  /** Metres to the corner's entry when approaching, 0 when in it. */
  metresTo: number;
}

/** The corner the car is in, or the next one ahead with the distance to its entry. */
export function cornerAt(track: Pick<Track, "corners" | "length">, d: number): CornerCue | null {
  const cs = track.corners;
  if (cs.length === 0) return null;
  const L = track.length;
  const dd = wrapDist(d, L);
  let best: CornerCue | null = null;
  for (const c of cs) {
    const start = wrapDist(c.startDist, L);
    const end = wrapDist(c.endDist, L);
    const inside = start <= end ? dd >= start && dd <= end : dd >= start || dd <= end;
    if (inside) return { corner: c, state: "in", metresTo: 0 };
    const ahead = wrapDist(start - dd, L);
    if (!best || ahead < best.metresTo) best = { corner: c, state: "approach", metresTo: ahead };
  }
  return best;
}

/** Sector number (1, 2 or 3) at distance d. */
export function sectorAt(track: Pick<Track, "sectors" | "length">, d: number): 1 | 2 | 3 {
  const dd = wrapDist(d, track.length);
  return dd < track.sectors[1] ? 1 : dd < track.sectors[2] ? 2 : 3;
}

/** "T5 · La Source" while in the corner, "T5 in 120 m" on the approach, "" with no corners. */
export function cornerCueText(track: Pick<Track, "corners" | "length" | "sources">, d: number): string {
  const cue = cornerAt(track, d);
  if (!cue) return "";
  if (cue.state === "in") return cornerName(cue.corner, track.sources);
  return `T${cue.corner.number} in ${Math.max(5, Math.round(cue.metresTo / 5) * 5)} m`;
}
