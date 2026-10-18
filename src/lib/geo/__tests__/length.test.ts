import { describe, expect, it } from "vitest";
import { MAX_LAP_M, MIN_LAP_M, lengthCircuitFor, letterCount, targetLengthFor } from "../length";
import type { Circuit } from "../types";

const ring = (id: string, length: number): Circuit => ({
  id,
  name: id,
  location: id,
  country: "XX",
  opened: 2000,
  firstgp: 2000,
  length,
  ringLength: length,
  step: 10,
  points: [],
});
const circuits = [ring("monaco", 3337), ring("mid", 4400), ring("mid2", 4400), ring("long", 5800), ring("spa", 7004)];

describe("letterCount", () => {
  it("counts letters only", () => {
    expect(letterCount("LEWIS")).toBe(5);
    expect(letterCount("MAX V")).toBe(4);
    expect(letterCount("a b c")).toBe(3);
    expect(letterCount("   ")).toBe(0);
  });
});

describe("targetLengthFor", () => {
  it("runs from Monaco to Spa and clamps at both ends", () => {
    expect(targetLengthFor("I")).toBe(MIN_LAP_M);
    expect(targetLengthFor("")).toBe(MIN_LAP_M);
    expect(targetLengthFor("ABCDEFGHIJK")).toBe(MAX_LAP_M);
    expect(targetLengthFor("ABCDEFGHIJKL")).toBe(MAX_LAP_M);
  });
  it("is monotonic in letter count and ignores spaces", () => {
    let prev = 0;
    for (let n = 1; n <= 12; n++) {
      const v = targetLengthFor("A".repeat(n));
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
    expect(targetLengthFor("AB CD")).toBe(targetLengthFor("ABCD"));
  });
});

describe("lengthCircuitFor", () => {
  it("snaps to the nearest official length, shorter on ties", () => {
    expect(lengthCircuitFor("I", circuits).id).toBe("monaco");
    expect(lengthCircuitFor("ABCDEFGHIJKL", circuits).id).toBe("spa");
    // Four letters: 3337 + 0.3 * 3667 = 4437 -> nearest is 4400; the first of the equal pair wins.
    expect(lengthCircuitFor("ABCD", circuits).id).toBe("mid");
    const tied = [ring("b", 4400), ring("a", 4300)];
    // 4 letters target 4437.1: |4400| = 37.1 beats |4300| = 137.1
    expect(lengthCircuitFor("ABCD", tied).id).toBe("b");
    // Equidistant candidates: the shorter one wins.
    const t = targetLengthFor("ABCD");
    const exactTie = [ring("longer", t + 100), ring("shorter", t - 100)];
    expect(lengthCircuitFor("ABCD", exactTie).id).toBe("shorter");
  });
  it("throws without circuits", () => {
    expect(() => lengthCircuitFor("A", [])).toThrow();
  });
});
