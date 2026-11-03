// The municipal street layer (scripts/add_streets.py): sane values, lengths add up, catalogue complete.
import { describe, expect, it } from 'vitest';
import quarters from '../public/data/units-quarters.json';
import h38 from '../public/data/units-h3-8.json';
import h39 from '../public/data/units-h3-9.json';
import metaJson from '../public/data/meta.json';
import { VAR } from '../src/lib/variables';
import { topicOf } from '../src/lib/color';
import { streetFindings, STREET_KEYS } from '../src/components/StreetFinding';
import type { Discovery } from '../src/lib/discover';

type U = { v: Record<string, number | null | undefined> };
const SCALES: Record<string, U[]> = { quarters: quarters as U[], 'h3-8': h38 as U[], 'h3-9': h39 as U[] };
const load = (k: string) => SCALES[k];
const meta = metaJson as { streets: { km: number } };

describe('street network variables', () => {
  for (const k of ['quarters', 'h3-8', 'h3-9']) {
    it(`${k}: densities in a sane range and the total length matches the source`, () => {
      const us = load(k);
      let km = 0;
      for (const u of us) {
        const d = u.v.street_density!, m = u.v.main_street_density!, s = u.v.local_street_share;
        expect(d).toBeGreaterThanOrEqual(0);
        expect(d).toBeLessThan(40); // a dense grid is about 20 km per km2
        expect(m).toBeLessThanOrEqual(d + 1e-6);
        if (s != null) { expect(s).toBeGreaterThanOrEqual(0); expect(s).toBeLessThanOrEqual(100); }
        km += d * (u.v.area ?? 0);
      }
      // units cover the city; hexagons with less than a quarter inside the city are dropped, so a few km fall outside
      expect(km).toBeLessThanOrEqual(meta.streets.km * 1.01);
      expect(km).toBeGreaterThan(meta.streets.km * 0.94);
    });
  }
  it('every street variable is in the catalogue with the municipal source and the movement colour', () => {
    for (const k of STREET_KEYS) {
      expect(VAR[k].source).toContain('עיריית אשדוד');
      expect(topicOf(k).name).toBe('תנועה');
    }
  });
  it('the finding leaves out "more city" partners and is honest when nothing holds', () => {
    const d = (x: string, y: string, q: number): Discovery => ({ x, y, q, kind: 'linear', r: 0.5, rho: 0.5, n: 75, nEff: 30, pSpatial: 0.01, dcor: 0.5, scales: [], consistent: true, bp: null, hidden: null, beyond: 0.4, pBeyond: q, crossFamily: true, known: false, score: 1 });
    const res = [d('bld_density', 'street_density', 0.001), d('local_street_share', 'ndvi', 0.02), d('street_density', 'lst', 0.6)];
    const f = streetFindings(res);
    expect(f.found.map(x => x.y)).toEqual(['ndvi']);
    expect(f.expected).toHaveLength(1);
    expect(f.heat?.y).toBe('lst');
    expect(streetFindings([d('street_density', 'lst', 0.6)]).found).toHaveLength(0);
  });
});
