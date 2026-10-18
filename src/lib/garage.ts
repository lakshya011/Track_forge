"use client";

import { useSyncExternalStore } from "react";

/** A circuit the visitor built recently, kept in localStorage purely as a convenience. */
export interface GarageEntry {
  name: string;
  seed: number;
  /** Explicit lap-length circuit id when the link carried one (older shared links). */
  len?: string;
  grade: string;
  difficulty: number;
  lapTime: string;
  at: number;
}

const KEY = "track-forge:garage";
const EVENT = "track-forge:garage";
export const GARAGE_SIZE = 8;
const EMPTY: GarageEntry[] = [];

let cachedRaw: string | null = null;
let cachedValue: GarageEntry[] = EMPTY;

/** The browser's localStorage, or undefined on the server and in tests without a stub. */
function storage(): Storage | undefined {
  try {
    return typeof globalThis.localStorage === "undefined" ? undefined : globalThis.localStorage;
  } catch {
    return undefined;
  }
}

function read(): GarageEntry[] {
  try {
    const raw = storage()?.getItem(KEY) ?? null;
    if (raw === cachedRaw) return cachedValue;
    cachedRaw = raw;
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    cachedValue = Array.isArray(parsed)
      ? parsed.filter((e): e is GarageEntry => typeof e === "object" && e !== null && typeof (e as GarageEntry).name === "string")
      : EMPTY;
    if (cachedValue.length === 0) cachedValue = EMPTY;
    return cachedValue;
  } catch {
    return EMPTY;
  }
}

function notify() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVENT, cb);
  };
}

/** The visitor's recent circuits, newest first. Empty on the server and when storage is unavailable. */
export function useGarage(): GarageEntry[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

/** Current entries without subscribing (for tests and one-off reads). */
export function readGarage(): GarageEntry[] {
  return read();
}

const sameEntry = (a: Pick<GarageEntry, "name" | "seed" | "len">, b: Pick<GarageEntry, "name" | "seed" | "len">) =>
  a.name === b.name && a.seed === b.seed && (a.len ?? "") === (b.len ?? "");

/** Remember a circuit. Replaces an older entry for the same name and seed. */
export function saveToGarage(entry: Omit<GarageEntry, "at">) {
  try {
    const cur = read().filter((e) => !sameEntry(e, entry));
    const next = [{ ...entry, at: Date.now() }, ...cur].slice(0, GARAGE_SIZE);
    storage()?.setItem(KEY, JSON.stringify(next));
    notify();
  } catch {
    /* private mode or storage disabled: the garage is optional */
  }
}

/** Forget one circuit. */
export function removeFromGarage(name: string, seed: number, len?: string) {
  try {
    const next = read().filter((e) => !sameEntry(e, { name, seed, len }));
    if (next.length === 0) storage()?.removeItem(KEY);
    else storage()?.setItem(KEY, JSON.stringify(next));
    notify();
  } catch {
    /* storage unavailable: nothing to forget */
  }
}

/** Forget every circuit. */
export function clearGarage() {
  try {
    storage()?.removeItem(KEY);
    notify();
  } catch {
    /* storage unavailable: nothing to forget */
  }
}
