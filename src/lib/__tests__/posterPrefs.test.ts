import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_OPTIONS } from "../poster/types";
import { parsePosterPrefs, readPosterPrefs, setPosterPrefs } from "../posterPrefs";

function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  };
}

describe("poster prefs", () => {
  it("parses stored values over the defaults and drops junk", () => {
    expect(parsePosterPrefs(null)).toEqual(DEFAULT_OPTIONS);
    expect(parsePosterPrefs("not json")).toEqual(DEFAULT_OPTIONS);
    expect(parsePosterPrefs(JSON.stringify({ wood: "walnut", team: "neon", northArrow: false, coordinates: "yes" }))).toEqual({
      ...DEFAULT_OPTIONS,
      wood: "walnut",
      northArrow: false,
    });
  });

  describe("with storage", () => {
    const g = globalThis as { localStorage?: Storage };
    let previous: Storage | undefined;
    beforeEach(() => {
      previous = g.localStorage;
      g.localStorage = memoryStorage();
    });
    afterEach(() => {
      if (previous) g.localStorage = previous;
      else delete g.localStorage;
    });
    it("round-trips a patch", () => {
      setPosterPrefs({ team: "papaya", coordinates: true });
      expect(readPosterPrefs()).toEqual({ ...DEFAULT_OPTIONS, team: "papaya", coordinates: true });
      setPosterPrefs({ wood: "black" });
      expect(readPosterPrefs().team).toBe("papaya");
      expect(readPosterPrefs().wood).toBe("black");
    });
  });
});
