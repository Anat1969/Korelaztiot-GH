import { lazy, Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import VerbHead from '../components/VerbHead';
import NextStep from '../components/NextStep';
import { loadMeta, loadUnits, UNIT_TYPES, type Meta, type UnitType } from '../lib/data';
import { FAMILIES, VARIABLES } from '../lib/variables';
import { toast } from '../components/Toast';
import SortTable from '../components/SortTable';

const Findings = lazy(() => import('./Findings'));
const Updates = lazy(() => import('./Updates'));
const TABS = [{ k: 'findings', label: 'ספריית ממצאים' }, { k: 'data', label: 'נתונים להורדה' }, { k: 'updates', label: 'מה חדש' }];

export default function Use() {
  const [sp] = useSearchParams();
  const tab = TABS.find(t => t.k === sp.get('tab'))?.k ?? 'findings';
  return (
    <div className="page">
      <VerbHead verb="שימוש" base="/use" tab={tab} tabs={TABS}
        line="ממצאים שאומצו, **נתונים פתוחים** לכל תוכנה, ויומן גרסאות. ==כל מספר כאן אפשר לשחזר==." />
      <Suspense fallback={<div className="muted">טוען</div>}>
        {tab === 'findings' && <Findings embedded />}
        {tab === 'data' && <Data />}
        {tab === 'updates' && <Updates embedded />}
      </Suspense>
      <NextStep />
    </div>
  );
}

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Data() {
  const [meta, setMeta] = useState<Meta | null>(null);
  useEffect(() => { loadMeta().then(setMeta).catch(() => {}); }, []);
  async function get(type: UnitType, fmt: 'csv' | 'geojson') {
    const units = await loadUnits(type);
    const keys = VARIABLES.map(v => v.key);
    if (fmt === 'csv') {
      const head = ['id', 'name', 'lng', 'lat', ...keys].join(',');
      const rows = units.map(u => [u.id, `"${(u.name ?? '').replace(/"/g, '""')}"`, u.c[0], u.c[1], ...keys.map(k => u.v[k] ?? '')].join(','));
      download(`korelaztiot-${type}.csv`, '﻿' + [head, ...rows].join('\n'), 'text/csv;charset=utf-8');
    } else {
      const fc = { type: 'FeatureCollection', features: units.map(u => ({ type: 'Feature', properties: { id: u.id, name: u.name, ...u.v }, geometry: u.g })) };
      download(`korelaztiot-${type}.geojson`, JSON.stringify(fc), 'application/geo+json');
    }
    toast('הקובץ ירד');
  }
  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="cards" style={{ ['--rows' as string]: 4 }} data-testid="downloads">
        {UNIT_TYPES.map(t => (
          <div key={t.key} className="card pad">
            <h3>{t.name}</h3>
            <p className="small muted">{t.about}. {meta ? `${meta.units[t.key]} יחידות` : ''}</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn small" onClick={() => get(t.key, 'csv')}>CSV לאקסל</button>
              <button className="btn ghost small" onClick={() => get(t.key, 'geojson')}>GeoJSON ל-GIS</button>
            </div>
            <p className="small muted mono" style={{ direction: 'ltr', textAlign: 'start' }}>/data/units-{t.key}.json</p>
          </div>
        ))}
      </div>
      <section className="card pad">
        <div className="eyebrow">מילון הנתונים: {VARIABLES.length} משתנים</div>
        <SortTable testid="dictionary" rows={VARIABLES} group={v => FAMILIES[v.family].name}
          groupLabel={g => g} cols={[
            { key: 'name', label: 'שכבה', value: v => v.name, render: v => <b style={{ fontWeight: 600 }}>{v.name}</b> },
            { key: 'key', label: 'מפתח', value: v => v.key, render: v => <span className="mono" style={{ direction: 'ltr', display: 'inline-block' }}>{v.key}</span> },
            { key: 'unit', label: 'יחידה', value: v => v.unit },
            { key: 'source', label: 'מקור', value: v => v.source },
            { key: 'about', label: 'הגדרה', value: v => v.about },
          ]} />
        <p className="small muted" style={{ marginTop: 12 }}>רישיונות: Overture Maps (ODbL ו-CDLA), Copernicus Sentinel-2 (שימוש חופשי עם ייחוס), Landsat (נחלת הכלל, USGS), data.gov.il (רישיון פתוח), ASHDODMAP (עיריית אשדוד).</p>
      </section>
    </div>
  );
}
