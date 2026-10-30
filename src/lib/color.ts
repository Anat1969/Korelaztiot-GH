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

export function quantileColors(vals: (number | null)[], ramp = RAMP, base: (number | null)[] = vals): (string | null)[] {
  const v = base.filter((x): x is number => x != null && isFinite(x)).sort((a, b) => a - b);
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

// ---------- topic colours: each subject keeps its own hue, shown as a monochrome scale ----------
export const TOPIC: Record<string, { hue: string; name: string }> = {
  heat: { hue: '#b8382a', name: 'חום' }, green: { hue: '#2f7d4a', name: 'צמחייה' }, built: { hue: '#7a5236', name: 'בינוי' },
  move: { hue: '#4a4f96', name: 'תנועה' }, service: { hue: '#a0662a', name: 'שירותים' }, edu: { hue: '#2f6fa8', name: 'חינוך' },
  plan: { hue: '#7a4f86', name: 'תכנון' }, water: { hue: '#2b6f9e', name: 'ים ומים' },
};
const TOPIC_OF: Record<string, string> = {
  lst: 'heat', lst_p90: 'heat', ndvi: 'green', green_cover: 'green', park_share: 'green', green_access: 'green',
  ndbi: 'built', bld_density: 'built', bld_coverage: 'built', bld_footprint: 'built',
  road_density: 'move', walk_density: 'move', intersections: 'move', bus_access: 'move', bus_density: 'move',
  poi_density: 'service', food_density: 'service', retail_density: 'service', health_density: 'service',
  kinder_density: 'edu', kinder_access: 'edu', school_density: 'edu', early_density: 'edu',
  renewal_projects: 'plan', renewal_units: 'plan', plan_density: 'plan', shimur_count: 'plan',
  dist_water: 'water', area: 'built',
};
export const topicOf = (key: string) => TOPIC[TOPIC_OF[key] ?? 'built'];

const hex = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const toHex = (c: number[]) => '#' + c.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
const mix = (a: string, b: string, t: number) => { const A = hex(a), B = hex(b); return toHex(A.map((v, i) => v + (B[i] - v) * t)); };
const PAPER = '#f2f0eb';

/** Seven-step monochrome scale of a topic: architectural paper to the topic hue, then a little deeper. */
export function topicRamp(key: string): string[] {
  const h = topicOf(key).hue;
  return [0.06, 0.2, 0.36, 0.52, 0.68, 0.84, 1].map((t, i) => (i === 6 ? mix(h, '#000000', 0.2) : mix(PAPER, h, t)));
}

/** Bivariate 3x3 palette of two topics: x hue grows to the right, y hue grows upward, both together blend. */
export function bivarPalette(xKey: string, yKey: string): string[][] {
  const hx = hex(topicOf(xKey).hue), hy = hex(topicOf(yKey).hue), p = hex(PAPER);
  return [0, 1, 2].map(r => [0, 1, 2].map(c => {
    const tx = c / 2 * 0.85, ty = r / 2 * 0.85;
    // multiply blend of two tints, so "both high" reads as the dark mixture of the two subjects
    const ax = p.map((v, i) => v + (hx[i] - v) * tx), ay = p.map((v, i) => v + (hy[i] - v) * ty);
    return toHex(ax.map((v, i) => (v * ay[i]) / 255));
  }));
}

export function bivariateTopic(xKey: string, yKey: string, xs: (number | null)[], ys: (number | null)[]): (string | null)[] {
  const P = bivarPalette(xKey, yKey), tx = terciles(xs), ty = terciles(ys);
  const c3 = (v: number, [a, b]: [number, number]) => (v <= a ? 0 : v <= b ? 1 : 2);
  return xs.map((x, i) => (x == null || ys[i] == null ? null : P[c3(ys[i]!, ty)][c3(x, tx)]));
}
