// Reference values: NumPy (distance correlation, least squares) and SciPy (mannwhitneyu, asymptotic, no continuity correction).
import { describe, it, expect } from 'vitest';
import { dcor, mannWhitney, multiRegression, breakpoint, kmeans, partialMatrix, scan } from '../src/lib/discover';

const x = [1, 2, 2, 3, 5, 5, 5, 8, 9, 12, 13, 13];
const y = [2, 1, 4, 3, 7, 6, 6, 9, 8, 15, 11, 14];
const z = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8];

describe('against NumPy and SciPy', () => {
  it('distance correlation', () => expect(dcor(x, y)).toBeCloseTo(0.9577983527583847, 10));
  it('Mann-Whitney with ties', () => expect(mannWhitney([1, 4, 6, 7, 9, 9], [2, 3, 3, 5, 8])).toBeCloseTo(0.27113234956794896, 4));
  it('multiple regression', () => {
    const f = multiRegression([x, z], y, ['x', 'z'])!;
    expect(f.beta[0]).toBeCloseTo(0.938122412442654, 8);
    expect(f.beta[1]).toBeCloseTo(0.11035582410204789, 8);
    expect(f.r2).toBeCloseTo(0.9018557218827532, 8);
  });
});

describe('discovery', () => {
  it('finds a threshold where the slope turns', () => {
    const xs = Array.from({ length: 60 }, (_, i) => i);
    const ys = xs.map((v, i) => (v < 30 ? v : 60 - v) + Math.sin(i * 7.3) * 0.5);
    const bp = breakpoint(xs, ys)!;
    expect(bp.k).toBeGreaterThan(25);
    expect(bp.k).toBeLessThan(35);
    expect(bp.below).toBeGreaterThan(0.8);
    expect(bp.above).toBeLessThan(-0.8);
  });
  it('partial matrix removes a shared driver', () => {
    const d = Array.from({ length: 100 }, (_, i) => Math.sin(i) * 5);
    const a = d.map((v, i) => v + Math.cos(i * 3.1)), b = d.map((v, i) => v + Math.sin(i * 2.2));
    const P = partialMatrix([a, b, d])!;
    expect(Math.abs(P[0][1])).toBeLessThan(0.25);
  });
  it('k-means is reproducible', () => {
    const rows = Array.from({ length: 40 }, (_, i) => [i < 20 ? 0 : 5, (i % 7) * 0.1]);
    const a = kmeans(rows, 2), b = kmeans(rows, 2);
    expect(a.labels).toEqual(b.labels);
    expect(new Set(a.labels.slice(0, 20)).size).toBe(1);
  });
  it('flags a hidden relation that a third variable masks', () => {
    // y = -x + 2c, x = c + e with var(c) = var(e): raw relation near zero, partial close to -1
    const n = 80, coords: [number, number][] = [];
    const c = Array.from({ length: n }, (_, i) => Math.sin(i * 0.37));
    const xx = c.map((v, i) => v + Math.cos(i * 1.7));
    const yy = xx.map((v, i) => -v + 2 * c[i] + Math.sin(i * 2.9) * 0.3);
    for (let i = 0; i < n; i++) coords.push([34.6 + (i % 10) * 0.01, 31.8 + Math.floor(i / 10) * 0.01]);
    const res = scan({ keys: ['x', 'y', 'c'], families: { x: 'a', y: 'b', c: 'c' }, known: [], trivial: [], confounders: ['c'], urbanKeys: [], scales: [{ key: 's', cols: [xx, yy, c], coords }] });
    const d = res.find(r => r.x === 'x' && r.y === 'y')!;
    expect(d.kind).toBe('hidden');
    expect(d.hidden!.partialR).toBeLessThan(-0.5);
  });
});
