import qrcode from "qrcode-generator";

/*
 * QR codes for the attribution row: one <path> per code so a style can fill or stroke it in its
 * own ink. Medium error correction, four modules of quiet zone, cached per URL because the four
 * gallery thumbnails and the preview all ask for the same code.
 */

export const QUIET_ZONE = 4;

export interface QrMatrix {
  /** Modules per side, without the quiet zone. */
  size: number;
  dark: (row: number, col: number) => boolean;
}

const cache = new Map<string, QrMatrix>();

/** The module matrix for a URL (type picked automatically, level M). */
export function qrMatrix(url: string): QrMatrix {
  const hit = cache.get(url);
  if (hit) return hit;
  const q = qrcode(0, "M");
  q.addData(url);
  q.make();
  const size = q.getModuleCount();
  const cells: boolean[] = [];
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) cells.push(q.isDark(r, c));
  const m: QrMatrix = { size, dark: (r, c) => cells[r * size + c] };
  cache.set(url, m);
  return m;
}

export interface QrPathOptions {
  /** Each dark module is drawn this fraction of a cell wide, centred; 1 is solid, ~0.84 reads as engraved dots and still scans. */
  inset?: number;
}

export interface QrPath {
  /** Path data for the dark modules, in a `side` × `side` box whose origin is the top-left of the quiet zone. */
  d: string;
  /** Size of one module in the box. */
  cell: number;
  modules: number;
}

/** One path of all dark modules, scaled so the code plus its quiet zone fills a `side` px square at (x, y). */
export function qrPath(url: string, side: number, x = 0, y = 0, o: QrPathOptions = {}): QrPath {
  const m = qrMatrix(url);
  const total = m.size + 2 * QUIET_ZONE;
  const cell = side / total;
  const k = Math.min(1, Math.max(0.5, o.inset ?? 1));
  const w = cell * k;
  const pad = (cell - w) / 2;
  const r = (n: number) => Math.round(n * 100) / 100;
  const parts: string[] = [];
  for (let row = 0; row < m.size; row++) {
    for (let col = 0; col < m.size; col++) {
      if (!m.dark(row, col)) continue;
      const px = x + (col + QUIET_ZONE) * cell + pad;
      const py = y + (row + QUIET_ZONE) * cell + pad;
      parts.push(`M${r(px)} ${r(py)}h${r(w)}v${r(w)}h${r(-w)}z`);
    }
  }
  return { d: parts.join(""), cell, modules: m.size };
}
