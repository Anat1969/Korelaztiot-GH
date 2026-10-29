"""Build the Korelaztiot indicator dataset for Ashdod.

Inputs (data-raw/):
  mt_map_features.json, mt_existing.json, shimur_buildings.json, plan_projects.json, mt_districts.json  (ASHDODMAP Supabase)
  ov_*.parquet  (Overture Maps, fetch_overture.py)
  s2_*.tif, lst.tif, rasters.json  (Sentinel-2 / Landsat, fetch_rasters.py)
Outputs (public/data/):
  units-quarters.json, units-h3-8.json, units-h3-9.json, variables.json, meta.json
Every unit gets one value per variable. Values are rounded to keep the files small.
"""
import json, math, datetime
from pathlib import Path
import numpy as np, duckdb, h3, rasterio
from rasterio.features import rasterize
from shapely.geometry import shape, mapping, Point, Polygon, MultiPolygon
from shapely.ops import transform as stransform
from shapely import wkb as swkb, STRtree
from pyproj import Transformer

RAW = Path('data-raw'); OUT = Path('public/data'); OUT.mkdir(parents=True, exist_ok=True)
to_m = Transformer.from_crs('EPSG:4326', 'EPSG:2039', always_xy=True).transform  # Israel TM Grid, metres
def m_area(g): return stransform(to_m, g).area

def load(name): return json.load(open(RAW / f'{name}.json'))

feats = load('mt_map_features')
city = shape(next(f for f in feats if f['layer'] == 'city')['geom'])
city_m = stransform(to_m, city)

# ---------- units ----------
units = {}
q = [f for f in feats if f['layer'] == 'quarters_official']
units['quarters'] = [dict(id=f['id'], name=f['name'], geom=shape(f['geom']).buffer(0), certainty=f['certainty']) for f in q]
for res in (8, 9):
    cells = h3.geo_to_cells(h3.geo_to_h3shape(mapping(city)), res)
    out = []
    for c in sorted(cells):
        poly = Polygon([(lng, lat) for lat, lng in h3.cell_to_boundary(c)])
        inter = poly.intersection(city)
        if inter.area / poly.area < 0.25: continue
        out.append(dict(id=c, name=None, geom=inter, certainty='derived'))
    units[f'h3-{res}'] = out

# name hexes by the quarter that holds their centroid
qtree = STRtree([u['geom'] for u in units['quarters']])
def quarter_of(pt):
    for i in qtree.query(pt):
        if units['quarters'][i]['geom'].contains(pt): return units['quarters'][i]
    return None
for k in ('h3-8', 'h3-9'):
    for u in units[k]:
        qq = quarter_of(u['geom'].representative_point())
        u['quarter'] = qq['id'] if qq else None
        u['name'] = qq['name'] if qq else 'שולי העיר'

# ---------- point / line / polygon sources ----------
con = duckdb.connect(); con.execute('INSTALL spatial; LOAD spatial;')
def rows(sql): return con.execute(sql).fetchall()
def geoms(parquet, where='true', extra=''):
    return [(swkb.loads(bytes(r[0])),) + tuple(r[1:]) for r in rows(f"select wkb {extra} from 'data-raw/{parquet}.parquet' where {where}")]

bld = geoms('ov_buildings', extra=', height, num_floors')
places = geoms('ov_places', "coalesce(operating_status,'open') <> 'permanently_closed' and confidence >= 0.5", ', cat, basic_category, hier')
segs = geoms('ov_segments', extra=', subtype, class')
landuse = geoms('ov_land_use', extra=', subtype, class')

def cats(hier, *keys):
    h = ' '.join(hier or []) if hier is not None else ''
    return any(k in h for k in keys)

ex = load('mt_existing')
def ex_pts(*subs): return [g for g in (shape(e['geom']) for e in ex if e['subtype'] in subs and e.get('geom')) if not g.is_empty]
kinder = ex_pts('גן ילדים', 'גן ילדים פרטי')
schools = ex_pts('בית ספר', 'מוסד חינוך')
early = ex_pts('מעון יום', 'משפחתון')
shimur = [Point(b['lng'], b['lat']) for b in load('shimur_buildings') if b.get('lat') and b.get('lng')]
plans = [p for p in load('plan_projects') if p.get('center')]
def center_pt(c):
    if isinstance(c, dict) and 'lng' in c: return Point(c['lng'], c['lat'])
    if isinstance(c, dict) and 'coordinates' in c: return Point(*c['coordinates'][:2])
    if isinstance(c, list): return Point(c[0], c[1])
    return None
plan_pts = [(center_pt(p['center']), p.get('units_planned') or 0, p.get('units_existing') or 0) for p in plans]
plan_pts = [p for p in plan_pts if p[0] is not None]

districts = load('mt_districts')
q2district = {qid: d for d in districts for qid in (d.get('quarters') or [])}

# ---------- rasters ----------
rmeta = json.load(open(RAW / 'rasters.json'))
rasters = {}
for key, path in [('ndvi', 's2_ndvi.tif'), ('ndbi', 's2_ndbi.tif'), ('ndwi', 's2_ndwi.tif'), ('lst', 'lst.tif')]:
    src = rasterio.open(RAW / path)
    rasters[key] = [src.read(1), src.transform, Transformer.from_crs('EPSG:4326', src.crs, always_xy=True).transform, src]
# Land-only statistics: sea, marina and river pixels are cold and bare, so they would turn the
# vegetation-heat relation upside down. Water = NDWI > 0 (McFeeters 1996); for the 30 m Landsat grid
# a pixel is dropped when more than 20% of the 10 m pixels under it are water.
from rasterio.warp import reproject, Resampling
ndwi = rasters['ndwi'][0]
water10 = np.where(np.isfinite(ndwi), (ndwi > 0).astype('float32'), np.nan)
for k in ('ndvi', 'ndbi'):
    rasters[k][0] = np.where(water10 == 1, np.nan, rasters[k][0])
ls = rasters['lst']
wfrac = np.full(ls[0].shape, np.nan, 'float32')
reproject(water10, wfrac, src_transform=rasters['ndwi'][3].transform, src_crs=rasters['ndwi'][3].crs, dst_transform=ls[3].transform, dst_crs=ls[3].crs, resampling=Resampling.average, src_nodata=np.nan, dst_nodata=np.nan)
ls[0] = np.where(wfrac > 0.2, np.nan, ls[0])

def zonal(key, geom, fn):
    a, tr, tf, _ = rasters[key]
    g = stransform(tf, geom)
    m = rasterize([(g, 1)], out_shape=a.shape, transform=tr, fill=0, all_touched=False, dtype='uint8').astype(bool)
    v = a[m]; v = v[np.isfinite(v)]
    return fn(v) if v.size >= 3 else None

# water mask (sea, marina, Lachish river) for distance-to-water
wa, wtr, wtf, _ = rasters['ndwi']
water_rc = np.argwhere(np.nan_to_num(wa, nan=-1) > 0.15)
water_xy = np.array([wtr * (int(c) + .5, int(r) + .5) for r, c in water_rc[::4]]) if len(water_rc) else np.zeros((0, 2))

# ---------- access: share of buildings within a walking distance ----------
# Distances in metres on the Israeli TM grid. Building centroids stand in for homes and workplaces.
from scipy.spatial import cKDTree
from shapely.ops import unary_union
to_m_arr = lambda pts: np.array([to_m(x, y) for x, y in pts]) if len(pts) else np.zeros((0, 2))
bld_xy = to_m_arr([(g[0].representative_point().x, g[0].representative_point().y) for g in bld])
stops = load('transit_stops')
stop_xy = to_m_arr([(t['lng'], t['lat']) for t in stops])
park_polys = [lg for lg, sub, cls in landuse if (cls in {'park', 'garden', 'playground', 'recreation_ground', 'village_green', 'dog_park', 'nature_reserve'})]
park_union = unary_union([g.buffer(0) for g in park_polys]) if park_polys else None
parks_big = [p for p in (getattr(park_union, 'geoms', [park_union]) if park_union else []) if m_area(p) >= 5000]  # WHO: at least 0.5 ha
park_m = [stransform(to_m, p) for p in parks_big]
# sample park edges every 25 m so "distance to the park" is distance to its edge, not its centre
edge_pts = []
for pm in park_m:
    for ring in ([pm.exterior] + list(pm.interiors)):
        L = ring.length
        edge_pts += [ring.interpolate(d).coords[0] for d in np.arange(0, L, 25)]
edge_xy = np.array(edge_pts) if edge_pts else np.zeros((0, 2))
kinder_xy = to_m_arr([(p.x, p.y) for p in kinder])
def near(src, dst):
    if not len(dst) or not len(src): return np.full(len(src), np.inf)
    return cKDTree(dst).query(src)[0]
bld_d_bus = near(bld_xy, stop_xy)
bld_d_park = near(bld_xy, edge_xy)
bld_d_kinder = near(bld_xy, kinder_xy)
bld_tree_pts = [g[0].representative_point() for g in bld]
bld_ptree = STRtree(bld_tree_pts)

# ---------- spatial indexes ----------
def tree(gs): return STRtree(gs) if gs else None
T = dict(bld=tree([g[0] for g in bld]), places=tree([g[0] for g in places]), segs=tree([g[0] for g in segs]), landuse=tree([g[0] for g in landuse]))

PARK = {'park', 'garden', 'playground', 'recreation_ground', 'pitch', 'grass', 'village_green', 'dog_park', 'nature_reserve', 'cemetery'}
ROAD = {'motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential', 'living_street', 'unclassified', 'service'}
WALK = {'footway', 'pedestrian', 'path', 'steps', 'cycleway', 'living_street'}


def indicators(u):
    g = u['geom']; gm = stransform(to_m, g); A = gm.area / 1e6  # km2
    r = {}
    # satellite
    r['ndvi'] = zonal('ndvi', g, np.mean)
    r['green_cover'] = zonal('ndvi', g, lambda v: 100 * float(np.mean(v > 0.3)))
    r['ndbi'] = zonal('ndbi', g, np.mean)
    r['lst'] = zonal('lst', g, np.mean)
    r['lst_p90'] = zonal('lst', g, lambda v: float(np.percentile(v, 90)))
    # buildings
    idx = T['bld'].query(g, predicate='intersects') if T['bld'] else []
    fp = 0.0; cnt = 0
    for i in idx:
        bg = bld[i][0]
        if not g.contains(bg.representative_point()): continue
        fp += m_area(bg); cnt += 1
    r['bld_density'] = cnt / A
    r['bld_coverage'] = 100 * fp / gm.area
    r['bld_footprint'] = fp / cnt if cnt >= 3 else None
    # places
    pi = [i for i in (T['places'].query(g, predicate='contains') if T['places'] else [])]
    pl = [places[i] for i in pi]
    r['poi_density'] = len(pl) / A
    r['food_density'] = sum(1 for p in pl if cats(p[3], 'food_and_drink', 'eat_and_drink', 'restaurant', 'cafe')) / A
    r['retail_density'] = sum(1 for p in pl if cats(p[3], 'shopping', 'retail')) / A
    r['health_density'] = sum(1 for p in pl if cats(p[3], 'health', 'medical')) / A
    # streets
    road = walk = 0.0; ends = {}
    for i in (T['segs'].query(g, predicate='intersects') if T['segs'] else []):
        sg, sub, cls = segs[i]
        if sub != 'road': continue
        part = stransform(to_m, sg.intersection(g)); L = part.length / 1000
        if cls in ROAD: road += L
        if cls in WALK: walk += L
        if cls in ROAD or cls in WALK:
            for c in (sg.coords[0], sg.coords[-1]):
                if g.contains(Point(c)):
                    k = (round(c[0], 5), round(c[1], 5)); ends[k] = ends.get(k, 0) + 1
    r['road_density'] = road / A
    r['walk_density'] = walk / A
    r['intersections'] = sum(1 for v in ends.values() if v >= 3) / A
    # land use
    park = 0.0
    for i in (T['landuse'].query(g, predicate='intersects') if T['landuse'] else []):
        lg, sub, cls = landuse[i]
        if (cls in PARK) or sub in ('park', 'recreation'):
            park += m_area(lg.intersection(g))
    r['park_share'] = min(100.0, 100 * park / gm.area)
    # municipal
    r['kinder_density'] = sum(1 for p in kinder if g.contains(p)) / A
    r['school_density'] = sum(1 for p in schools if g.contains(p)) / A
    r['early_density'] = sum(1 for p in early if g.contains(p)) / A
    r['shimur_count'] = sum(1 for p in shimur if g.contains(p))
    inside = [p for p in plan_pts if g.contains(p[0])]
    r['renewal_projects'] = len(inside)
    r['renewal_units'] = sum(max(0, p[1] - p[2]) for p in inside)
    qid = u['id'] if u['id'].startswith('rova-') else u.get('quarter')
    d = q2district.get(qid)
    r['plan_density'] = (d['target_pop'] / (d['total_area_m2'] / 1e6)) if d and d.get('total_area_m2') else None
    # geography
    c = g.representative_point()
    if len(water_xy):
        cx, cy = wtf(c.x, c.y)
        r['dist_water'] = float(np.min(np.hypot(water_xy[:, 0] - cx, water_xy[:, 1] - cy))) / 1000
    # access, over the buildings whose centroid is in the unit
    bi = bld_ptree.query(g, predicate='contains')
    if len(bi) >= 3:
        r['bus_access'] = 100 * float(np.mean(bld_d_bus[bi] <= 400))
        r['green_access'] = 100 * float(np.mean(bld_d_park[bi] <= 300))
        r['kinder_access'] = 100 * float(np.mean(bld_d_kinder[bi] <= 400))
    r['bus_density'] = sum(1 for t in stops if g.contains(Point(t['lng'], t['lat']))) / A
    r['area'] = A
    return r

def rnd(v):
    if v is None or (isinstance(v, float) and not math.isfinite(v)): return None
    v = float(v); a = abs(v)
    return round(v, 4 if a < 1 else 2 if a < 100 else 1)

def simplify(g):
    s = g.simplify(0.00005, preserve_topology=True)
    gj = mapping(s)
    def r6(c):
        return [round(c[0], 5), round(c[1], 5)] if isinstance(c[0], (int, float)) else [r6(x) for x in c]
    return {'type': gj['type'], 'coordinates': r6(json.loads(json.dumps(gj['coordinates'])))}

for k, us in units.items():
    out = []
    for u in us:
        vals = {kk: rnd(vv) for kk, vv in indicators(u).items()}
        c = u['geom'].representative_point()
        o = dict(id=u['id'], name=u['name'], c=[round(c.x, 5), round(c.y, 5)], v=vals)
        o['g'] = simplify(u['geom'])
        if k == 'quarters': o['certainty'] = u['certainty']
        else: o['q'] = u.get('quarter')
        out.append(o)
    json.dump(out, open(OUT / f'units-{k}.json', 'w'), ensure_ascii=False, separators=(',', ':'))
    print(k, len(out))

# ---------- points for the place profile (measure page) ----------
def ll(p): return [round(p.x, 5), round(p.y, 5)]
def ok(p): return p is not None and not p.is_empty
pl_cat = lambda *keys: [ll(p[0]) for p in places if ok(p[0]) and p[0].geom_type == 'Point' and cats(p[3], *keys)]
points = dict(
    bus=[[round(t['lng'], 5), round(t['lat'], 5)] for t in stops],
    kinder=[ll(p) for p in kinder if ok(p)], school=[ll(p) for p in schools if ok(p)], early=[ll(p) for p in early if ok(p)],
    shimur=[[round(b['lng'], 5), round(b['lat'], 5), b['name']] for b in load('shimur_buildings') if b.get('lat')],
    renewal=[[round(p[0].x, 5), round(p[0].y, 5), q.get('title'), max(0, (q.get('units_planned') or 0) - (q.get('units_existing') or 0))] for p, q in zip(plan_pts, [q for q in plans if center_pt(q['center']) is not None])],
    food=pl_cat('food_and_drink', 'eat_and_drink'), health=pl_cat('health'), retail=pl_cat('shopping', 'retail'),
    parks=[[*ll(p.representative_point()), round(m_area(p) / 10000, 2)] for p in parks_big],
    streets=[[s_['name'], round(s_['center'][1], 5), round(s_['center'][0], 5)] for s_ in load('cl_streets') if s_.get('center')],
)
json.dump(points, open(OUT / 'points.json', 'w'), ensure_ascii=False, separators=(',', ':'))
print('points', {k: len(v) for k, v in points.items()})

json.dump(dict(city=simplify(city)), open(OUT / 'city.json', 'w'), separators=(',', ':'))
meta = dict(
    generated=datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='minutes'),
    overture=open(RAW / 'overture_release.txt').read().strip() if (RAW / 'overture_release.txt').exists() else '2026-10-21.0',
    sentinel2=rmeta['sentinel2'], landsat=rmeta['landsat'],
    counts=dict(bus_stops=len(stops), big_parks=len(parks_big), buildings=len(bld), places=len(places), segments=len(segs), landuse=len(landuse), kinder=len(kinder), schools=len(schools), early=len(early), shimur=len(shimur), plans=len(plan_pts)),
    units={k: len(v) for k, v in units.items()},
)
json.dump(meta, open(OUT / 'meta.json', 'w'), ensure_ascii=False, indent=1)
print(json.dumps(meta, ensure_ascii=False)[:600])
