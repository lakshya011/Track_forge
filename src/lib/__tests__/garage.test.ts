import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GARAGE_SIZE, clearGarage, readGarage, removeFromGarage, saveToGarage } from "../garage";

/** In-memory stand-in for window.localStorage. */
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

const entry = (name: string, seed = 0, len?: string) => ({ name, seed, len, grade: "Grade 1", difficulty: 5, lapTime: "1:30.000" });

describe("garage", () => {
  const g = globalThis as { localStorage?: Storage };
  let previous: Storage | undefined;
  beforeEach(() => {
    previous = g.localStorage;
    g.localStorage = memoryStorage();
    clearGarage();
  });
  afterEach(() => {
    if (previous) g.localStorage = previous;
    else delete g.localStorage;
  });

  it("saves newest first, replaces duplicates and caps the size", () => {
    saveToGarage(entry("LEWIS"));
    saveToGarage(entry("NIKI"));
    saveToGarage(entry("LEWIS"));
    expect(readGarage().map((e) => e.name)).toEqual(["LEWIS", "NIKI"]);
    for (let i = 0; i < GARAGE_SIZE + 3; i++) saveToGarage(entry(`N${i}`));
    expect(readGarage()).toHaveLength(GARAGE_SIZE);
  });

  it("removes one circuit by name, seed and length override", () => {
    saveToGarage(entry("LEWIS", 0));
    saveToGarage(entry("LEWIS", 7));
    saveToGarage(entry("LEWIS", 7, "it-1922"));
    removeFromGarage("LEWIS", 7);
    expect(readGarage().map((e) => [e.seed, e.len ?? ""])).toEqual([
      [7, "it-1922"],
      [0, ""],
    ]);
  });

  it("clears everything and returns the same empty array afterwards", () => {
    saveToGarage(entry("AYRTON"));
    clearGarage();
    const a = readGarage();
    expect(a).toEqual([]);
    expect(g.localStorage!.getItem("track-forge:garage")).toBeNull();
    saveToGarage(entry("AYRTON"));
    removeFromGarage("AYRTON", 0);
    expect(readGarage()).toBe(a);
  });

  it("is a no-op without storage", () => {
    delete g.localStorage;
    expect(() => saveToGarage(entry("X"))).not.toThrow();
    expect(() => clearGarage()).not.toThrow();
    expect(readGarage()).toEqual([]);
  });
});
