// Reference values computed with SciPy 1.x (scipy.stats.pearsonr, spearmanr, t.sf, beta.cdf, false_discovery_control).
import { describe, it, expect } from 'vitest';
import { pearson, spearman, pFromR, tTwoSided, ibeta, benjaminiHochberg, ranks, moranI, knnWeights, effectiveN, partial, analysePair, reliability } from '../src/lib/stats';

const x = [1, 2, 2, 3, 5, 5, 5, 8, 9, 12, 13, 13];
const y = [2, 1, 4, 3, 7, 6, 6, 9, 8, 15, 11, 14];

describe('against SciPy', () => {
  it('pearson r and p', () => {
    expect(pearson(x, y)).toBeCloseTo(0.9480412262577596, 10);
    expect(pFromR(pearson(x, y), x.length)).toBeCloseTo(2.7324957456006533e-06, 9);
  });
  it('spearman with ties', () => expect(spearman(x, y)).toBeCloseTo(0.941629792788369, 10));
  it('t distribution', () => expect(tTwoSided(2.5, 10)).toBeCloseTo(0.03144684423660882, 9));
  it('incomplete beta', () => expect(ibeta(0.3, 2.5, 4)).toBeCloseTo(0.3521975859067672, 9));
  it('Benjamini-Hochberg', () => {
    const q = benjaminiHochberg([0.01, 0.04, 0.03, 0.2, 0.001]);
    [0.025, 0.05, 0.05, 0.2, 0.005].forEach((v, i) => expect(q[i]).toBeCloseTo(v, 10));
  });
});

describe('spatial and robustness', () => {
  it('average ranks', () => expect(ranks([10, 20, 20, 5])).toEqual([2, 3.5, 3.5, 1]));
  it('Moran I is high for a smooth gradient and near zero for a checkerboard', () => {
    const coords: [number, number][] = [];
    for (let i = 0; i < 10; i++) for (let j = 0; j < 10; j++) coords.push([34.6 + i * 0.005, 31.8 + j * 0.005]);
    const nb = knnWeights(coords, 4);
    expect(moranI(coords.map(c => c[0]), nb)).toBeGreaterThan(0.7);
    expect(moranI(coords.map((_, k) => ((Math.floor(k / 10) + k) % 2)), nb)).toBeLessThan(-0.5);
  });
  it('effective n shrinks with joint autocorrelation', () => {
    expect(effectiveN(100, 0, 0.9)).toBe(100);
    expect(effectiveN(100, 0.8, 0.8)).toBeCloseTo(100 * 0.36 / 1.64, 6);
  });
  it('partial correlation removes a shared driver', () => {
    const zz = Array.from({ length: 200 }, (_, i) => Math.sin(i) * 10);
    const a = zz.map((v, i) => v + Math.cos(i * 7.1)), b = zz.map((v, i) => v + Math.sin(i * 3.3));
    expect(pearson(a, b)).toBeGreaterThan(0.9);
    expect(Math.abs(partial(a, b, zz))).toBeLessThan(0.2);
  });
  it('full pair analysis and reliability are deterministic', () => {
    const coords: [number, number][] = x.map((_, i) => [34.6 + i * 0.01, 31.8]);
    const a = analysePair({ x, y, coords, seed: 7 })!;
    const b = analysePair({ x, y, coords, seed: 7 })!;
    expect(a.pPerm).toBe(b.pPerm);
    expect(a.pPerm).toBeLessThan(0.01);
    const rel = reliability(a);
    expect(rel.score).toBeGreaterThan(0);
    expect(rel.score).toBeLessThanOrEqual(100);
  });
});
