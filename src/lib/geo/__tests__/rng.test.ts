import { describe, expect, it } from "vitest";
import { hashString, mulberry32, pickIndex } from "../rng";

describe("rng", () => {
  it("hashString is stable and differs across inputs", () => {
    expect(hashString("JOHN")).toBe(hashString("JOHN"));
    expect(hashString("JOHN")).not.toBe(hashString("JOHM"));
  });
  it("same seed yields identical sequences", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = Array.from({ length: 5 }, () => a());
    const seqB = Array.from({ length: 5 }, () => b());
    expect(seqA).toEqual(seqB);
    seqA.forEach((v) => expect(v).toBeGreaterThanOrEqual(0));
    seqA.forEach((v) => expect(v).toBeLessThan(1));
  });
  it("different seeds differ", () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });
  it("pickIndex stays in range", () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 100; i++) {
      const k = pickIndex(rng, 3);
      expect(k).toBeGreaterThanOrEqual(0);
      expect(k).toBeLessThan(3);
    }
  });
});
