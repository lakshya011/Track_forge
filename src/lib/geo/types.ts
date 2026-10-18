/** 2D point in metres (or glyph units). */
export interface Pt2 {
  x: number;
  y: number;
}

/** 3D point: x,y horizontal, z = elevation in metres. */
export interface Pt3 extends Pt2 {
  z: number;
}

/** A point on a polyline with cumulative distance from its start. */
export interface Sample extends Pt3 {
  dist: number;
}

/** A baked circuit from data/circuits.json. Points are resampled at a uniform step on a closed ring. */
export interface Circuit {
  id: string;
  name: string;
  location: string;
  country: string;
  opened: number;
  firstgp: number;
  /** Official lap length in metres (from source metadata). */
  length: number;
  /** Polyline length in metres of the resampled ring (last sample's dist). */
  ringLength: number;
  /** Resample step in metres. */
  step: number;
  /** [x, y, z, dist] tuples. First and last point coincide (closed ring). */
  points: [number, number, number, number][];
}

/** A curated stretch of a circuit that reads as a letter. */
export interface LetterSection {
  id: string;
  letter: string;
  circuitId: string;
  /** Start distance along the ring (metres, ring order). */
  start: number;
  /** End distance along the ring. If end < start the section wraps through dist 0. */
  end: number;
  /** Traverse from end to start instead of start to end. */
  reverse: boolean;
  /** Degrees of rotation applied after extraction so the letter reads upright. */
  rotation: number;
  /** Mirror across the vertical axis after rotation. */
  flipX: boolean;
  label?: string;
}

/** A letter section normalised into glyph space (cap height = 1, minX = minY = 0). */
export interface Glyph {
  pts: Sample[];
  width: number;
  entry: Pt2;
  exit: Pt2;
  entryTangent: Pt2;
  exitTangent: Pt2;
  section: LetterSection;
  /** Number of letters fused into this glyph by stroke sharing (1 for a plain letter). */
  merged?: number;
}

export interface Corner {
  /** Index of the apex sample in the loop. */
  index: number;
  /** Distance of the apex from start/finish. */
  dist: number;
  /** Start and end distances of the braking/turning zone. */
  startDist: number;
  endDist: number;
  /** Total heading change in degrees (positive = left). */
  angleDeg: number;
  direction: "L" | "R";
  number: number;
  apex: Pt2;
  /** The letter whose source section contains the apex (absent for corners on connecting roads). */
  source?: CornerSource;
}

export interface CornerSource {
  letter: string;
  /** Index into `Track.sources`. */
  letterIndex: number;
  circuitId: string;
  /** Curated label of the section, e.g. "La Source". */
  label?: string;
}

/** The stretch of the finished lap (metres from start/finish) drawn by one letter. */
export interface LetterRange {
  letter: string;
  /** Index into `Track.sources`. */
  letterIndex: number;
  startDist: number;
  endDist: number;
}

export interface Straight {
  startDist: number;
  endDist: number;
  length: number;
}

export interface TrackSource {
  letter: string;
  section: LetterSection;
  circuit: Circuit;
}

export interface Track {
  name: string;
  seed: number;
  /** Target circuit id whose length was matched. */
  lengthCircuitId: string;
  /** Closed loop, uniform spacing, first === last. x,y in metres, z elevation. */
  loop: Sample[];
  length: number;
  corners: Corner[];
  /** Sector boundary distances [0, s1, s2]. */
  sectors: [number, number, number];
  longestStraight: Straight;
  sources: TrackSource[];
  /** True if the generator could not avoid a self-intersection. */
  warning?: string;
  /** Glyph-space placement for the build animation and debugging. */
  /** Letter indices (into `sources`) whose exit stroke is shared with the following letter. */
  ligatures: number[];
  /** Where each letter sits along the lap, in letter order. */
  letterRanges: LetterRange[];
  debug: {
    joinIndices: number[];
    gap: number;
    offset: number;
    attempts: number;
    kerned: boolean;
  };
}
