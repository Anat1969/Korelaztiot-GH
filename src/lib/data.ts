export type UnitType = 'quarters' | 'h3-8' | 'h3-9';

export const UNIT_TYPES: { key: UnitType; name: string; short: string; about: string }[] = [
  { key: 'quarters', name: 'רובעים', short: 'רובעים', about: '35 רובעים בגבולות הרשמיים של מערכת ה-GIS העירונית' },
  { key: 'h3-8', name: 'משושים 0.7 קמ"ר', short: 'משושים גדולים', about: 'רשת H3 ברזולוציה 8, אחידה בשטח, בלתי תלויה בגבולות מנהליים' },
  { key: 'h3-9', name: 'משושים 0.1 קמ"ר', short: 'משושים קטנים', about: 'רשת H3 ברזולוציה 9, קנה מידה של בלוק עירוני' },
];

export interface Unit {
  id: string;
  name: string;
  c: [number, number];
  v: Record<string, number | null>;
  g?: GeoJSON.Polygon | GeoJSON.MultiPolygon;
  q?: string | null;
  certainty?: string;
}

export interface Meta {
  generated: string;
  overture: string;
  sentinel2: { id: string; date: string; cloud: number };
  landsat: { id: string; date: string; cloud: number };
  counts: Record<string, number>;
  units: Record<string, number>;
}

/** Public files resolve against the build base: '/' on Vercel, './' in the app/ build for raw.githack. */
export const asset = (p: string) => `${import.meta.env.BASE_URL}${p.replace(/^\//, '')}`;

const cache = new Map<string, Promise<unknown>>();

function getJSON<T>(path: string): Promise<T> {
  if (!cache.has(path)) {
    cache.set(path, fetch(asset(path)).then(r => {
      if (!r.ok) throw new Error(`${path}: ${r.status}`);
      return r.json();
    }).catch(e => { cache.delete(path); throw e; }));
  }
  return cache.get(path) as Promise<T>;
}

export async function loadUnits(type: UnitType): Promise<Unit[]> {
  return getJSON<Unit[]>(`/data/units-${type}.json`);
}

export const loadMeta = () => getJSON<Meta>('/data/meta.json');
export const loadCity = () => getJSON<{ city: GeoJSON.Polygon }>('/data/city.json');

export function column(units: Unit[], key: string): (number | null)[] {
  return units.map(u => u.v[key] ?? null);
}

export function toFeatureCollection(units: Unit[], props: (u: Unit, i: number) => Record<string, unknown>): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: units.map((u, i) => ({ type: 'Feature', id: i, properties: { id: u.id, name: u.name, ...props(u, i) }, geometry: u.g! })),
  };
}

export interface Points {
  bus: [number, number][]; kinder: [number, number][]; school: [number, number][]; early: [number, number][];
  shimur: [number, number, string][]; renewal: [number, number, string, number][];
  food: [number, number][]; health: [number, number][]; retail: [number, number][];
  parks: [number, number, number][]; streets: [string, number, number][];
}
export const loadPoints = () => getJSON<Points>('/data/points.json');

/** Distance in metres between two lng/lat points (equirectangular, accurate at city scale). */
export function metres(a: [number, number], b: [number, number]): number {
  const k = Math.cos(((a[1] + b[1]) / 2) * Math.PI / 180);
  return Math.hypot((a[0] - b[0]) * 111320 * k, (a[1] - b[1]) * 110540);
}

/** A circle as a GeoJSON polygon, for the walking radius. */
export function circle(c: [number, number], r: number, n = 64): GeoJSON.Polygon {
  const k = Math.cos(c[1] * Math.PI / 180), ring: number[][] = [];
  for (let i = 0; i <= n; i++) { const t = (i / n) * 2 * Math.PI; ring.push([c[0] + (r * Math.cos(t)) / (111320 * k), c[1] + (r * Math.sin(t)) / 110540]); }
  return { type: 'Polygon', coordinates: [ring] };
}
