"use client";

import { useMemo, useState } from "react";
import CircuitSvg from "@/components/CircuitSvg";
import GlyphPreview from "@/components/GlyphPreview";
import { ALPHABET, circuits, circuitsByName, letters as seeded } from "@/lib/data";
import { glyphFromSection } from "@/lib/geo/section";
import type { Glyph, LetterSection } from "@/lib/geo/types";

type Mode = "sheet" | "edit";

export default function CurateTool() {
  const [mode, setMode] = useState<Mode>("sheet");
  const [circuitId, setCircuitId] = useState(circuits[0].id);
  const circuit = circuits.find((c) => c.id === circuitId) ?? circuits[0];
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(800);
  const [active, setActive] = useState<"start" | "end">("start");
  const [reverse, setReverse] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [flipX, setFlipX] = useState(false);
  const [letter, setLetter] = useState("S");
  const [label, setLabel] = useState("");
  const [added, setAdded] = useState<LetterSection[]>([]);
  const [copied, setCopied] = useState(false);

  const selectCircuit = (id: string) => {
    const c = circuits.find((x) => x.id === id) ?? circuits[0];
    setCircuitId(id);
    setStart(0);
    setEnd(Math.min(800, c.ringLength));
  };

  const draft: LetterSection = useMemo(
    () => ({
      id: `${letter}-${circuitId}-${Math.round(start)}`,
      letter,
      circuitId,
      start: Math.round(start),
      end: Math.round(end),
      reverse,
      rotation,
      flipX,
      label: label || undefined,
    }),
    [letter, circuitId, start, end, reverse, rotation, flipX, label],
  );

  const { glyph, error } = useMemo((): { glyph: Glyph | null; error: string | null } => {
    try {
      return { glyph: glyphFromSection(circuit, draft), error: null };
    } catch (e) {
      return { glyph: null, error: (e as Error).message };
    }
  }, [circuit, draft]);

  const all = [...seeded, ...added];
  const counts = new Map<string, number>();
  for (const s of all) counts.set(s.letter, (counts.get(s.letter) ?? 0) + 1);

  const copy = async () => {
    await navigator.clipboard.writeText(JSON.stringify(added, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <header className="flex flex-wrap items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Letter curation <span className="text-zinc-500 text-base font-normal">internal tool</span></h1>
        <div className="flex gap-2 ml-auto">
          <button onClick={() => setMode("sheet")} className={`px-3 py-1.5 rounded ${mode === "sheet" ? "bg-zinc-100 text-zinc-900" : "bg-zinc-800"}`}>Contact sheet</button>
          <button onClick={() => setMode("edit")} className={`px-3 py-1.5 rounded ${mode === "edit" ? "bg-zinc-100 text-zinc-900" : "bg-zinc-800"}`}>Editor</button>
        </div>
      </header>

      <div className="flex flex-wrap gap-1 mb-6 text-xs">
        {ALPHABET.map((l) => (
          <button
            key={l}
            onClick={() => { setLetter(l); setMode("edit"); }}
            className={`w-8 h-8 rounded border ${counts.get(l) ? "border-emerald-700 bg-emerald-950 text-emerald-200" : "border-zinc-800 bg-zinc-900 text-zinc-500"} ${letter === l ? "ring-2 ring-zinc-100" : ""}`}
            title={`${counts.get(l) ?? 0} sections`}
          >
            {l}
            <span className="block text-[9px] leading-none">{counts.get(l) ?? 0}</span>
          </button>
        ))}
      </div>

      {mode === "sheet" && (
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-4">
          {circuitsByName.map((c) => (
            <button
              key={c.id}
              onClick={() => { selectCircuit(c.id); setMode("edit"); }}
              className="text-left bg-zinc-900 rounded-lg p-2 border border-zinc-800 hover:border-zinc-500"
            >
              <div className="aspect-square">
                <CircuitSvg circuit={c} size={300} ticks={500} baseColor="#d4d4d8" />
              </div>
              <div className="text-sm mt-1 font-medium truncate">{c.name}</div>
              <div className="text-xs text-zinc-500">{c.id} · {c.length} m · {c.location}</div>
            </button>
          ))}
        </div>
      )}

      {mode === "edit" && (
        <div className="grid lg:grid-cols-[1fr_360px] gap-6">
          <section className="bg-zinc-900 rounded-xl border border-zinc-800 p-3">
            <div className="flex flex-wrap gap-3 items-center mb-2">
              <select value={circuitId} onChange={(e) => selectCircuit(e.target.value)} className="bg-zinc-800 rounded px-2 py-1">
                {circuitsByName.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.id})</option>
                ))}
              </select>
              <span className="text-xs text-zinc-500">ring {circuit.ringLength} m · click the track to set the <b className="text-zinc-200">{active}</b> point</span>
              <div className="flex gap-1 ml-auto">
                <button onClick={() => setActive("start")} className={`px-2 py-1 rounded text-sm ${active === "start" ? "bg-zinc-100 text-zinc-900" : "bg-zinc-800"}`}>start</button>
                <button onClick={() => setActive("end")} className={`px-2 py-1 rounded text-sm ${active === "end" ? "bg-zinc-100 text-zinc-900" : "bg-zinc-800"}`}>end</button>
              </div>
            </div>
            <div className="max-w-[720px] mx-auto">
              <CircuitSvg
                circuit={circuit}
                size={720}
                ticks={250}
                highlight={{ start, end }}
                baseColor="#71717a"
                onPick={(d) => (active === "start" ? setStart(d) : setEnd(d))}
              />
            </div>
          </section>

          <aside className="space-y-4">
            <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4 space-y-3">
              <div className="flex items-center gap-3">
                <GlyphPreview glyph={glyph} />
                <div className="text-sm space-y-1">
                  <div className="text-4xl font-black">{letter}</div>
                  {glyph && <div className="text-zinc-400">width {glyph.width.toFixed(2)} · {Math.round(Math.abs(end - start) > 0 ? (end >= start ? end - start : circuit.ringLength - start + end) : 0)} m</div>}
                  {error && <div className="text-red-400 text-xs">{error}</div>}
                </div>
              </div>
              <label className="block text-sm">Letter
                <select value={letter} onChange={(e) => setLetter(e.target.value)} className="ml-2 bg-zinc-800 rounded px-2 py-1">
                  {ALPHABET.map((l) => <option key={l}>{l}</option>)}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <label>Start (m)
                  <input type="number" value={Math.round(start)} onChange={(e) => setStart(Number(e.target.value))} className="w-full bg-zinc-800 rounded px-2 py-1" />
                </label>
                <label>End (m)
                  <input type="number" value={Math.round(end)} onChange={(e) => setEnd(Number(e.target.value))} className="w-full bg-zinc-800 rounded px-2 py-1" />
                </label>
              </div>
              <label className="block text-sm">Rotation {rotation}°
                <input type="range" min={-180} max={180} step={5} value={rotation} onChange={(e) => setRotation(Number(e.target.value))} className="w-full" />
              </label>
              <div className="flex gap-4 text-sm">
                <label className="flex items-center gap-1"><input type="checkbox" checked={reverse} onChange={(e) => setReverse(e.target.checked)} /> reverse</label>
                <label className="flex items-center gap-1"><input type="checkbox" checked={flipX} onChange={(e) => setFlipX(e.target.checked)} /> flipX</label>
              </div>
              <label className="block text-sm">Label
                <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Maggotts/Becketts" className="w-full bg-zinc-800 rounded px-2 py-1" />
              </label>
              <button
                disabled={!glyph}
                onClick={() => setAdded((a) => [...a, draft])}
                className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-40 rounded py-2 font-semibold"
              >
                Add section
              </button>
            </div>

            <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-semibold">New entries ({added.length})</h2>
                <button onClick={copy} disabled={!added.length} className="text-sm px-2 py-1 bg-zinc-800 rounded disabled:opacity-40">{copied ? "Copied" : "Copy JSON"}</button>
              </div>
              <ul className="text-xs space-y-1 max-h-60 overflow-auto">
                {added.map((s, i) => (
                  <li key={s.id + i} className="flex justify-between gap-2">
                    <span><b>{s.letter}</b> {s.circuitId} {s.start}→{s.end}{s.reverse ? " rev" : ""} rot{s.rotation}{s.flipX ? " flip" : ""}</span>
                    <button onClick={() => setAdded((a) => a.filter((_, j) => j !== i))} className="text-zinc-500 hover:text-red-400">remove</button>
                  </li>
                ))}
              </ul>
              <pre className="mt-2 text-[10px] text-zinc-500 max-h-40 overflow-auto">{JSON.stringify(added, null, 1)}</pre>
            </div>

            <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
              <h2 className="font-semibold mb-2">Existing for {letter}</h2>
              <ul className="text-xs space-y-1">
                {all.filter((s) => s.letter === letter).map((s) => (
                  <li key={s.id}>
                    <button className="hover:underline" onClick={() => { setCircuitId(s.circuitId); setStart(s.start); setEnd(s.end); setReverse(s.reverse); setRotation(s.rotation); setFlipX(s.flipX); setLabel(s.label ?? ""); }}>
                      {s.circuitId} {s.start}→{s.end} {s.label ?? ""}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}
