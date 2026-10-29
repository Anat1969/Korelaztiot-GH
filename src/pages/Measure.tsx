import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { motion } from 'motion/react';
import VerbHead from '../components/VerbHead';
import Rich from '../components/Rich';
import { circle, column, loadPoints, metres, type Points, type Unit } from '../lib/data';
import { VAR, fmt } from '../lib/variables';
import { discoveries, loadScales, toRule, type Rule, type Scales } from '../lib/engine';
import { quantileColors } from '../lib/color';

const CityMap = lazy(() => import('../components/CityMap'));
const Atlas = lazy(() => import('./Atlas'));
const TABS = [{ k: 'place', label: 'פרופיל מקום' }, { k: 'atlas', label: 'אטלס השכבות' }];

// the indicators shown in a place profile, in reading order
const PROFILE = ['lst', 'green_cover', 'green_access', 'bus_access', 'kinder_access', 'bld_coverage', 'poi_density', 'intersections', 'walk_density', 'ndbi'];
const LAYERS = [{ k: 'lst', l: 'חום' }, { k: 'green_cover', l: 'צמחייה' }, { k: 'bus_access', l: 'תחבורה' }, { k: 'kinder_access', l: 'גני ילדים' }, { k: 'bld_coverage', l: 'בינוי' }];
const CAT: Record<string, { name: string; color: string }> = {
  bus: { name: 'תחנת אוטובוס', color: '#2b6f9e' }, kinder: { name: 'גן ילדים', color: '#e4472b' }, school: { name: 'בית ספר', color: '#a0662a' },
  early: { name: 'מעון או משפחתון', color: '#f2b21b' }, parks: { name: 'גן ציבורי', color: '#2f7d4a' }, health: { name: 'שירות בריאות', color: '#7a4f86' },
  food: { name: 'מסעדה או בית קפה', color: '#b8442f' }, retail: { name: 'חנות', color: '#5b5f9a' }, shimur: { name: 'מבנה לשימור', color: '#15191c' }, renewal: { name: 'פרויקט התחדשות', color: '#8a5a3c' },
};
const DEFAULT: [number, number] = [34.6466, 31.7975]; // רובע ה, מרכז העיר הוותיק

export default function Measure() {
  const [sp] = useSearchParams();
  const tab = TABS.find(t => t.k === sp.get('tab'))?.k ?? 'place';
  return (
    <div className="page">
      <VerbHead verb="מדידה" base="/measure" tab={tab} tabs={TABS}
        line="כל נקודה בעיר מקבלת **פרופיל**: מה יש ברדיוס הליכה, איפה היא עומדת ביחס ל**כל העיר**, ו==איזה כלל תכנון חל עליה==." />
      {tab === 'place' ? <Place /> : <Suspense fallback={<div className="muted">טוען</div>}><Atlas embedded /></Suspense>}
    </div>
  );
}

function Place() {
  const [sp, setSp] = useSearchParams();
  const p = (sp.get('p')?.split(',').map(Number) as [number, number] | undefined) ?? DEFAULT;
  const R = [300, 500, 800].includes(Number(sp.get('r'))) ? Number(sp.get('r')) : 500;
  const layer = LAYERS.find(l => l.k === sp.get('layer'))?.k ?? 'lst';
  const set = (patch: Record<string, string>) => { const n = new URLSearchParams(sp); Object.entries(patch).forEach(([k, v]) => n.set(k, v)); setSp(n, { replace: true }); };
  const [S, setS] = useState<Scales | null>(null);
  const [P, setP] = useState<Points | null>(null);
  const [rules, setRules] = useState<Rule[]>([]);
  const [q, setQ] = useState('');
  const [label, setLabel] = useState<string>(sp.get('n') ?? 'רובע ה');
  const [focus, setFocus] = useState<[number, number] | null>(p);
  const [searching, setSearching] = useState(false);
  useEffect(() => {
    loadScales().then(setS); loadPoints().then(setP);
    Promise.all([loadScales(), discoveries('h3-8')]).then(([s, d]) => setRules(d.filter(x => x.q < 0.1 && x.crossFamily).slice(0, 14).map(x => toRule(x, s['h3-8'], 'h3-8'))));
  }, []);

  const fine = S?.['h3-9'];
  const prof = useMemo(() => fine ? profile(fine, p, R) : null, [fine, p[0], p[1], R]);
  const near = useMemo(() => P ? nearby(P, p, R) : null, [P, p[0], p[1], R]);
  const hex8 = useMemo(() => {
    if (!S) return -1;
    let best = -1, bd = Infinity;
    S['h3-8'].forEach((u, i) => { const d = metres(u.c, p); if (d < bd) { bd = d; best = i; } });
    return best;
  }, [S, p[0], p[1]]);
  const here = rules.filter(r => r.applies.includes(hex8));

  const colors = useMemo(() => (fine ? quantileColors(column(fine, layer)) : []), [fine, layer]);
  const overlay = useMemo<GeoJSON.FeatureCollection>(() => ({
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', properties: {}, geometry: circle(p, R) },
      ...(near ? near.items.filter(i => i.d <= R).map(i => ({ type: 'Feature' as const, properties: { color: CAT[i.cat].color, r: 5 }, geometry: { type: 'Point' as const, coordinates: i.c } })) : []),
      { type: 'Feature', properties: { color: '#15191c', r: 8 }, geometry: { type: 'Point', coordinates: p } },
    ],
  }), [p[0], p[1], R, near]);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    const text = q.trim();
    if (!text || !P) return;
    const exact = P.streets.find(s => s[0] === text) ?? P.streets.find(s => s[0].includes(text));
    if (exact) { go([exact[1], exact[2]], exact[0]); return; }
    setSearching(true);
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text + ' אשדוד')}&format=json&limit=1&accept-language=he&viewbox=34.6,31.88,34.73,31.73&bounded=1`);
      const j = await r.json();
      if (j[0]) go([+j[0].lon, +j[0].lat], text);
      else setLabel(`לא נמצא "${text}". נסו שם רחוב, או לחצו על המפה.`);
    } catch { setLabel('החיפוש החיצוני לא זמין. בחרו רחוב מהרשימה או לחצו על המפה.'); }
    setSearching(false);
  }
  function go(c: [number, number], name: string) {
    setLabel(name); setFocus(c);
    set({ p: `${c[0].toFixed(5)},${c[1].toFixed(5)}`, n: name });
  }

  return (
    <div className="grid" style={{ gap: 16 }}>
      <form className="card pad" onSubmit={search} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 8, alignItems: 'end' }} role="search">
        <div>
          <label className="lbl" htmlFor="q">רחוב, כתובת או מקום באשדוד</label>
          <input id="q" className="field" list="streets" value={q} onChange={e => setQ(e.target.value)} placeholder="למשל: הרצל, שדרות ירושלים, מרכז ספיר" />
          <datalist id="streets">{P?.streets.map(s => <option key={s[0] + s[1]} value={s[0]} />)}</datalist>
        </div>
        <button className="btn" type="submit" disabled={searching}>{searching ? 'מחפש' : 'מדידה'}</button>
        <div className="seg" role="group" aria-label="רדיוס הליכה" style={{ gridColumn: '1 / -1' }}>
          {[300, 500, 800].map(r => <button type="button" key={r} aria-pressed={R === r} onClick={() => set({ r: String(r) })}>{r} מ' · {Math.round(r / 80)} דק' הליכה</button>)}
        </div>
      </form>

      <div className="two">
        <section className="card mapframe" aria-label="מפה">
          {fine && <Suspense fallback={<div className="pad muted">טוען מפה</div>}>
            <CityMap units={fine} colors={colors} opacity={0.5} overlay={overlay} focus={focus} onMapClick={c => go(c, 'נקודה שנבחרה במפה')} />
          </Suspense>}
          <div className="map-overlay" style={{ top: 12, insetInlineStart: 12 }}>
            <div className="seg" role="group" aria-label="שכבת רקע">{LAYERS.map(l => <button key={l.k} aria-pressed={layer === l.k} onClick={() => set({ layer: l.k })}>{l.l}</button>)}</div>
          </div>
        </section>

        <section className="grid" style={{ gap: 12, alignContent: 'start' }} data-testid="profile">
          {prof && near && <ProfileView name={label} prof={prof} near={near} R={R} />}
          {!prof && <div className="card pad muted">טוען את שכבות העיר</div>}
        </section>
      </div>

      {prof && near && (
        <div className="two">
          <section className="card pad">
            <div className="eyebrow">איפה המקום עומד מול העיר</div>
            <p className="small muted">אחוזון: כמה מהמשושים בעיר נמוכים מהמקום הזה. הקו השחור הוא חציון העיר.</p>
            {PROFILE.map(k => prof.values[k] != null && (
              <div key={k} style={{ display: 'grid', gridTemplateColumns: '150px minmax(0,1fr) 92px', gap: 10, alignItems: 'center', margin: '9px 0' }}>
                <span className="small">{VAR[k].name}</span>
                <div className="bar" style={{ direction: 'ltr' }}>
                  <motion.i initial={{ width: 0 }} animate={{ width: `${prof.pct[k]}%` }} transition={{ duration: 0.7 }}
                    style={{ background: VAR[k].good ? ((prof.pct[k] > 50) === (VAR[k].good === 'up') ? 'var(--solution)' : 'var(--problem)') : 'var(--sea)' }} />
                  <b style={{ insetInlineStart: '50%' }} />
                </div>
                <span className="small"><b className="num">{fmt(prof.values[k], k)}</b> <span className="muted">{VAR[k].unit}</span></span>
              </div>
            ))}
          </section>
          <section className="card pad">
            <div className="eyebrow">כללי תכנון שחלים כאן</div>
            {here.length ? here.map(r => (
              <Link key={r.id} to={`/plan?tab=rules&r=${encodeURIComponent(r.id)}`} className="tone tone-insight" style={{ display: 'block', margin: '8px 0', textDecoration: 'none' }}>
                <h4>{r.insight}</h4><Rich as="p">{`${r.condition}: ${r.effect}.`}</Rich>
              </Link>
            )) : <p className="small muted">המקום לא נמצא באזור שבו אחד הכללים המועמדים חשוב במיוחד.</p>}
            <div className="eyebrow" style={{ marginTop: 18 }}>ברדיוס {R} מ'</div>
            <div className="pill-list" style={{ marginTop: 8 }}>
              {Object.entries(near.count).filter(([, n]) => n > 0).map(([c, n]) => (
                <span key={c} className="tag"><span className="dot" style={{ background: CAT[c].color }} /> {CAT[c].name} <b className="num">{n}</b></span>
              ))}
            </div>
            {near.named.length > 0 && <ul className="small" style={{ paddingInlineStart: 18, marginTop: 10 }}>{near.named.map(n => <li key={n}>{n}</li>)}</ul>}
          </section>
        </div>
      )}
    </div>
  );
}

// ---------- profile computation ----------
interface Prof { n: number; values: Record<string, number | null>; pct: Record<string, number> }

function profile(units: Unit[], p: [number, number], R: number): Prof {
  let inside = units.map((u, i) => [i, metres(u.c, p)] as const).filter(([, d]) => d <= Math.max(R, 200));
  if (!inside.length) inside = [units.map((u, i) => [i, metres(u.c, p)] as const).sort((a, b) => a[1] - b[1])[0]];
  const values: Record<string, number | null> = {}, pct: Record<string, number> = {};
  for (const k of PROFILE) {
    const v = inside.map(([i]) => units[i].v[k]).filter((x): x is number => x != null);
    values[k] = v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
    const all = column(units, k).filter((x): x is number => x != null);
    pct[k] = values[k] == null ? 0 : Math.round((100 * all.filter(x => x < values[k]!).length) / all.length);
  }
  return { n: inside.length, values, pct };
}

interface Near { items: { cat: string; c: [number, number]; d: number }[]; nearest: Record<string, number>; count: Record<string, number>; named: string[] }

function nearby(P: Points, p: [number, number], R: number): Near {
  const items: Near['items'] = [], nearest: Record<string, number> = {}, count: Record<string, number> = {}, named: string[] = [];
  for (const cat of Object.keys(CAT) as (keyof typeof CAT)[]) {
    const list = (P as unknown as Record<string, number[][]>)[cat] ?? [];
    let best = Infinity;
    count[cat] = 0;
    for (const pt of list) {
      const c: [number, number] = [pt[0], pt[1]];
      // a park is reached at its edge: subtract the radius of a circle with the park's area
      const d = cat === 'parks' ? Math.max(0, metres(c, p) - Math.sqrt((Number(pt[2]) * 10000) / Math.PI)) : metres(c, p);
      if (d < best) best = d;
      if (d <= R) {
        count[cat]++; items.push({ cat, c, d });
        if ((cat === 'shimur' || cat === 'renewal') && typeof pt[2] === 'string') named.push(`${CAT[cat].name}: ${pt[2]}`);
      }
    }
    nearest[cat] = best;
  }
  return { items, nearest, count, named: named.slice(0, 8) };
}

function ProfileView({ name, prof, near, R }: { name: string; prof: Prof; near: Near; R: number }) {
  const checks = [
    { ok: near.nearest.parks <= 300, title: 'גן ציבורי עד 300 מ\'', d: near.nearest.parks, src: 'יעד ארגון הבריאות העולמי (WHO, 2016): גן של חצי דונם ומעלה עד 300 מ\'.' },
    { ok: near.nearest.bus <= 400, title: 'תחנת אוטובוס עד 400 מ\'', d: near.nearest.bus, src: 'סף ההליכה המקובל לתחנה (TCQSM, מדריך איכות השירות בתחבורה ציבורית).' },
    { ok: near.nearest.kinder <= 400, title: 'גן ילדים עד 400 מ\'', d: near.nearest.kinder, src: 'מדד עבודה של המעבדה למרחק הליכה של הורה עם ילד.' },
  ];
  const hot = prof.pct.lst;
  const insight = hot >= 75 ? `חם מ-${hot}% מהעיר` : hot <= 25 ? `קריר מ-${100 - hot}% מהעיר` : `חום בטווח האמצעי של העיר`;
  const passed = checks.filter(c => c.ok).length;
  return (
    <>
      <div className="card pad rise">
        <div className="eyebrow">{name} · רדיוס {R} מ' · {prof.n} משושים</div>
        <h3 className="insight-line" style={{ margin: '8px 0 6px' }}>{insight}, {passed} מתוך 3 יעדי הליכה</h3>
        <Rich as="p" className="small">{`טמפרטורת פני השטח **${fmt(prof.values.lst, 'lst')}°C**, כיסוי ירוק **${fmt(prof.values.green_cover, 'green_cover')}%**, תכסית **${fmt(prof.values.bld_coverage, 'bld_coverage')}%**.`}</Rich>
      </div>
      {checks.map(c => (
        <div key={c.title} className={`tone ${c.ok ? 'tone-solution' : 'tone-problem'}`}>
          <h4>{c.title}: {c.ok ? 'עומד' : 'לא עומד'}</h4>
          <Rich as="p">{`הקרוב ביותר: **${isFinite(c.d) ? Math.round(c.d) : '—'} מ'**. ${c.src}`}</Rich>
        </div>
      ))}
    </>
  );
}
