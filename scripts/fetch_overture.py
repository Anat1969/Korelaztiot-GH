"""Fetch Overture Maps features for the Ashdod bounding box into data-raw/*.parquet."""
import duckdb, sys, time
REL = sys.argv[1] if len(sys.argv) > 1 else '2026-10-21.0'
BB = dict(xmin=34.60, xmax=34.73, ymin=31.73, ymax=31.88)
con = duckdb.connect()
con.execute("INSTALL httpfs; LOAD httpfs; INSTALL spatial; LOAD spatial; SET s3_region='us-west-2';")
con.execute("CREATE OR REPLACE SECRET anon (TYPE s3, PROVIDER config, KEY_ID '', SECRET '', REGION 'us-west-2')")
where = f"bbox.xmin < {BB['xmax']} and bbox.xmax > {BB['xmin']} and bbox.ymin < {BB['ymax']} and bbox.ymax > {BB['ymin']}"
SKIP = set(sys.argv[2].split(',')) if len(sys.argv) > 2 else set()
jobs = {
  'buildings': ("buildings/type=building", "id, height, num_floors, subtype, class, ST_AsWKB(geometry) wkb"),
  'places': ("places/type=place", "id, names.primary name, taxonomy.primary cat, taxonomy.hierarchy hier, basic_category, operating_status, confidence, ST_AsWKB(geometry) wkb"),
  'segments': ("transportation/type=segment", "id, subtype, class, ST_AsWKB(geometry) wkb"),
  'land_use': ("base/type=land_use", "id, subtype, class, ST_AsWKB(geometry) wkb"),
  'land_cover': ("base/type=land_cover", "id, subtype, ST_AsWKB(geometry) wkb"),
}
for name, (path, cols) in jobs.items():
    if name in SKIP: continue
    t = time.time()
    src = f"s3://overturemaps-us-west-2/release/{REL}/theme={path}/*"
    con.execute(f"COPY (SELECT {cols} FROM read_parquet('{src}', hive_partitioning=1) WHERE {where}) TO 'data-raw/ov_{name}.parquet' (FORMAT parquet)")
    n = con.execute(f"select count(*) from 'data-raw/ov_{name}.parquet'").fetchone()[0]
    print(name, n, f"{time.time()-t:.0f}s", flush=True)
