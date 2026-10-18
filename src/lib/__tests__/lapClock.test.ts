import { afterEach, describe, expect, it, vi } from "vitest";
import { createLapClock } from "../hooks/useLapClock";

let fake = 1000;
const useFakeNow = () => vi.spyOn(performance, "now").mockImplementation(() => fake);

afterEach(() => vi.restoreAllMocks());

describe("lap clock", () => {
  it("advances while playing, wraps at the lap time and freezes on pause", () => {
    useFakeNow();
    const c = createLapClock(90);
    expect(c.now()).toBe(0);
    fake += 10_000;
    expect(c.now()).toBeCloseTo(10, 6);
    fake += 85_000;
    expect(c.now()).toBeCloseTo(5, 6);
    c.pause();
    expect(c.playing).toBe(false);
    fake += 3_000;
    expect(c.now()).toBeCloseTo(5, 6);
    c.play();
    fake += 1_000;
    expect(c.now()).toBeCloseTo(6, 6);
  });

  it("seeks, holds without changing the play state and notifies subscribers once per change", () => {
    useFakeNow();
    const seen: number[] = [];
    const c = createLapClock(60);
    c.subscribe((t) => seen.push(t));
    c.seek(42);
    expect(c.now()).toBeCloseTo(42, 6);
    expect(c.fraction()).toBeCloseTo(0.7, 6);
    c.hold(true);
    expect(c.playing).toBe(true);
    expect(c.running()).toBe(false);
    fake += 5_000;
    expect(c.now()).toBeCloseTo(42, 6);
    c.hold(false);
    fake += 5_000;
    expect(c.now()).toBeCloseTo(47, 6);
    c.toggle();
    expect(c.playing).toBe(false);
    expect(seen.length).toBe(4);
    expect(seen[0]).toBeCloseTo(42, 6);
    c.seek(-1);
    expect(c.now()).toBeCloseTo(59, 6);
  });

  it("reports play state changes to its owner", () => {
    useFakeNow();
    const states: boolean[] = [];
    const c = createLapClock(30, (p) => states.push(p));
    c.pause();
    c.pause();
    c.play();
    expect(states).toEqual([false, true]);
  });
});
