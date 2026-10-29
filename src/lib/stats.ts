// Statistics engine. Pure functions, no DOM, so they run in the page and in the worker.
// References are listed in the method page (src/pages/Method.tsx).

export type Num = number | null | undefined;

// ---------- special functions ----------
function lgamma(x: number): number {
  const p = [676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x);
  x -= 1;
  let a = 0.99999999999980993;
  const t = x + 7.5;
  for (let i = 0; i < 8; i++) a += p[i] / (x + i + 1);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

function betacf(x: number, a: number, b: number): number {
  let c = 1, d = 1 - (a + b) * x / (a + 1);
  if (Math.abs(d) < 1e-30) d = 1e-30;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 300; m++) {
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((a + m2 - 1) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d; h *= d * c;
    aa = -(a + m) * (a + b + m) * x / ((a + m2) * (a + m2 + 1));
    d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    const del = d * c; h *= del;
    if (Math.abs(del - 1) < 1e-12) break;
  }
  return h;
}

/** Regularized incomplete beta I_x(a,b). */
export function ibeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? bt * betacf(x, a, b) / a : 1 - bt * betacf(1 - x, b, a) / b;
}

/** Two-sided p-value of Student t with df degrees of freedom. */
export function tTwoSided(t: number, df: number): number {
  if (!isFinite(t) || df <= 0) return NaN;
  return ibeta(df / (df + t * t), df / 2, 0.5);
}

/** p-value of a correlation coefficient r with n (possibly effective) observations. */
export function pFromR(r: number, n: number): number {
  if (n <= 2) return NaN;
  const rr = Math.min(0.999999, Math.abs(r));
  return tTwoSided(rr * Math.sqrt((n - 2) / (1 - rr * rr)), n - 2);
}

// ---------- basics ----------
export function pairsOf(x: Num[], y: Num[]): { xs: number[]; ys: number[]; idx: number[] } {
  const xs: number[] = [], ys: number[] = [], idx: number[] = [];
  for (let i = 0; i < x.length; i++) {
    const a = x[i], b = y[i];
    if (a != null && b != null && isFinite(a) && isFinite(b)) { xs.push(a); ys.push(b); idx.push(i); }
  }
  return { xs, ys, idx };
}

export const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;

export function sd(a: number[]): number {
  const m = mean(a);
  return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1));
}

export function pearson(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 3) return NaN;
  const mx = mean(xs), my = mean(ys);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx, dy = ys[i] - my;
    sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
  }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : NaN;
}

/** Average ranks, ties get the mean of their positions (unlike level 1, which ranked ties by first index). */
export function ranks(a: number[]): number[] {
  const order = a.map((v, i) => [v, i] as const).sort((p, q) => p[0] - q[0]);
  const r = new Array<number>(a.length);
  for (let i = 0; i < order.length;) {
    let j = i;
    while (j + 1 < order.length && order[j + 1][0] === order[i][0]) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) r[order[k][1]] = avg;
    i = j + 1;
  }
  return r;
}

export const spearman = (xs: number[], ys: number[]) => pearson(ranks(xs), ranks(ys));

export function fisherCI(r: number, n: number, z = 1.959964): [number, number] {
  if (n <= 3 || !isFinite(r)) return [NaN, NaN];
  const f = Math.atanh(Math.max(-0.999999, Math.min(0.999999, r))), se = 1 / Math.sqrt(n - 3);
  return [Math.tanh(f - z * se), Math.tanh(f + z * se)];
}

export interface Regression { slope: number; intercept: number; r2: number; seSlope: number; resid: number[] }

export function ols(xs: number[], ys: number[]): Regression {
  const n = xs.length, mx = mean(xs), my = mean(ys);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2; }
  const slope = sxx ? sxy / sxx : 0, intercept = my - slope * mx;
  const resid = ys.map((y, i) => y - (intercept + slope * xs[i]));
  const sse = resid.reduce((s, v) => s + v * v, 0);
  return { slope, intercept, r2: syy ? 1 - sse / syy : 0, seSlope: n > 2 && sxx ? Math.sqrt(sse / (n - 2) / sxx) : NaN, resid };
}

/** Partial correlation of x and y controlling for z (residual method). */
export function partial(xs: number[], ys: number[], zs: number[]): number {
  return pearson(ols(zs, xs).resid, ols(zs, ys).resid);
}

// ---------- randomness (seeded, so results are reproducible) ----------
export function rng(seed = 20261029) {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(a: T[], rand: () => number): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Permutation test for Pearson r: share of shuffles at least as extreme (Phipson & Smyth 2010 correction). */
export function permutationP(xs: number[], ys: number[], perms = 999, seed?: number): number {
  const r0 = Math.abs(pearson(xs, ys));
  if (!isFinite(r0)) return NaN;
  const rand = rng(seed), yy = ys.slice();
  let hit = 0;
  for (let k = 0; k < perms; k++) if (Math.abs(pearson(xs, shuffle(yy, rand))) >= r0 - 1e-12) hit++;
  return (hit + 1) / (perms + 1);
}

/** Bootstrap percentile CI for Pearson r. */
export function bootstrapCI(xs: number[], ys: number[], reps = 999, seed?: number): [number, number] {
  const n = xs.length, rand = rng(seed), out: number[] = [];
  const bx = new Array<number>(n), by = new Array<number>(n);
  for (let k = 0; k < reps; k++) {
    for (let i = 0; i < n; i++) { const j = Math.floor(rand() * n); bx[i] = xs[j]; by[i] = ys[j]; }
    const r = pearson(bx, by);
    if (isFinite(r)) out.push(r);
  }
  out.sort((a, b) => a - b);
  return [out[Math.floor(0.025 * out.length)], out[Math.min(out.length - 1, Math.floor(0.975 * out.length))]];
}

/** Leave-one-out range of r and the unit whose removal moves r the most. */
export function jackknife(xs: number[], ys: number[]): { min: number; max: number; mostInfluential: number; shift: number } {
  const r0 = pearson(xs, ys);
  let min = Infinity, max = -Infinity, mi = -1, shift = 0;
  for (let i = 0; i < xs.length; i++) {
    const r = pearson(xs.filter((_, k) => k !== i), ys.filter((_, k) => k !== i));
    if (!isFinite(r)) continue;
    min = Math.min(min, r); max = Math.max(max, r);
    if (Math.abs(r - r0) > shift) { shift = Math.abs(r - r0); mi = i; }
  }
  return { min, max, mostInfluential: mi, shift };
}

// ---------- spatial ----------
/** Row-standardised k-nearest-neighbour weights on unit centroids (lng/lat, distances in local metres). */
export function knnWeights(coords: [number, number][], k = 6): number[][] {
  const lat0 = coords.reduce((s, c) => s + c[1], 0) / coords.length;
  const kx = 111320 * Math.cos(lat0 * Math.PI / 180), ky = 110540;
  const P = coords.map(([x, y]) => [x * kx, y * ky]);
  return P.map((p, i) => {
    const d = P.map((q, j) => [j, Math.hypot(p[0] - q[0], p[1] - q[1])] as const).filter(([j]) => j !== i).sort((a, b) => a[1] - b[1]);
    return d.slice(0, Math.min(k, d.length)).map(([j]) => j);
  });
}

const z = (a: number[]) => { const m = mean(a), s = Math.sqrt(a.reduce((t, v) => t + (v - m) ** 2, 0) / a.length) || 1; return a.map(v => (v - m) / s); };

/** Global Moran's I with row-standardised neighbour lists. */
export function moranI(a: number[], nb: number[][]): number {
  const zs = z(a);
  let num = 0, den = 0;
  for (let i = 0; i < zs.length; i++) {
    if (!nb[i].length) continue;
    const lag = nb[i].reduce((s, j) => s + zs[j], 0) / nb[i].length;
    num += zs[i] * lag;
  }
  for (const v of zs) den += v * v;
  return num / den;
}

/**
 * Effective sample size under spatial autocorrelation (Clifford, Richardson & Hemon 1989,
 * first-order approximation used by Dutilleul 1993): n' = n (1 - Ix Iy) / (1 + Ix Iy), bounded to [3, n].
 */
export function effectiveN(n: number, ix: number, iy: number): number {
  const p = Math.max(0, ix) * Math.max(0, iy);
  return Math.max(3, Math.min(n, n * (1 - p) / (1 + p)));
}

export type Cluster = 'HH' | 'LL' | 'HL' | 'LH' | 'ns';

/** Bivariate local Moran (Anselin 2003): x at i against the spatial lag of y, conditional permutation p. */
export function bivariateLISA(xs: number[], ys: number[], nb: number[][], perms = 199, alpha = 0.05, seed?: number): { I: number[]; p: number[]; cluster: Cluster[] } {
  const zx = z(xs), zy = z(ys), n = xs.length, rand = rng(seed);
  const I: number[] = [], p: number[] = [], cluster: Cluster[] = [];
  for (let i = 0; i < n; i++) {
    const k = nb[i].length;
    if (!k) { I.push(0); p.push(1); cluster.push('ns'); continue; }
    const lag = nb[i].reduce((s, j) => s + zy[j], 0) / k;
    const Ii = zx[i] * lag;
    const others = zy.filter((_, j) => j !== i);
    let hit = 0;
    for (let t = 0; t < perms; t++) {
      let s = 0;
      for (let m = 0; m < k; m++) s += others[Math.floor(rand() * others.length)];
      if (Math.abs(zx[i] * s / k) >= Math.abs(Ii)) hit++;
    }
    const pi = (hit + 1) / (perms + 1);
    I.push(Ii); p.push(pi);
    cluster.push(pi > alpha ? 'ns' : zx[i] >= 0 && lag >= 0 ? 'HH' : zx[i] < 0 && lag < 0 ? 'LL' : zx[i] >= 0 ? 'HL' : 'LH');
  }
  return { I, p, cluster };
}

// ---------- multiple testing ----------
/** Benjamini-Hochberg adjusted q-values. */
export function benjaminiHochberg(ps: number[]): number[] {
  const m = ps.length, order = ps.map((p, i) => [p, i] as const).sort((a, b) => a[0] - b[0]);
  const q = new Array<number>(m);
  let prev = 1;
  for (let k = m - 1; k >= 0; k--) {
    const [p, i] = order[k];
    prev = Math.min(prev, (p * m) / (k + 1));
    q[i] = Math.min(1, prev);
  }
  return q;
}

// ---------- the full analysis of one pair ----------
export interface PairInput { x: Num[]; y: Num[]; coords: [number, number][]; control?: Num[]; seed?: number; fast?: boolean }

export interface PairResult {
  n: number; idx: number[];
  r: number; rho: number; p: number; pPerm: number; ci: [number, number]; ciBoot: [number, number];
  moranX: number; moranY: number; nEff: number; pSpatial: number;
  reg: Regression; jack: ReturnType<typeof jackknife>;
  partialR: number | null; partialP: number | null;
  lisa: ReturnType<typeof bivariateLISA> | null;
}

export function analysePair({ x, y, coords, control, seed, fast }: PairInput): PairResult | null {
  const { xs, ys, idx } = pairsOf(x, y);
  const n = xs.length;
  if (n < 5) return null;
  const r = pearson(xs, ys);
  if (!isFinite(r)) return null;
  const nb = knnWeights(idx.map(i => coords[i]), n > 200 ? 6 : n > 50 ? 6 : 4);
  const moranX = moranI(xs, nb), moranY = moranI(ys, nb);
  const nEff = effectiveN(n, moranX, moranY);
  let partialR: number | null = null, partialP: number | null = null;
  if (control) {
    const keep = idx.map((i, k) => [k, control[i]] as const).filter(([, c]) => c != null && isFinite(c as number));
    if (keep.length >= 6) {
      const px = keep.map(([k]) => xs[k]), py = keep.map(([k]) => ys[k]), pz = keep.map(([, c]) => c as number);
      partialR = partial(px, py, pz);
      partialP = isFinite(partialR) ? pFromR(partialR, keep.length - 1) : null;
    }
  }
  return {
    n, idx, r, rho: spearman(xs, ys), p: pFromR(r, n),
    pPerm: fast ? NaN : permutationP(xs, ys, 999, seed),
    ci: fisherCI(r, n), ciBoot: fast ? [NaN, NaN] : bootstrapCI(xs, ys, 999, seed),
    moranX, moranY, nEff, pSpatial: pFromR(r, nEff),
    reg: ols(xs, ys), jack: jackknife(xs, ys),
    partialR, partialP,
    lisa: fast ? null : bivariateLISA(xs, ys, nb, 199, 0.05, seed),
  };
}

// ---------- reliability ----------
export interface ReliabilityPart { key: string; label: string; score: number; note: string }

/**
 * A 0-100 reliability index: the weakest checks pull it down.
 * Each part is scored 0-1; the index is a weighted geometric mean so that one failed check cannot be hidden by others.
 */
export function reliability(res: PairResult, scale?: { r: number; label: string }[]): { score: number; parts: ReliabilityPart[] } {
  const parts: ReliabilityPart[] = [];
  const clamp = (v: number) => Math.max(0.02, Math.min(1, v));
  parts.push({ key: 'sig', label: 'מובהקות מרחבית', score: clamp(res.pSpatial < 0.01 ? 1 : res.pSpatial < 0.05 ? 0.8 : res.pSpatial < 0.1 ? 0.45 : 0.15),
    note: `p מתוקן לאוטוקורלציה = ${fmtP(res.pSpatial)} (n אפקטיבי ${res.nEff.toFixed(0)} מתוך ${res.n})` });
  parts.push({ key: 'n', label: 'גודל מדגם אפקטיבי', score: clamp(res.nEff / 30),
    note: res.nEff >= 30 ? 'מספיק יחידות בלתי תלויות' : `רק כ-${res.nEff.toFixed(0)} יחידות בלתי תלויות. הרחבה לקנה מידה עדין יותר תחזק` });
  const w = Math.abs(res.ci[1] - res.ci[0]);
  parts.push({ key: 'ci', label: 'צרות רווח הסמך', score: clamp(1 - w / 1.2), note: `רווח סמך 95%: ${fr(res.ci[0])} עד ${fr(res.ci[1])}` });
  const agree = Math.abs(res.r - res.rho);
  parts.push({ key: 'mono', label: 'הסכמה בין Pearson ל-Spearman', score: clamp(1 - agree / 0.4),
    note: agree < 0.1 ? 'הקשר יציב גם בדירוגים, לא נשען על ערכים קיצוניים' : `פער ${fr(agree)}: ייתכן קשר לא ליניארי או ערכים חריגים` });
  parts.push({ key: 'jack', label: 'יציבות להוצאת יחידה', score: clamp(1 - res.jack.shift / 0.25),
    note: `הוצאת יחידה אחת מזיזה את r עד ${fr(res.jack.shift)}` });
  if (scale && scale.length > 1) {
    const signs = new Set(scale.map(s => Math.sign(s.r)));
    const spread = Math.max(...scale.map(s => s.r)) - Math.min(...scale.map(s => s.r));
    parts.push({ key: 'scale', label: 'עקביות בין קני מידה', score: clamp(signs.size > 1 ? 0.15 : 1 - spread / 0.6),
      note: scale.map(s => `${s.label} ${fr(s.r)}`).join(' · ') + (signs.size > 1 ? ' · הכיוון מתהפך: בעיית יחידת שטח (MAUP)' : '') });
  }
  const wts: Record<string, number> = { sig: 1.4, n: 0.8, ci: 1, mono: 0.8, jack: 0.9, scale: 1.1 };
  let sw = 0, sl = 0;
  for (const p of parts) { const wt = wts[p.key] ?? 1; sw += wt; sl += wt * Math.log(p.score); }
  return { score: Math.round(100 * Math.exp(sl / sw)), parts };
}

/** Left-to-right isolate, so a minus sign or "<" stays in place inside Hebrew text. */
export const iso = (s: string) => `\u2066${s}\u2069`;

/** A coefficient with its sign, isolated for RTL text. */
export const fr = (x: number | null | undefined, d = 2, sign = false) =>
  x == null || !isFinite(x) ? 'לא זמין' : iso(`${sign && x >= 0 ? '+' : ''}${x.toFixed(d)}`);

export function fmtP(p: number | null | undefined): string {
  if (p == null || !isFinite(p)) return 'לא זמין';
  if (p < 0.001) return iso('<0.001');
  return iso(p.toFixed(3));
}

export function strengthHe(r: number): string {
  const a = Math.abs(r);
  return a >= 0.7 ? 'חזק מאוד' : a >= 0.5 ? 'חזק' : a >= 0.3 ? 'בינוני' : a >= 0.1 ? 'חלש' : 'זניח';
}
