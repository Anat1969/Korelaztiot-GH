// Discovery engine: searches the whole catalogue for relations a planner would not look for,
// and turns the strong ones into candidate planning rules. Pure functions, run in the worker.
import { benjaminiHochberg, effectiveN, knnWeights, mean, moranI, ols, pairsOf, partial, pearson, pFromR, rng, spearman, tTwoSided, type Num } from './stats';

// ---------- extra statistics ----------

/** Distance correlation (Székely, Rizzo & Bakirov 2007): zero only under independence, catches non-linear relations. */
export function dcor(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 5) return NaN;
  const center = (v: number[]) => {
    const D = new Float64Array(n * n), row = new Float64Array(n);
    let all = 0;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const d = Math.abs(v[i] - v[j]); D[i * n + j] = d; row[i] += d; all += d; }
    for (let i = 0; i < n; i++) row[i] /= n;
    all /= n * n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) D[i * n + j] = D[i * n + j] - row[i] - row[j] + all;
    return D;
  };
  const A = center(xs), B = center(ys);
  let ab = 0, aa = 0, bb = 0;
  for (let k = 0; k < n * n; k++) { ab += A[k] * B[k]; aa += A[k] * A[k]; bb += B[k] * B[k]; }
  return aa > 0 && bb > 0 ? Math.sqrt(Math.max(0, ab) / Math.sqrt(aa * bb)) : 0;
}

export interface Breakpoint { k: number; below: number; above: number; gain: number; p: number }

/** Hinge regression y = a + b·x + c·max(0, x − k), k searched between the 20th and 80th percentiles. */
export function breakpoint(xs: number[], ys: number[]): Breakpoint | null {
  const n = xs.length;
  if (n < 12) return null;
  const sorted = [...xs].sort((a, b) => a - b);
  const lin = ols(xs, ys), sseLin = lin.resid.reduce((s, v) => s + v * v, 0);
  let best: Breakpoint | null = null, bestSse = Infinity;
  for (let q = 0.2; q <= 0.801; q += 0.05) {
    const k = sorted[Math.floor(q * (n - 1))];
    const h = xs.map(x => Math.max(0, x - k));
    if (h.filter(v => v > 0).length < 4) continue;
    const fit = ols2(xs, h, ys);
    if (!fit) continue;
    if (fit.sse < bestSse) { bestSse = fit.sse; best = { k, below: fit.b1, above: fit.b1 + fit.b2, gain: 0, p: 1 }; }
  }
  if (!best || !(sseLin > 0)) return null;
  best.gain = 1 - bestSse / sseLin;
  // one extra parameter; the search over k makes this p optimistic, so the caller asks for p < 0.01
  const F = ((sseLin - bestSse) / 1) / (bestSse / Math.max(1, n - 3));
  best.p = F > 0 ? tTwoSided(Math.sqrt(F), n - 3) : 1;
  return best;
}

/** OLS with two predictors (and intercept), via the 3x3 normal equations. */
function ols2(x1: number[], x2: number[], y: number[]) {
  const X = x1.map((v, i) => [1, v, x2[i]]);
  const b = solveOLS(X, y);
  if (!b) return null;
  const sse = y.reduce((s, v, i) => s + (v - (b[0] + b[1] * x1[i] + b[2] * x2[i])) ** 2, 0);
  return { b0: b[0], b1: b[1], b2: b[2], sse };
}

/** Solve (XᵀX) b = Xᵀy by Gauss-Jordan with partial pivoting. Returns null when singular. */
export function solveOLS(X: number[][], y: number[]): number[] | null {
  const p = X[0].length;
  const A = Array.from({ length: p }, () => new Array<number>(p + 1).fill(0));
  for (let r = 0; r < X.length; r++) for (let i = 0; i < p; i++) {
    for (let j = 0; j < p; j++) A[i][j] += X[r][i] * X[r][j];
    A[i][p] += X[r][i] * y[r];
  }
  return gaussJordan(A, p);
}

function gaussJordan(A: number[][], p: number): number[] | null {
  for (let c = 0; c < p; c++) {
    let piv = c;
    for (let r = c + 1; r < p; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    if (Math.abs(A[piv][c]) < 1e-12) return null;
    [A[c], A[piv]] = [A[piv], A[c]];
    for (let r = 0; r < p; r++) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      for (let k = c; k <= p; k++) A[r][k] -= f * A[c][k];
    }
  }
  return A.map((row, i) => row[p] / row[i]);
}

/** Inverse of a symmetric matrix (Gauss-Jordan). */
export function invert(M: number[][]): number[][] | null {
  const n = M.length;
  const A = M.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    if (Math.abs(A[piv][c]) < 1e-10) return null;
    [A[c], A[piv]] = [A[piv], A[c]];
    const d = A[c][c];
    for (let k = 0; k < 2 * n; k++) A[c][k] /= d;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = A[r][c];
      for (let k = 0; k < 2 * n; k++) A[r][k] -= f * A[c][k];
    }
  }
  return A.map(row => row.slice(n));
}

/** Mann-Whitney U, normal approximation with tie correction. Returns the two-sided p. */
export function mannWhitney(a: number[], b: number[]): number {
  const all = [...a.map(v => [v, 0] as const), ...b.map(v => [v, 1] as const)].sort((x, y) => x[0] - y[0]);
  const N = all.length, ranks = new Array<number>(N);
  let tie = 0;
  for (let i = 0; i < N;) {
    let j = i;
    while (j + 1 < N && all[j + 1][0] === all[i][0]) j++;
    for (let k = i; k <= j; k++) ranks[k] = (i + j) / 2 + 1;
    const t = j - i + 1; tie += t ** 3 - t;
    i = j + 1;
  }
  const n1 = a.length, n2 = b.length;
  const R1 = all.reduce((s, v, i) => s + (v[1] === 0 ? ranks[i] : 0), 0);
  const U = R1 - (n1 * (n1 + 1)) / 2, mu = (n1 * n2) / 2;
  const sigma = Math.sqrt((n1 * n2 / 12) * ((N + 1) - tie / (N * (N - 1))));
  if (!(sigma > 0)) return 1;
  const zz = Math.abs(U - mu) / sigma;
  return Math.min(1, 2 * (1 - normCdf(zz)));
}

function normCdf(x: number) {
  // Abramowitz & Stegun 7.1.26
  const t = 1 / (1 + 0.3275911 * x / Math.SQRT2);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(x * x) / 2);
  return 0.5 * (1 + y);
}

export const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

export const zscore = (a: number[]) => { const m = mean(a), s = Math.sqrt(a.reduce((t, v) => t + (v - m) ** 2, 0) / Math.max(1, a.length - 1)) || 1; return a.map(v => (v - m) / s); };

// ---------- multiple regression ----------
export interface MultiFit { keys: string[]; beta: number[]; betaStd: number[]; t: number[]; p: number[]; r2: number; adjR2: number; vif: number[]; n: number; predict: (row: number[]) => number; se: number }

export function multiRegression(cols: number[][], y: number[], keys: string[]): MultiFit | null {
  const n = y.length, k = cols.length;
  if (n < k + 5) return null;
  const X = y.map((_, i) => [1, ...cols.map(c => c[i])]);
  const b = solveOLS(X, y);
  if (!b) return null;
  const yhat = X.map(r => r.reduce((s, v, j) => s + v * b[j], 0));
  const sse = y.reduce((s, v, i) => s + (v - yhat[i]) ** 2, 0), my = mean(y);
  const sst = y.reduce((s, v) => s + (v - my) ** 2, 0);
  const sigma2 = sse / Math.max(1, n - k - 1);
  const XtX = Array.from({ length: k + 1 }, (_, i) => Array.from({ length: k + 1 }, (_, j) => X.reduce((s, r) => s + r[i] * r[j], 0)));
  const inv = invert(XtX);
  const seB = inv ? inv.map((row, i) => Math.sqrt(Math.max(0, sigma2 * row[i]))) : b.map(() => NaN);
  const t = b.map((v, i) => v / seB[i]).slice(1);
  const sdY = Math.sqrt(sst / Math.max(1, n - 1));
  const betaStd = cols.map((c, j) => b[j + 1] * Math.sqrt(c.reduce((s, v) => s + (v - mean(c)) ** 2, 0) / Math.max(1, n - 1)) / sdY);
  // VIF from the inverse of the predictors' correlation matrix
  const R = cols.map(a => cols.map(c => pearson(a, c)));
  const Rinv = k > 1 ? invert(R) : [[1]];
  return {
    keys, beta: b.slice(1), betaStd, t, p: t.map(v => tTwoSided(Math.abs(v), n - k - 1)),
    r2: sst ? 1 - sse / sst : 0, adjR2: sst ? 1 - (sse / (n - k - 1)) / (sst / (n - 1)) : 0,
    vif: Rinv ? Rinv.map((row, i) => row[i]) : cols.map(() => NaN), n,
    predict: row => b[0] + row.reduce((s, v, j) => s + v * b[j + 1], 0), se: Math.sqrt(sigma2),
  };
}

/** Partial correlation of every pair given all the others, from the inverse correlation matrix. */
export function partialMatrix(cols: number[][]): number[][] | null {
  const R = cols.map(a => cols.map(c => pearson(a, c)));
  const P = invert(R);
  if (!P) return null;
  return P.map((row, i) => row.map((v, j) => (i === j ? 1 : -v / Math.sqrt(P[i][i] * P[j][j]))));
}

// ---------- typologies ----------
/** k-means on z-scored columns, k-means++ seeding, fixed seed for reproducible typologies. */
export function kmeans(rows: number[][], k: number, seed = 7, iters = 60): { labels: number[]; centers: number[][]; inertia: number } {
  const rand = rng(seed), n = rows.length, d = rows[0].length;
  const dist2 = (a: number[], b: number[]) => a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0);
  const centers: number[][] = [rows[Math.floor(rand() * n)].slice()];
  while (centers.length < k) {
    const ds = rows.map(r => Math.min(...centers.map(c => dist2(r, c))));
    const tot = ds.reduce((a, b) => a + b, 0);
    let x = rand() * tot, i = 0;
    while (i < n - 1 && (x -= ds[i]) > 0) i++;
    centers.push(rows[i].slice());
  }
  let labels = new Array<number>(n).fill(0);
  for (let it = 0; it < iters; it++) {
    const next = rows.map(r => { let bi = 0, bd = Infinity; centers.forEach((c, j) => { const dd = dist2(r, c); if (dd < bd) { bd = dd; bi = j; } }); return bi; });
    const moved = next.some((l, i) => l !== labels[i]);
    labels = next;
    for (let j = 0; j < k; j++) {
      const mem = rows.filter((_, i) => labels[i] === j);
      if (mem.length) for (let t = 0; t < d; t++) centers[j][t] = mem.reduce((s, r) => s + r[t], 0) / mem.length;
    }
    if (!moved) break;
  }
  return { labels, centers, inertia: rows.reduce((s, r, i) => s + dist2(r, centers[labels[i]]), 0) };
}

// ---------- the discovery scan ----------
export type Kind = 'hidden' | 'threshold' | 'nonlinear' | 'linear';

export interface Discovery {
  x: string; y: string; kind: Kind;
  r: number; rho: number; n: number; nEff: number; pSpatial: number; q: number;
  dcor: number; scales: { key: string; r: number; n: number }[]; consistent: boolean;
  bp: Breakpoint | null;
  hidden: { by: string; partialR: number; p: number } | null;
  /** r after removing the urban-intensity index (built without x and y themselves) */
  beyond: number; pBeyond: number;
  crossFamily: boolean; known: boolean;
  score: number;
}

export interface ScanInput {
  keys: string[];
  families: Record<string, string>;
  known: string[]; // "a|b" sorted pairs with a literature note
  trivial: string[][]; // groups that measure the same thing
  confounders: string[]; // candidate third variables for hidden relations
  urbanKeys: string[]; // components of the "more city" index that is removed from every pair
  /** family order for reading a pair as "driver -> outcome": the earlier family becomes x */
  driverOrder?: string[];
  scales: { key: string; cols: Num[][]; coords: [number, number][] }[]; // first is the primary scale
}

export function scan(inp: ScanInput): Discovery[] {
  const { keys, scales } = inp;
  const prim = scales[0];
  const idx = (k: string) => keys.indexOf(k);
  const moran = prim.cols.map(col => {
    const { xs, idx: ii } = pairsOf(col, col);
    return xs.length > 5 ? moranI(xs, knnWeights(ii.map(i => prim.coords[i]), 6)) : 0;
  });
  const trivial = (a: string, b: string) => inp.trivial.some(g => g.includes(a) && g.includes(b));
  // z-scored urban components on the primary scale; the index for a pair leaves that pair out
  const zcol = (col: Num[]) => {
    const v = col.filter((x): x is number => x != null && isFinite(x));
    const m = mean(v), s = Math.sqrt(v.reduce((t, x) => t + (x - m) ** 2, 0) / Math.max(1, v.length - 1)) || 1;
    return col.map(x => (x == null || !isFinite(x) ? null : (x - m) / s));
  };
  const urbanZ = inp.urbanKeys.filter(k => idx(k) >= 0).map(k => ({ k, z: zcol(prim.cols[idx(k)]) }));
  const urbanity = (skip: string[]) => prim.coords.map((_, u) => {
    const v = urbanZ.filter(c => !skip.includes(c.k)).map(c => c.z[u]).filter((x): x is number => x != null);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  });
  const out: Discovery[] = [];
  const rank = (k: string) => { const r = (inp.driverOrder ?? []).indexOf(inp.families[k]); return r < 0 ? 99 : r; };
  for (let i0 = 0; i0 < keys.length; i0++) for (let j0 = i0 + 1; j0 < keys.length; j0++) {
    // read the pair from driver to outcome, so the breakpoint and the sentence run the right way
    const swap = rank(keys[j0]) < rank(keys[i0]);
    const i = swap ? j0 : i0, j = swap ? i0 : j0;
    const a = keys[i], b = keys[j];
    if (trivial(a, b)) continue;
    if (inp.urbanKeys.includes(a) && inp.urbanKeys.includes(b)) continue;
    const { xs, ys, idx: ii } = pairsOf(prim.cols[i], prim.cols[j]);
    if (xs.length < 12) continue;
    const r = pearson(xs, ys);
    if (!isFinite(r)) continue;
    const nEff = effectiveN(xs.length, moran[i], moran[j]);
    const pSpatial = pFromR(r, nEff);
    const sc = scales.map(s => { const p = pairsOf(s.cols[i], s.cols[j]); return { key: s.key, r: pearson(p.xs, p.ys), n: p.xs.length }; }).filter(s => isFinite(s.r) && s.n >= 8);
    const strong = sc.filter(s => Math.abs(s.r) >= 0.2);
    const consistent = strong.length >= 2 && new Set(strong.map(s => Math.sign(s.r))).size === 1;
    const dc = dcor(xs, ys);
    const bp = breakpoint(xs, ys);
    // hidden: weak raw relation that appears once a third variable is held constant
    let hidden: Discovery['hidden'] = null;
    for (const c of inp.confounders) {
      if (c === a || c === b) continue;
      const ci = idx(c);
      if (ci < 0) continue;
      const rows = ii.map((u, k) => [xs[k], ys[k], prim.cols[ci][u]] as const).filter(t => t[2] != null && isFinite(t[2] as number));
      if (rows.length < 12) continue;
      const pr = partial(rows.map(t => t[0]), rows.map(t => t[1]), rows.map(t => t[2] as number));
      const pp = pFromR(pr, Math.max(4, effectiveN(rows.length, moran[i], moran[j]) - 1));
      if (Math.abs(pr) >= 0.3 && Math.abs(pr) - Math.abs(r) >= 0.2 && pp < 0.05 && (!hidden || Math.abs(pr) > Math.abs(hidden.partialR))) hidden = { by: c, partialR: pr, p: pp };
    }
    const urb = urbanity([a, b]);
    const urows = ii.map((u, k) => [xs[k], ys[k], urb[u]] as const).filter(t => t[2] != null);
    const beyond = urows.length >= 12 ? partial(urows.map(t => t[0]), urows.map(t => t[1]), urows.map(t => t[2] as number)) : r;
    const pBeyond = pFromR(beyond, Math.max(4, nEff - 1));
    if (!hidden && Math.abs(beyond) >= 0.3 && Math.abs(beyond) - Math.abs(r) >= 0.2 && pBeyond < 0.05) hidden = { by: 'urbanity', partialR: beyond, p: pBeyond };
    const crossFamily = inp.families[a] !== inp.families[b];
    const known = inp.known.includes([a, b].sort().join('|'));
    const nonlinear = isFinite(dc) && dc - Math.abs(r) >= 0.15 && dc >= 0.35;
    const kind: Kind = hidden ? 'hidden' : bp && bp.p < 0.01 && bp.gain >= 0.12 && Math.sign(bp.below) !== Math.sign(bp.above) ? 'threshold' : nonlinear ? 'nonlinear' : 'linear';
    out.push({ x: a, y: b, kind: hidden ? 'hidden' : kind, r, rho: spearman(xs, ys), n: xs.length, nEff, pSpatial, q: 1, dcor: dc, scales: sc, consistent, bp, hidden, beyond, pBeyond, crossFamily, known, score: 0 });
  }
  // q-values on the relation that is left after removing urban intensity: that is the claim we rank on
  const q = benjaminiHochberg(out.map(d => (d.kind === 'hidden' ? d.hidden!.p : d.pBeyond)));
  out.forEach((d, t) => {
    d.q = q[t];
    // "more city" explains most raw correlations; what survives its removal is the finding
    const strength = d.kind === 'hidden' ? Math.abs(d.hidden!.partialR)
      : d.kind === 'nonlinear' ? Math.min(d.dcor, Math.abs(d.beyond) + 0.25)
      : d.kind === 'threshold' ? Math.max(Math.abs(d.beyond), d.bp!.gain)
      : Math.abs(d.beyond);
    const evidence = d.q < 0.01 ? 1 : d.q < 0.05 ? 0.8 : d.q < 0.1 ? 0.5 : 0.2;
    const novelty = (d.crossFamily ? 1 : 0.55) * (d.known ? 0.6 : 1) * (d.kind === 'hidden' ? 1.35 : d.kind === 'threshold' ? 1.2 : d.kind === 'nonlinear' ? 1.1 : 1);
    d.score = strength * evidence * novelty * (d.consistent ? 1 : 0.7);
  });
  return out.sort((a, b) => b.score - a.score);
}

/** Group contrast used for "if X is high, Y is ..." rules: median of Y above vs below a split. */
export function contrast(xs: number[], ys: number[], split: number) {
  const hi = ys.filter((_, i) => xs[i] > split), lo = ys.filter((_, i) => xs[i] <= split);
  if (hi.length < 4 || lo.length < 4) return null;
  return { hi: median(hi), lo: median(lo), nHi: hi.length, nLo: lo.length, p: mannWhitney(hi, lo) };
}
