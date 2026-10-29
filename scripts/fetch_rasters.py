"""Clip Sentinel-2 L2A (NDVI, NDBI, NDWI) and Landsat C2 L2 surface temperature to Ashdod.

Writes data-raw/s2_<index>.tif and data-raw/lst.tif plus data-raw/rasters.json with scene metadata.
Scenes: the clearest Landsat 8/9 scene of the latest summer (Jun-Sep) and the clear Sentinel-2 scene closest to it in time.
"""
import json, sys, urllib.request, urllib.parse
import numpy as np, rasterio
from rasterio.warp import transform_bounds
from rasterio.windows import from_bounds

BBOX = [34.60, 31.73, 34.73, 31.88]
YEAR = sys.argv[1] if len(sys.argv) > 1 else '2026'
WIN = f'{YEAR}-06-01T00:00:00Z/{YEAR}-09-30T23:59:59Z'

def post(url, body):
    r = urllib.request.Request(url, data=json.dumps(body).encode(), headers={'Content-Type': 'application/json'})
    return json.load(urllib.request.urlopen(r, timeout=90))

def clip(href, out=None):
    with rasterio.Env(AWS_NO_SIGN_REQUEST='YES', GDAL_DISABLE_READDIR_ON_OPEN='EMPTY_DIR'):
        with rasterio.open(href) as src:
            b = transform_bounds('EPSG:4326', src.crs, *BBOX)
            w = from_bounds(*b, src.transform).round_offsets().round_lengths()
            a = src.read(1, window=w).astype('float32')
            prof = src.profile.copy()
            prof.update(width=a.shape[1], height=a.shape[0], transform=src.window_transform(w), dtype='float32', nodata=np.nan, compress='deflate', driver='GTiff')
            prof.pop('blockxsize', None); prof.pop('blockysize', None); prof.pop('tiled', None)
            return a, prof

def write(path, a, prof):
    with rasterio.open(path, 'w', **prof) as dst:
        dst.write(a.astype('float32'), 1)

meta = {}
# Landsat surface temperature (Planetary Computer, signed URL)
ls = post('https://planetarycomputer.microsoft.com/api/stac/v1/search', {'collections': ['landsat-c2-l2'], 'bbox': BBOX, 'datetime': WIN, 'limit': 100, 'query': {'eo:cloud_cover': {'lt': 5}, 'platform': {'in': ['landsat-8', 'landsat-9']}}})
cands = [f for f in ls['features'] if 'lwir11' in f['assets']]
f = sorted(cands, key=lambda f: (f['properties']['eo:cloud_cover'], f['properties']['datetime']))[0]
href = f['assets']['lwir11']['href']
signed = json.load(urllib.request.urlopen('https://planetarycomputer.microsoft.com/api/sas/v1/sign?href=' + urllib.parse.quote(href, safe=''), timeout=60))['href']
st, pst = clip(signed)
st[st == 0] = np.nan
lst = st * 0.00341802 + 149.0 - 273.15
write('data-raw/lst.tif', lst, pst)
meta['landsat'] = {'id': f['id'], 'date': f['properties']['datetime'][:10], 'cloud': f['properties']['eo:cloud_cover'], 'stac': 'planetarycomputer.microsoft.com, landsat-c2-l2, lwir11'}
print('LST', meta['landsat'], np.nanmean(lst))
# Sentinel-2
s2 = post('https://earth-search.aws.element84.com/v1/search', {'collections': ['sentinel-2-c1-l2a'], 'bbox': BBOX, 'datetime': WIN, 'limit': 100, 'query': {'eo:cloud_cover': {'lt': 5}}})
# the clear (<1% cloud) scene closest in time to the Landsat pass, so vegetation and heat describe the same days
import datetime as _dt
ld = _dt.date.fromisoformat(meta['landsat']['date'])
clear = [f for f in s2['features'] if f['properties']['eo:cloud_cover'] < 1] or s2['features']
f = sorted(clear, key=lambda f: abs((_dt.date.fromisoformat(f['properties']['datetime'][:10]) - ld).days))[0]
A = f['assets']
def band(k):
    a, p = clip(A[k]['href'])
    off = A[k].get('raster:bands', [{}])[0].get('offset', 0); sc = A[k].get('raster:bands', [{}])[0].get('scale', 1)
    a[a == 0] = np.nan
    return a * sc + off, p
red, p10 = band('red'); nir, _ = band('nir'); green, _ = band('green')
sw, p20 = band('swir16')
scl, _ = clip(A['scl']['href'])
# resample 20 m SWIR and SCL to 10 m by repetition
sw10 = np.repeat(np.repeat(sw, 2, 0), 2, 1)[:red.shape[0], :red.shape[1]]
scl10 = np.repeat(np.repeat(scl, 2, 0), 2, 1)[:red.shape[0], :red.shape[1]]
bad = np.isin(scl10, [0, 1, 3, 8, 9, 10])
ndvi = (nir - red) / (nir + red); ndbi = (sw10 - nir) / (sw10 + nir); ndwi = (green - nir) / (green + nir)
for a in (ndvi, ndbi, ndwi): a[bad] = np.nan
write('data-raw/s2_ndvi.tif', ndvi, p10); write('data-raw/s2_ndbi.tif', ndbi, p10); write('data-raw/s2_ndwi.tif', ndwi, p10)
meta['sentinel2'] = {'id': f['id'], 'date': f['properties']['datetime'][:10], 'cloud': f['properties']['eo:cloud_cover'], 'stac': 'earth-search.aws.element84.com/v1, sentinel-2-c1-l2a'}
print('S2', meta['sentinel2'], np.nanmean(ndvi))

json.dump(meta, open('data-raw/rasters.json', 'w'), ensure_ascii=False, indent=1)
