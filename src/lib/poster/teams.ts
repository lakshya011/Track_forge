import { hashString } from "../geo/rng";

/*
 * Liveries for the team-car poster. Each is a fan colour scheme in the spirit of one of the ten
 * current constructors and carries that team's name as plain text only: no logos, wordmarks,
 * sponsor or brand names, and the poster says it is unofficial. The car in car.ts is recoloured
 * per team through four CSS custom properties.
 */

export interface Team {
  id: TeamId;
  /** Team name as shown in the swatch tooltip, e.g. "Aston Martin". */
  name: string;
  /** The giant display word on the poster, in caps; two-word names split onto two lines (see wordLines). */
  word: string;
  /** Main body colour. */
  c1: string;
  /** Secondary colour: dark wing elements, flaps, headrest. */
  c2: string;
  /** Third colour: endplates, stripes, the sidepod inlet lip. */
  c3: string;
  /** Helmet and small highlights. */
  accent: string;
  /** Sheet colour. */
  paper: string;
  /** Body text colour on the sheet. */
  ink: string;
  /** Pale tint for the giant word so it sits behind the car. */
  tint: string;
}

export const TEAM_IDS = ["papaya", "rosso", "silver", "navy", "pink", "racing", "glacier", "petrol", "azure", "onyx"] as const;
export type TeamId = (typeof TEAM_IDS)[number];

export const TEAMS: Record<TeamId, Team> = {
  papaya: { id: "papaya", name: "McLaren", word: "MCLAREN", c1: "#ff8000", c2: "#1c1c1c", c3: "#47c7fc", accent: "#ffffff", paper: "#f6f1e8", ink: "#161616", tint: "#ffd7b3" },
  rosso: { id: "rosso", name: "Ferrari", word: "FERRARI", c1: "#d8161c", c2: "#141414", c3: "#ffd400", accent: "#ffffff", paper: "#f7f2ea", ink: "#161616", tint: "#f6c5c3" },
  silver: { id: "silver", name: "Mercedes", word: "MERCEDES", c1: "#c6cbd1", c2: "#141414", c3: "#00c4b3", accent: "#141414", paper: "#f4f3f0", ink: "#161616", tint: "#dcdfe3" },
  navy: { id: "navy", name: "Red Bull", word: "RED BULL", c1: "#111f4d", c2: "#ffcf00", c3: "#e0162b", accent: "#ffffff", paper: "#f5f2ea", ink: "#161616", tint: "#c9d0e6" },
  pink: { id: "pink", name: "Alpine", word: "ALPINE", c1: "#0d2c7a", c2: "#ff4fa3", c3: "#f7f7f7", accent: "#ff4fa3", paper: "#f7f1ee", ink: "#161616", tint: "#f8cde1" },
  racing: { id: "racing", name: "Aston Martin", word: "ASTON MARTIN", c1: "#0d5a3b", c2: "#141414", c3: "#e8e2cf", accent: "#f5d13a", paper: "#f4f1e8", ink: "#161616", tint: "#c7ddd0" },
  glacier: { id: "glacier", name: "Racing Bulls", word: "RACING BULLS", c1: "#f3f5f7", c2: "#1457c9", c3: "#e8232f", accent: "#1457c9", paper: "#e9e4d9", ink: "#161616", tint: "#cdd9ee" },
  petrol: { id: "petrol", name: "Sauber", word: "SAUBER", c1: "#0b4f4a", c2: "#101010", c3: "#9be8d8", accent: "#9be8d8", paper: "#f3f1ea", ink: "#161616", tint: "#c3e1da" },
  azure: { id: "azure", name: "Williams", word: "WILLIAMS", c1: "#4aa3e8", c2: "#f7f7f7", c3: "#e2231a", accent: "#ffffff", paper: "#f6f3ec", ink: "#161616", tint: "#cfe5f8" },
  onyx: { id: "onyx", name: "Haas", word: "HAAS", c1: "#161616", c2: "#f1f1f1", c3: "#8c8c8c", accent: "#f1f1f1", paper: "#f3f1ec", ink: "#161616", tint: "#d8d6d1" },
};

/**
 * The display word as poster lines. A two-word name longer than `maxSingle` characters is split at
 * the space (pass 0 to split every two-word name); anything else stays whole.
 */
export function wordLines(team: Pick<Team, "word">, maxSingle = 8): string[] {
  const w = team.word.trim();
  return w.includes(" ") && w.length > maxSingle ? w.split(/\s+/) : [w];
}

export const isTeamId = (s: unknown): s is TeamId => typeof s === "string" && (TEAM_IDS as readonly string[]).includes(s);

/** The team a circuit gets until its owner picks one: deterministic for (name, seed). */
export function defaultTeamId(name: string, seed: number): TeamId {
  return TEAM_IDS[((hashString(name) ^ (seed >>> 0)) >>> 0) % TEAM_IDS.length];
}

/** Resolve an option value ("" or unknown means the default) to a team. */
export function teamFor(name: string, seed: number, choice?: string): Team {
  return TEAMS[isTeamId(choice) ? choice : defaultTeamId(name, seed)];
}
