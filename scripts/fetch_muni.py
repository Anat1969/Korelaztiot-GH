"""Fetch the municipal layers from ASHDODMAP (public read, publishable key) into data-raw/."""
import json, urllib.request
from pathlib import Path

URL = 'https://cbhexpybdggwzyakgagd.supabase.co/rest/v1'
KEY = 'sb_publishable_1KSwG6rqTzBSHmI2RxX6Fw_EEcuKzk3'
Q = {
    'mt_map_features': 'layer=in.(city,quarters_official)&select=id,layer,name,props,geom,source,certainty',
    'mt_existing': 'select=id,topic,subtype,name,geom,quarter_id',
    'shimur_buildings': 'select=id,name,lat,lng,year_built,protection_level',
    'plan_projects': 'select=id,title,kind,status,units_existing,units_planned,center,published',
    'mt_districts': 'select=id,name,target_pop,total_area_m2,res_area_m2,units_total,employment_m2,quarters',
}
Path('data-raw').mkdir(exist_ok=True)
for table, q in Q.items():
    req = urllib.request.Request(f'{URL}/{table}?{q}', headers={'apikey': KEY})
    data = json.load(urllib.request.urlopen(req, timeout=60))
    if not data:
        raise SystemExit(f'{table}: empty response, keeping the previous build')
    json.dump(data, open(f'data-raw/{table}.json', 'w'), ensure_ascii=False)
    print(table, len(data))
