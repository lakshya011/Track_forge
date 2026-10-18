import circuitsJson from "../../data/circuits.json";
import lettersJson from "../../data/letters.json";
import type { Circuit, LetterSection } from "./geo/types";

export const circuits = circuitsJson as unknown as Circuit[];
export const letters = lettersJson as unknown as LetterSection[];

export const circuitById = new Map(circuits.map((c) => [c.id, c]));

export const lettersByLetter: Map<string, LetterSection[]> = (() => {
  const m = new Map<string, LetterSection[]>();
  for (const s of letters) {
    const arr = m.get(s.letter) ?? [];
    arr.push(s);
    m.set(s.letter, arr);
  }
  return m;
})();

export const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

/** Circuits sorted by name (used by the curation tool). */
export const circuitsByName = [...circuits].sort((a, b) => a.name.localeCompare(b.name));

