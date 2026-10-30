// Monthly: rerun the discovery scan on the fresh data and add new rules of thumb to public/data/thumbs.json.
// Run with: npx tsx scripts/snapshot_thumbs.ts   (the refresh-data workflow does it after build_data.py)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { scan } from '../src/lib/discover';
import { toRule } from '../src/lib/engine';
import { toThumb, mergeHistory, dedupe, type ThumbEntry } from '../src/lib/thumbs';
import { MATRIX_KEYS } from '../src/lib/variables';
import { CONFOUNDERS, DRIVER_ORDER, FAMILY_OF, KNOWN, TRIVIAL, URBAN_KEYS } from '../src/lib/config';
import type { Unit, UnitType } from '../src/lib/data';

const load = (k: UnitType): Unit[] => JSON.parse(readFileSync(`public/data/units-${k}.json`, 'utf8'));
const S = { quarters: load('quarters'), 'h3-8': load('h3-8'), 'h3-9': load('h3-9') } as Record<UnitType, Unit[]>;
const meta = JSON.parse(readFileSync('public/data/meta.json', 'utf8'));
const date = String(meta.generated).slice(0, 10);
const primary: UnitType = 'h3-8';
const order: UnitType[] = [primary, 'quarters', 'h3-9'];
const col = (us: Unit[], k: string) => us.map(u => u.v[k] ?? null);

const found = scan({
  keys: MATRIX_KEYS, families: FAMILY_OF, known: KNOWN, trivial: TRIVIAL, confounders: CONFOUNDERS, urbanKeys: URBAN_KEYS, driverOrder: DRIVER_ORDER,
  scales: order.map(k => ({ key: k, cols: MATRIX_KEYS.map(v => col(S[k], v)), coords: S[k].map(u => u.c) })),
}).filter(d => d.q < 0.1 && d.crossFamily);

const thumbs = dedupe(found.map(d => toThumb(toRule(d, S[primary], primary), S[primary])).filter(t => t.reliability >= 45));
const path = 'public/data/thumbs.json';
const prev: ThumbEntry[] = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')).items : [];
const items = mergeHistory(prev, thumbs, date);
writeFileSync(path, JSON.stringify({ updated: date, items }, null, 1));
console.log(`rules of thumb: ${items.filter(i => i.status === 'active').length} active, ${items.filter(i => i.first_seen === date).length} new on ${date}`);
