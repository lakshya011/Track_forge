"use client";

import { useSyncExternalStore } from "react";
import { isTeamId } from "./poster/teams";
import { DEFAULT_OPTIONS, type PosterOptions } from "./poster/types";

/** Poster sub-options (wood, team livery, north arrow, coordinates) remembered per browser. */

const KEY = "track-forge:poster-prefs";
const EVENT = "track-forge:poster-prefs";

const WOODS = new Set(["oak", "walnut", "black"]);

/** Merge a stored JSON string over the defaults, ignoring anything malformed. */
export function parsePosterPrefs(raw: string | null): PosterOptions {
  const out: PosterOptions = { ...DEFAULT_OPTIONS };
  if (!raw) return out;
  try {
    const v: unknown = JSON.parse(raw);
    if (typeof v !== "object" || v === null) return out;
    const o = v as Record<string, unknown>;
    if (typeof o.wood === "string" && WOODS.has(o.wood)) out.wood = o.wood as PosterOptions["wood"];
    if (isTeamId(o.team)) out.team = o.team;
    if (typeof o.northArrow === "boolean") out.northArrow = o.northArrow;
    if (typeof o.coordinates === "boolean") out.coordinates = o.coordinates;
  } catch {
    /* malformed: defaults */
  }
  return out;
}

function storage(): Storage | undefined {
  try {
    return typeof globalThis.localStorage === "undefined" ? undefined : globalThis.localStorage;
  } catch {
    return undefined;
  }
}

let cachedRaw: string | null | undefined;
let cachedValue: PosterOptions = DEFAULT_OPTIONS;

function read(): PosterOptions {
  try {
    const raw = storage()?.getItem(KEY) ?? null;
    if (raw === cachedRaw) return cachedValue;
    cachedRaw = raw;
    cachedValue = parsePosterPrefs(raw);
    return cachedValue;
  } catch {
    return DEFAULT_OPTIONS;
  }
}

/** Current prefs without subscribing. */
export function readPosterPrefs(): PosterOptions {
  return read();
}

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVENT, cb);
  };
}

export function usePosterPrefs(): PosterOptions {
  return useSyncExternalStore(subscribe, read, () => DEFAULT_OPTIONS);
}

export function setPosterPrefs(patch: Partial<PosterOptions>) {
  try {
    const next = { ...read(), ...patch };
    storage()?.setItem(KEY, JSON.stringify(next));
    if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENT));
  } catch {
    /* storage unavailable: the choice lives for this render only */
  }
}
