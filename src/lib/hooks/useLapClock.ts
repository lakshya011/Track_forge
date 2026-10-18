"use client";

import { useEffect, useMemo, useState } from "react";

/*
 * One clock for the ghost lap, shared by the 2D map, the driver view and the HUD. Time lives in a
 * ref-like object, not React state, so reading it every frame costs nothing and nothing re-renders;
 * subscribers get a callback per animation frame while the clock runs and once after every seek,
 * play, pause or hold. Only `playing` is React state, for the play button.
 */

export interface LapClock {
  lapSeconds: number;
  /** Current lap time in seconds, 0 <= t < lapSeconds. */
  now: () => number;
  /** 0..1 fraction of the lap. */
  fraction: () => number;
  /** Paused by the user (the play button). */
  playing: boolean;
  /** Advancing right now: playing and not held. */
  running: () => boolean;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  /** Jump to a lap time; keeps the play state. */
  seek: (t: number) => void;
  /** A temporary hold (hovering the map) that does not change the play button. */
  hold: (on: boolean) => void;
  /** Called every frame while running and once after each change. Returns an unsubscribe. */
  subscribe: (cb: (t: number) => void) => () => void;
}

interface State {
  anchorT: number;
  anchorNow: number;
  playing: boolean;
  held: boolean;
}

const perf = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

/** Build a clock outside React; the hook below wraps it with the `playing` state. */
export function createLapClock(lapSeconds: number, onPlaying?: (p: boolean) => void): LapClock {
  const s: State = { anchorT: 0, anchorNow: perf(), playing: true, held: false };
  const subs = new Set<(t: number) => void>();
  let raf = 0;
  const running = () => s.playing && !s.held;
  const wrap = (t: number) => ((t % lapSeconds) + lapSeconds) % lapSeconds;
  const now = () => (running() ? wrap(s.anchorT + (perf() - s.anchorNow) / 1000) : wrap(s.anchorT));
  const notify = () => {
    const t = now();
    for (const cb of subs) cb(t);
  };
  const tick = () => {
    raf = 0;
    if (!running() || subs.size === 0) return;
    notify();
    raf = requestAnimationFrame(tick);
  };
  const schedule = () => {
    if (raf === 0 && running() && subs.size > 0 && typeof requestAnimationFrame !== "undefined") raf = requestAnimationFrame(tick);
  };
  const freeze = () => {
    s.anchorT = now();
    s.anchorNow = perf();
  };
  const clock: LapClock = {
    lapSeconds,
    now,
    fraction: () => now() / lapSeconds,
    playing: true,
    running,
    play: () => {
      if (s.playing) return;
      freeze();
      s.playing = true;
      clock.playing = true;
      onPlaying?.(true);
      notify();
      schedule();
    },
    pause: () => {
      if (!s.playing) return;
      freeze();
      s.playing = false;
      clock.playing = false;
      onPlaying?.(false);
      notify();
    },
    toggle: () => (s.playing ? clock.pause() : clock.play()),
    seek: (t) => {
      s.anchorT = wrap(t);
      s.anchorNow = perf();
      notify();
    },
    hold: (on) => {
      if (s.held === on) return;
      freeze();
      s.held = on;
      notify();
      schedule();
    },
    subscribe: (cb) => {
      subs.add(cb);
      schedule();
      return () => {
        subs.delete(cb);
        if (subs.size === 0 && raf) {
          cancelAnimationFrame(raf);
          raf = 0;
        }
      };
    },
  };
  return clock;
}

/** A lap clock for the given lap time; a new one starts at zero, playing, when the lap time changes. */
export function useLapClock(lapSeconds: number): LapClock {
  // The clock object is stable and mutates `playing` in place; a counter re-renders the owner on play/pause.
  const [, bump] = useState(0);
  const clock = useMemo(() => createLapClock(lapSeconds, () => bump((n) => n + 1)), [lapSeconds]);
  useEffect(() => () => clock.hold(true), [clock]);
  return clock;
}
