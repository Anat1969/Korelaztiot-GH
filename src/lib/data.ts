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

const cache = new Map<string, Promise<unknown>>();

function getJSON<T>(path: string): Promise<T> {
  if (!cache.has(path)) {
    cache.set(path, fetch(path).then(r => {
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
