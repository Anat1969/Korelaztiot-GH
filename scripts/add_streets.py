"""Add the municipal street network to every analysis unit.

Input:  data-raw/ashdod-streets.geojson  (rehevot.shp of the Ashdod municipality, 2,991 street centrelines,
        received 03.11.2026, converted to WGS84). Fields used: hierarchy (מידרג) and name.
Output: three new values in public/data/units-*.json, next to the ones build_data.py wrote:
  street_density      km of street per km2 (without parking strips, 9, and intercity roads, 8)
  main_street_density km of main streets per km2 (hierarchy 1 and 2: boulevards and main streets)
  local_street_share  % of the classified street length that is local (3, 4, 5 and pedestrian malls, 10)

Pure Python on purpose: it runs after build_data.py in the monthly refresh, and also on its own when the
satellite and Overture inputs are not at hand, without touching any other variable.
Lines are cut into pieces of at most 5 m, and each piece is counted in the unit that holds its midpoint.
Distances use a local equirectangular projection around Ashdod (error well below 1% at this size).
The meaning of the hierarchy codes is read from the street names (1: שד בני ברית, שד הרצל; 2: הפלמ"ח, נורדאו;
9: "חניה ..."), it is an estimate, not an official legend.
"""
import json, math
from pathlib import Path

RAW = Path('data-raw'); OUT = Path('public/data')
LAT0 = 31.8
KX = 111320 * math.cos(math.radians(LAT0)); KY = 110574
STEP = 5.0  # metres
MAIN = {1, 2}; LOCAL = {3, 4, 5, 10}; SKIP = {8, 9}


def xy(p): return (p[0] * KX, p[1] * KY)


def rings_of(g):
    polys = [g['coordinates']] if g['type'] == 'Polygon' else g['coordinates']
    return [[[xy(c) for c in ring] for ring in poly] for poly in polys]


def in_ring(x, y, ring):
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i]; xj, yj = ring[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def in_poly(x, y, polys):
    for poly in polys:
        if in_ring(x, y, poly[0]) and not any(in_ring(x, y, h) for h in poly[1:]):
            return True
    return False


def pieces(geom):
    """(midpoint, length) of every piece of at most STEP metres."""
    lines = [geom['coordinates']] if geom['type'] == 'LineString' else geom['coordinates']
    for line in lines:
        pts = [xy(c) for c in line]
        for (x1, y1), (x2, y2) in zip(pts, pts[1:]):
            L = math.hypot(x2 - x1, y2 - y1)
            if L == 0: continue
            n = max(1, math.ceil(L / STEP))
            for k in range(n):
                t = (k + 0.5) / n
                yield (x1 + (x2 - x1) * t, y1 + (y2 - y1) * t), L / n


def load_streets():
    out = []
    for f in json.load(open(RAW / 'ashdod-streets.geojson'))['features']:
        g = f.get('geometry')
        if not g: continue
        h = int(f['properties'].get('hierarchy') or 0)
        out.append((h, list(pieces(g))))
    return out


def add(streets, kind):
    path = OUT / f'units-{kind}.json'
    units = json.load(open(path))
    shapes = []
    for u in units:
        polys = rings_of(u['g'])
        xs = [p[0] for poly in polys for p in poly[0]]; ys = [p[1] for poly in polys for p in poly[0]]
        shapes.append((polys, min(xs), min(ys), max(xs), max(ys)))
    # coarse grid index: 250 m cells -> candidate units
    G = 250.0; grid = {}
    for i, (_, x0, y0, x1, y1) in enumerate(shapes):
        for gx in range(int(x0 // G), int(x1 // G) + 1):
            for gy in range(int(y0 // G), int(y1 // G) + 1):
                grid.setdefault((gx, gy), []).append(i)
    acc = [dict(all=0.0, main=0.0, local=0.0) for _ in units]
    for h, ps in streets:
        if h in SKIP: continue
        for (x, y), L in ps:
            for i in grid.get((int(x // G), int(y // G)), ()):
                polys, x0, y0, x1, y1 = shapes[i]
                if x0 <= x <= x1 and y0 <= y <= y1 and in_poly(x, y, polys):
                    a = acc[i]; a['all'] += L
                    if h in MAIN: a['main'] += L
                    elif h in LOCAL: a['local'] += L
                    break
    for u, a in zip(units, acc):
        A = u['v'].get('area')
        if not A: continue
        cls = a['main'] + a['local']
        u['v']['street_density'] = rnd(a['all'] / 1000 / A)
        u['v']['main_street_density'] = rnd(a['main'] / 1000 / A)
        # a share of almost nothing is noise: at least 300 m of classified street
        u['v']['local_street_share'] = rnd(100 * a['local'] / cls) if cls >= 300 else None
    json.dump(units, open(path, 'w'), ensure_ascii=False, separators=(',', ':'))
    total = sum(a['all'] for a in acc) / 1000
    print(kind, len(units), f'{total:.1f} km of street inside units')
    return total


def rnd(v):
    a = abs(v)
    return round(v, 4 if a < 1 else 2 if a < 100 else 1)


if __name__ == '__main__':
    streets = load_streets()
    km = {h: 0.0 for h in range(11)}
    for h, ps in streets: km[h] = km.get(h, 0) + sum(L for _, L in ps) / 1000
    print('km by hierarchy', {h: round(v, 1) for h, v in km.items() if v})
    for kind in ('quarters', 'h3-8', 'h3-9'): add(streets, kind)
    meta_p = OUT / 'meta.json'
    meta = json.load(open(meta_p))
    meta['streets'] = dict(source='עיריית אשדוד, rehevot.shp', received='2026-11-03', segments=len(streets),
                           km=round(sum(v for h, v in km.items() if h not in SKIP), 1),
                           km_main=round(km[1] + km[2], 1), km_parking=round(km[9], 1))
    json.dump(meta, open(meta_p, 'w'), ensure_ascii=False, indent=1)
