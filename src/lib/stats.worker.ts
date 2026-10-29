// Heavy statistics off the main thread: pair analysis (permutations, bootstrap, LISA) and the full matrix.
import { analysePair, benjaminiHochberg, effectiveN, knnWeights, moranI, pairsOf, pearson, pFromR, type Num } from './stats';

export type Req =
  | { id: number; kind: 'pair'; x: Num[]; y: Num[]; coords: [number, number][]; control?: Num[] }
  | { id: number; kind: 'matrix'; keys: string[]; cols: Num[][]; coords: [number, number][] };

export interface MatrixCell { r: number; n: number; nEff: number; p: number; q: number }

self.onmessage = (e: MessageEvent<Req>) => {
  const m = e.data;
  if (m.kind === 'pair') {
    const res = analysePair({ x: m.x, y: m.y, coords: m.coords, control: m.control, seed: 20261029 });
    (self as unknown as Worker).postMessage({ id: m.id, res });
    return;
  }
  // matrix: Moran's I per variable once, on the units where it is defined
  const k = m.keys.length;
  const moran = m.cols.map(col => {
    const { xs, idx } = pairsOf(col, col);
    return xs.length > 5 ? moranI(xs, knnWeights(idx.map(i => m.coords[i]), 6)) : 0;
  });
  const cells: (MatrixCell | null)[][] = Array.from({ length: k }, () => Array(k).fill(null));
  const flat: { i: number; j: number; p: number }[] = [];
  for (let i = 0; i < k; i++) for (let j = i + 1; j < k; j++) {
    const { xs, ys } = pairsOf(m.cols[i], m.cols[j]);
    if (xs.length < 6) continue;
    const r = pearson(xs, ys);
    if (!isFinite(r)) continue;
    const nEff = effectiveN(xs.length, moran[i], moran[j]);
    const p = pFromR(r, nEff);
    cells[i][j] = cells[j][i] = { r, n: xs.length, nEff, p, q: 1 };
    flat.push({ i, j, p });
  }
  const q = benjaminiHochberg(flat.map(f => f.p));
  flat.forEach((f, t) => { cells[f.i][f.j]!.q = q[t]; });
  (self as unknown as Worker).postMessage({ id: m.id, cells, moran });
};
