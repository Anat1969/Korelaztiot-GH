import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, Link } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import CityMap, { type Basemap } from '../components/CityMap';
import Scatter from '../components/Scatter';
import Reliability from '../components/Reliability';
import VariableSelect from '../components/VariableSelect';
import { toast } from '../components/Toast';
import { column, loadUnits, UNIT_TYPES, type Unit, type UnitType } from '../lib/data';
import { VAR, fmt } from '../lib/variables';
import { pairsOf, pearson, reliability, fmtP, fr, type PairResult } from '../lib/stats';
import { BIVAR, LISA, LISA_NAME, bivariateColors, quantileColors, rankHeights, SEQ_RAMP } from '../lib/color';
import { runPair } from '../lib/worker-client';
import { narrate } from '../lib/narrative';
import { saveFinding } from '../lib/store';

type Mode = 'bivar' | 'lisa' | 'x' | 'y';
const MODES: { k: Mode; label: string }[] = [
  { k: 'bivar', label: 'דו-משתני' }, { k: 'lisa', label: 'אשכולות' }, { k: 'x', label: 'משתנה X' }, { k: 'y', label: 'משתנה Y' },
];

export default function Lab() {
  const [sp, setSp] = useSearchParams();
  const xKey = sp.get('x') && VAR[sp.get('x')!] ? sp.get('x')! : 'ndvi';
  const yKey = sp.get('y') && VAR[sp.get('y')!] ? sp.get('y')! : 'lst';
  const unit = (UNIT_TYPES.find(u => u.key === sp.get('u'))?.key ?? 'h3-8') as UnitType;
  const control = sp.get('c') && VAR[sp.get('c')!] ? sp.get('c')! : '';
  const mode = (MODES.find(m => m.k === sp.get('m'))?.k ?? 'bivar') as Mode;
  const basemap = (['light', 'dark', 'satellite'].includes(sp.get('b') || '') ? sp.get('b') : 'light') as Basemap;
  const extrude = sp.get('d') === '1';
  const set = (patch: Record<string, string | null>) => {
    const n = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(patch)) v == null || v === '' ? n.delete(k) : n.set(k, v);
    setSp(n, { replace: true });
  };

  const [units, setUnits] = useState<Unit[] | null>(null);
  const [all, setAll] = useState<Partial<Record<UnitType, Unit[]>>>({});
  // a result is only valid for the units it was computed on
  const [pair, setPair] = useState<{ units: Unit[]; key: string; res: PairResult | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [hover, setHover] = useState<number | null>(null); // unit index
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    let live = true;
    setUnits(null); setErr(null);
    loadUnits(unit).then(u => live && setUnits(u)).catch(() => live && setErr('טעינת הנתונים נכשלה. בדקו חיבור ונסו שוב.'));
    Promise.all(UNIT_TYPES.map(t => loadUnits(t.key).then(u => [t.key, u] as const))).then(e => live && setAll(Object.fromEntries(e))).catch(() => {});
    return () => { live = false; };
  }, [unit]);

  useEffect(() => {
    if (!units) return;
    let live = true;
    setBusy(true);
    const key = `${xKey}|${yKey}|${control}`;
    runPair(column(units, xKey), column(units, yKey), units.map(u => u.c), control ? column(units, control) : undefined)
      .then(r => { if (live) { setPair({ units, key, res: r }); setBusy(false); } });
    return () => { live = false; };
  }, [units, xKey, yKey, control]);

  const scale = useMemo(() => UNIT_TYPES.map(t => {
    const us = all[t.key];
    if (!us) return null;
    const { xs, ys } = pairsOf(column(us, xKey), column(us, yKey));
    const r = pearson(xs, ys);
    return isFinite(r) ? { r, label: t.short, key: t.key, n: xs.length } : null;
  }).filter(Boolean) as { r: number; label: string; key: UnitType; n: number }[], [all, xKey, yKey]);

  const res = pair && pair.units === units && pair.key === `${xKey}|${yKey}|${control}` ? pair.res : null;
  const rel = useMemo(() => (res ? reliability(res, scale.length > 1 ? scale : undefined) : null), [res, scale]);
  const story = useMemo(() => (res ? narrate(xKey, yKey, res, control || undefined) : null), [res, xKey, yKey, control]);

  const xsCol = useMemo(() => (units ? column(units, xKey) : []), [units, xKey]);
  const ysCol = useMemo(() => (units ? column(units, yKey) : []), [units, yKey]);
  const colors = useMemo(() => {
    if (!units) return [];
    if (mode === 'x') return quantileColors(xsCol);
    if (mode === 'y') return quantileColors(ysCol);
    if (mode === 'lisa' && res?.lisa) {
      const out: (string | null)[] = units.map(() => null);
      res.idx.forEach((ui, k) => { out[ui] = LISA[res.lisa!.cluster[k]]; });
      return out;
    }
    return bivariateColors(xsCol, ysCol);
  }, [units, mode, xsCol, ysCol, res]);
  const heights = useMemo(() => rankHeights(mode === 'y' ? ysCol : xsCol), [xsCol, ysCol, mode]);

  const unitToK = useMemo(() => { const m = new Map<number, number>(); res?.idx.forEach((ui, k) => m.set(ui, k)); return m; }, [res]);
  const hoverK = hover != null ? unitToK.get(hover) ?? null : null;

  const label = (i: number) => {
    const u = units![i];
    const c = res?.lisa && unitToK.has(i) ? LISA_NAME[res.lisa.cluster[unitToK.get(i)!]] : '';
    return `<div style="font-family:var(--sans);direction:rtl;text-align:right;min-width:150px"><b style="font-weight:500">${u.name ?? ''}</b><div style="font-size:12px;color:#555">${VAR[xKey].short}: ${fmt(u.v[xKey], xKey)}<br/>${VAR[yKey].short}: ${fmt(u.v[yKey], yKey)}${c ? `<br/>${c}` : ''}</div></div>`;
  };

  async function save() {
    if (!res || !story) return;
    const { where } = await saveFinding({
      title: story.headline, x_key: xKey, y_key: yKey, unit_type: unit, control_key: control || null,
      stats: { r: res.r, rho: res.rho, n: res.n, nEff: res.nEff, pSpatial: res.pSpatial, partialR: res.partialR, reliability: rel?.score ?? null },
      summary: story.finding, note: null,
    });
    toast(where === 'remote' ? 'הממצא נשמר ופורסם בספריית הממצאים' : 'הממצא נשמר בדפדפן הזה. לפרסום לכולם נדרש מצב עריכה');
  }

  const sel = selected != null && units ? units[selected] : null;

  return (
    <div className="lab">
      {/* controls */}
      <aside className="side" aria-label="בחירת משתנים">
        <div className="card pad grid">
          <div>
            <div className="eyebrow">מעבדה</div>
            <h3 style={{ marginTop: 4 }}>מה הולך יחד עם מה</h3>
          </div>
          <VariableSelect id="vx" label="משתנה X" value={xKey} onChange={v => set({ x: v })} />
          <button className="btn ghost small" onClick={() => set({ x: yKey, y: xKey })}>החלפת X ו-Y</button>
          <VariableSelect id="vy" label="משתנה Y" value={yKey} onChange={v => set({ y: v })} />
          <VariableSelect id="vc" label="משתנה בקרה (לא חובה)" value={control} onChange={v => set({ c: v })} allowNone exclude={[xKey, yKey]} />
          <div>
            <div className="lbl">יחידת ניתוח</div>
            <div className="seg" role="group" aria-label="יחידת ניתוח">
              {UNIT_TYPES.map(t => <button key={t.key} aria-pressed={unit === t.key} onClick={() => { setSelected(null); set({ u: t.key }); }}>{t.short}</button>)}
            </div>
            <div className="small muted" style={{ marginTop: 6 }}>{UNIT_TYPES.find(t => t.key === unit)!.about}</div>
          </div>
        </div>
        <div className="card flat pad text-block small">
          <div className="lbl">על המשתנים</div>
          <p><b style={{ fontWeight: 500 }}>{VAR[xKey].name}.</b> {VAR[xKey].about} <span className="muted">מקור: {VAR[xKey].source}</span></p>
          <p><b style={{ fontWeight: 500 }}>{VAR[yKey].name}.</b> {VAR[yKey].about} <span className="muted">מקור: {VAR[yKey].source}</span></p>
        </div>
      </aside>

      {/* map */}
      <section className="card mapbox" aria-label="מפה">
        {units && <CityMap units={units} colors={colors} heights={heights} extrude={extrude} basemap={basemap} selected={selected}
          onHover={setHover} onSelect={setSelected} label={label} />}
        {!units && !err && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }} className="muted">טוען את העיר</div>}
        {err && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: 'var(--bad)' }}>{err}</div>}
        <div className="map-overlay" style={{ top: 12, insetInlineStart: 12, display: 'grid', gap: 8, justifyItems: 'start' }}>
          <div className="seg" role="group" aria-label="תצוגת מפה">
            {MODES.map(m => <button key={m.k} aria-pressed={mode === m.k} onClick={() => set({ m: m.k })}>{m.label}</button>)}
          </div>
          <div className="seg" role="group" aria-label="מפת רקע">
            {([['light', 'בהירה'], ['dark', 'כהה'], ['satellite', 'לוויין']] as const).map(([k, l]) => <button key={k} aria-pressed={basemap === k} onClick={() => set({ b: k })}>{l}</button>)}
            <button aria-pressed={extrude} onClick={() => set({ d: extrude ? null : '1' })}>תלת-ממד</button>
          </div>
        </div>
        <div className="map-overlay legend" style={{ bottom: 14, insetInlineEnd: 14 }}>
          {mode === 'bivar' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="bivar" aria-hidden>
                {[2, 1, 0].map(r => [0, 1, 2].map(c => <span key={`${r}${c}`} style={{ background: BIVAR[r][c] }} />))}
              </div>
              <div style={{ lineHeight: 1.5 }}>
                <div><span className="dot" style={{ background: BIVAR[0][2] }} /> {VAR[xKey].short} גבוה</div>
                <div><span className="dot" style={{ background: BIVAR[2][0] }} /> {VAR[yKey].short} גבוה</div>
                <div><span className="dot" style={{ background: BIVAR[2][2] }} /> שניהם גבוהים</div>
              </div>
            </div>
          )}
          {mode === 'lisa' && (
            <div style={{ display: 'grid', gap: 3 }}>
              <div className="small muted">{VAR[xKey].short} ביחידה מול {VAR[yKey].short} בסביבה</div>
              {(['HH', 'LL', 'HL', 'LH', 'ns'] as const).map(c => <div key={c}><span className="dot" style={{ background: LISA[c] }} /> {LISA_NAME[c]}</div>)}
            </div>
          )}
          {(mode === 'x' || mode === 'y') && (
            <div>
              <div className="small">{VAR[mode === 'x' ? xKey : yKey].name}</div>
              <div style={{ display: 'flex', marginTop: 6, direction: 'ltr' }}>{SEQ_RAMP.map(c => <span key={c} style={{ width: 22, height: 10, background: c }} />)}</div>
              <div className="small muted" style={{ display: 'flex', justifyContent: 'space-between', direction: 'ltr' }}><span>נמוך</span><span>גבוה</span></div>
            </div>
          )}
        </div>
        <AnimatePresence>
          {sel && (
            <motion.div className="map-overlay legend" style={{ top: 12, insetInlineEnd: 12, width: 250 }} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <b style={{ fontWeight: 500 }}>{sel.name}</b>
                <button className="btn ghost small" style={{ padding: '2px 10px' }} onClick={() => setSelected(null)}>סגירה</button>
              </div>
              <div className="statgrid" style={{ marginTop: 8 }}>
                {[xKey, yKey, ...(control ? [control] : [])].map(k => <div key={k}><div className="k">{VAR[k].short}</div><div className="v">{fmt(sel.v[k], k)}</div></div>)}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* results */}
      <aside className="side right" aria-label="תוצאות" aria-busy={busy}>
        {!res && <div className="card pad muted">{busy ? 'מחשב: תמורות, bootstrap ואוטוקורלציה מרחבית' : units ? 'אין מספיק יחידות עם נתון בשני המשתנים' : 'טוען'}</div>}
        {res && story && rel && (
          <>
            <motion.div className="card pad" key={xKey + yKey + unit + control} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <div className="eyebrow">{busy ? 'מחשב מחדש' : 'ממצא'}</div>
              <h3 style={{ margin: '6px 0 12px' }} data-testid="headline">{story.headline}</h3>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, flexWrap: 'wrap' }}>
                <div className="r-big" style={{ color: res.r >= 0 ? 'var(--pos)' : 'var(--neg)' }} data-testid="r-value">{fr(res.r, 2, true)}</div>
                <div className="small muted" style={{ paddingBottom: 6 }}>Pearson r<br />{res.n} יחידות</div>
              </div>
              <div className="statgrid" style={{ marginTop: 14 }}>
                <div><div className="k">Spearman ρ</div><div className="v">{fr(res.rho)}</div></div>
                <div><div className="k">p מתוקן מרחבית</div><div className="v">{fmtP(res.pSpatial)}</div></div>
                <div><div className="k">p רגיל / תמורות</div><div className="v">{fmtP(res.p)} / {fmtP(res.pPerm)}</div></div>
                <div><div className="k">n אפקטיבי</div><div className="v">{res.nEff.toFixed(0)}</div></div>
                <div><div className="k">רווח סמך 95%</div><div className="v">{fr(res.ci[0])} עד {fr(res.ci[1])}</div></div>
                <div><div className="k">bootstrap</div><div className="v">{isFinite(res.ciBoot[0]) ? `${fr(res.ciBoot[0])} עד ${fr(res.ciBoot[1])}` : 'לא חושב'}</div></div>
                <div><div className="k">Moran's I של X / Y</div><div className="v">{fr(res.moranX)} / {fr(res.moranY)}</div></div>
                <div><div className="k">R²</div><div className="v">{(res.reg.r2 * 100).toFixed(0)}%</div></div>
                {control && <div style={{ gridColumn: '1 / -1' }}><div className="k">r חלקי בשליטה על {VAR[control].name}</div><div className="v">{res.partialR != null ? `${fr(res.partialR)} (p ${fmtP(res.partialP)})` : 'אין נתון'}</div></div>}
              </div>
              <div style={{ marginTop: 14 }}>
                <Scatter xs={res.idx.map(i => xsCol[i]!)} ys={res.idx.map(i => ysCol[i]!)} colors={res.idx.map(i => colors[i] ?? '')}
                  res={res} xKey={xKey} yKey={yKey} hovered={hoverK} onHover={k => setHover(k == null ? null : res.idx[k])}
                  onSelect={k => setSelected(res.idx[k])} names={res.idx.map(i => units![i].name)} />
              </div>
              {scale.length > 1 && (
                <div style={{ marginTop: 10 }}>
                  <div className="lbl">אותו קשר בקני מידה שונים</div>
                  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${scale.length}, minmax(0,1fr))`, gap: 6 }}>
                    {scale.map(s => (
                      <button key={s.key} className="card flat" style={{ padding: '8px 6px', cursor: 'pointer', textAlign: 'center', outline: s.key === unit ? '2px solid var(--ink)' : 'none' }} onClick={() => set({ u: s.key })}>
                        <div className="mono" style={{ fontSize: 18, color: s.r >= 0 ? 'var(--pos)' : 'var(--neg)' }}>{fr(s.r, 2, true)}</div>
                        <div className="small muted">{s.label}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
            <div className="card pad"><Reliability score={rel.score} parts={rel.parts} /></div>
            <div className="card pad text-block" data-testid="story">
              <div className="eyebrow">פרשנות</div>
              <p style={{ marginTop: 8 }}>{story.finding}</p>
              <p>{story.meaning}</p>
              {story.domain && <p className="muted small">{story.domain}</p>}
              <div className="lbl" style={{ marginTop: 12 }}>הסתייגויות</div>
              <ul>{story.caveats.map((c, i) => <li key={i}>{c}</li>)}</ul>
              <div className="lbl" style={{ marginTop: 12 }}>הצעד הבא</div>
              <p>{story.action}</p>
              {!control && xKey !== 'dist_water' && yKey !== 'dist_water' && (
                <button className="btn ghost small" onClick={() => set({ c: 'dist_water' })}>בדיקה בשליטה על המרחק מהים</button>
              )}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                <button className="btn small" onClick={save}>שמירת הממצא</button>
                <Link className="btn ghost small" to={`/matrix?u=${unit}`}>כל הקשרים במטריצה</Link>
              </div>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
