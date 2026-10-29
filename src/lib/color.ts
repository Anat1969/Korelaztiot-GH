// Colour scales. Bivariate palette after Joshua Stevens (3x3), LISA colours after GeoDa.
import type { Cluster } from './stats';

export const BIVAR = [
  // rows: y low -> high, columns: x low -> high
  ['#e8e8e8', '#e4acac', '#c85a5a'],
  ['#b0d5df', '#ad9ea5', '#985356'],
  ['#64acbe', '#627f8c', '#574249'],
];

export const LISA: Record<Cluster, string> = { HH: '#c8382c', LL: '#2f6fa8', HL: '#efa596', LH: '#9cc2e6', ns: '#d9dcde' };
export const LISA_NAME: Record<Cluster, string> = {
  HH: 'גבוה ליד גבוה', LL: 'נמוך ליד נמוך', HL: 'גבוה ליד נמוך', LH: 'נמוך ליד גבוה', ns: 'לא מובהק',
};

/** Tercile breaks of the non-null values. */
export function terciles(vals: (number | null)[]): [number, number] {
  const v = vals.filter((x): x is number => x != null && isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return [0, 0];
  return [v[Math.floor(v.length / 3)], v[Math.floor((2 * v.length) / 3)]];
}

const cls = (x: number, [a, b]: [number, number]) => (x <= a ? 0 : x <= b ? 1 : 2);

export function bivariateColors(xs: (number | null)[], ys: (number | null)[]): (string | null)[] {
  const tx = terciles(xs), ty = terciles(ys);
  return xs.map((x, i) => {
    const y = ys[i];
    return x == null || y == null ? null : BIVAR[cls(y, ty)][cls(x, tx)];
  });
}

// sequential ramp: pale stone to deep ink-teal, perceptually even enough for 7 steps
const RAMP = ['#f3efe6', '#e0e3c8', '#b9d3b0', '#86bba4', '#5a9c9a', '#3c7a8c', '#2b5672', '#1f3352'];

export function quantileColors(vals: (number | null)[], ramp = RAMP): (string | null)[] {
  const v = vals.filter((x): x is number => x != null && isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return vals.map(() => null);
  const k = ramp.length;
  const breaks = Array.from({ length: k - 1 }, (_, i) => v[Math.floor(((i + 1) * v.length) / k)]);
  return vals.map(x => {
    if (x == null || !isFinite(x)) return null;
    let i = 0;
    while (i < breaks.length && x > breaks[i]) i++;
    return ramp[i];
  });
}
export const SEQ_RAMP = RAMP;

/** Rank-normalised 0..1 heights for the 3D view. */
export function rankHeights(vals: (number | null)[]): (number | null)[] {
  const idx = vals.map((v, i) => [v, i] as const).filter(([v]) => v != null && isFinite(v as number)).sort((a, b) => (a[0] as number) - (b[0] as number));
  const out: (number | null)[] = vals.map(() => null);
  idx.forEach(([, i], k) => { out[i] = 0.06 + (0.94 * k) / Math.max(1, idx.length - 1); });
  return out;
}

/** Diverging colour for a correlation coefficient. */
export function rColor(r: number, alpha = 1): string {
  if (!isFinite(r)) return 'transparent';
  const a = Math.min(1, Math.abs(r));
  const [h, s] = r >= 0 ? [12, 68] : [205, 62];
  const l = 96 - a * 52;
  return `hsl(${h} ${s}% ${l}% / ${alpha})`;
}
