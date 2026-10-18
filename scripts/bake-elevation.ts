/**
 * Build-time script: reads data/raw/f1-circuits.geojson, projects each circuit to local metres,
 * resamples at a uniform step, fetches per-vertex elevation from Open Topo Data (SRTM 30 m),
 * and writes data/circuits.json. Resumable: circuits already present in the output are skipped.
 *
 * Usage: npm run data:bake            (all circuits)
 *        npm run data:bake -- be-1925 (one circuit, force refresh)
 */
import fs from "node:fs";
import path from "node:path";
import { closeRing, localToLonLat, lonLatToLocal, resample } from "../src/lib/geo/project";
import type { Circuit } from "../src/lib/geo/types";

const STEP = 10;
const RAW = path.resolve("data/raw/f1-circuits.geojson");
const LOCATIONS = path.resolve("data/raw/f1-locations.json");
const OUT = path.resolve("data/circuits.json");
const API = "https://api.opentopodata.org/v1/srtm30m";

interface Feature {
  properties: {
    id: string;
    Location: string;
    Name: string;
    opened: number;
    firstgp: number;
    length: number;
    altitude: number;
  };
  geometry: { type: string; coordinates: [number, number][] };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchElevations(coords: [number, number][]): Promise<number[]> {
  const out: number[] = [];
  for (let i = 0; i < coords.length; i += 100) {
    const batch = coords.slice(i, i + 100);
    const locations = batch.map(([lon, lat]) => `${lat.toFixed(6)},${lon.toFixed(6)}`).join("|");
    let attempt = 0;
    for (;;) {
      const res = await fetch(`${API}?locations=${locations}`);
      if (res.ok) {
        const json = (await res.json()) as { results: { elevation: number | null }[] };
        out.push(...json.results.map((r) => r.elevation ?? 0));
        break;
      }
      attempt++;
      if (attempt > 5) throw new Error(`Elevation API failed: ${res.status} ${await res.text()}`);
      await sleep(2000 * attempt);
    }
    await sleep(1100);
  }
  return out;
}

async function main() {
  const only = process.argv[2];
  const geo = JSON.parse(fs.readFileSync(RAW, "utf8")) as { features: Feature[] };
  const locations = JSON.parse(fs.readFileSync(LOCATIONS, "utf8")) as { id: string }[];
  const existing: Circuit[] = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : [];
  const byId = new Map(existing.map((c) => [c.id, c]));

  for (const f of geo.features) {
    const id = f.properties.id;
    if (only ? id !== only : byId.has(id)) continue;
    const coords = f.geometry.coordinates;
    const lon0 = coords.reduce((s, c) => s + c[0], 0) / coords.length;
    const lat0 = coords.reduce((s, c) => s + c[1], 0) / coords.length;
    const local = closeRing(lonLatToLocal(coords));
    const flat = resample(
      local.map((p) => ({ ...p, z: 0 })),
      STEP,
    );
    const lonlat = localToLonLat(flat, lon0, lat0);
    process.stdout.write(`${id}: ${flat.length} points, fetching elevation... `);
    const z = await fetchElevations(lonlat);
    // Close the ring exactly in z too.
    z[z.length - 1] = z[0];
    const circuit: Circuit = {
      id,
      name: f.properties.Name,
      location: f.properties.Location,
      country: id.split("-")[0].toUpperCase(),
      opened: f.properties.opened,
      firstgp: f.properties.firstgp,
      length: f.properties.length,
      ringLength: Math.round(flat[flat.length - 1].dist * 10) / 10,
      step: STEP,
      points: flat.map((p, i) => [
        Math.round(p.x * 10) / 10,
        Math.round(p.y * 10) / 10,
        Math.round(z[i] * 10) / 10,
        Math.round(p.dist * 10) / 10,
      ]),
    };
    byId.set(id, circuit);
    const order = locations.map((l) => l.id);
    const all = [...byId.values()].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    fs.writeFileSync(OUT, JSON.stringify(all));
    console.log(`done (ring ${circuit.ringLength} m, official ${circuit.length} m)`);
  }
  console.log(`Wrote ${byId.size} circuits to ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
