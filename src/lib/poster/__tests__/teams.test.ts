import { describe, expect, it } from "vitest";
import { TEAMS, TEAM_IDS, defaultTeamId, isTeamId, teamFor, wordLines } from "../teams";

const HEX = /^#[0-9a-f]{6}$/;

describe("teams", () => {
  it("has ten distinct teams with valid colours and plain-text names", () => {
    expect(TEAM_IDS.length).toBe(10);
    expect(new Set(TEAM_IDS).size).toBe(10);
    expect(new Set(TEAM_IDS.map((id) => TEAMS[id].word)).size).toBe(10);
    expect(new Set(TEAM_IDS.map((id) => TEAMS[id].name)).size).toBe(10);
    for (const id of TEAM_IDS) {
      const t = TEAMS[id];
      expect(t.id).toBe(id);
      for (const c of [t.c1, t.c2, t.c3, t.accent, t.paper, t.ink, t.tint]) expect(c, `${id} ${c}`).toMatch(HEX);
      expect(t.word).toMatch(/^[A-Z ]{4,12}$/);
      expect(t.word).toBe(t.name.toUpperCase());
      // Names only: no sponsors, title partners or engine badges ride along.
      expect(t.name).not.toMatch(/oracle|scuderia|petronas|amg|aramco|bwt|kick|stake|visa|cash|moneygram|atlassian|hp|f1 team|racing$/i);
    }
    expect(TEAMS.papaya.word).toBe("MCLAREN");
    expect(TEAMS.racing.word).toBe("ASTON MARTIN");
    expect(TEAMS.navy.name).toBe("Red Bull");
  });

  it("splits long two-word names onto two lines", () => {
    expect(wordLines(TEAMS.racing)).toEqual(["ASTON", "MARTIN"]);
    expect(wordLines(TEAMS.glacier)).toEqual(["RACING", "BULLS"]);
    expect(wordLines(TEAMS.navy)).toEqual(["RED BULL"]);
    expect(wordLines(TEAMS.navy, 0)).toEqual(["RED", "BULL"]);
    expect(wordLines(TEAMS.papaya)).toEqual(["MCLAREN"]);
    expect(wordLines(TEAMS.silver, 0)).toEqual(["MERCEDES"]);
  });

  it("picks a default team deterministically from name and seed", () => {
    expect(isTeamId("papaya")).toBe(true);
    expect(isTeamId("Papaya")).toBe(false);
    expect(isTeamId("mclaren")).toBe(false);
    expect(defaultTeamId("LEWIS", 0)).toBe(defaultTeamId("LEWIS", 0));
    const seen = new Set(["LEWIS", "MAX", "LANDO", "OSCAR", "CHARLES", "GEORGE", "FERNANDO", "CARLOS"].map((n) => defaultTeamId(n, 0)));
    expect(seen.size).toBeGreaterThan(2);
    expect(teamFor("LEWIS", 0, "onyx").id).toBe("onyx");
    expect(teamFor("LEWIS", 0, "").id).toBe(defaultTeamId("LEWIS", 0));
    expect(teamFor("LEWIS", 0, undefined).id).toBe(defaultTeamId("LEWIS", 0));
  });
});
