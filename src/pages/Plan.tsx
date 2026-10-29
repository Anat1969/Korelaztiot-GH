import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { motion } from 'motion/react';
import VerbHead from '../components/VerbHead';
import Rich from '../components/Rich';
import MiniMap from '../components/MiniMap';
import { toast } from '../components/Toast';
import { column, UNIT_TYPES, type UnitType } from '../lib/data';
import { MATRIX_KEYS, VAR, fmt } from '../lib/variables';
import { KIND_NAME } from '../lib/config';
import { discoveries, loadScales, toRule, type Rule, type Scales } from '../lib/engine';
import { multiRegression } from '../lib/discover';
import { quantileColors, SEQ_RAMP } from '../lib/color';
import { fr } from '../lib/stats';

const CityMap = lazy(() => import('../components/CityMap'));
const TABS = [{ k: 'rules', label: 'כללים מועמדים' }, { k: 'twin', label: 'תאום עירוני: מה אם' }];

export default function Plan() {
  const [sp] = useSearchParams();
  const tab = TABS.find(t => t.k === sp.get('tab'))?.k ?? 'rules';
  return (
    <div className="page">
      <VerbHead verb="תכנון" base="/plan" tab={tab} tabs={TABS}
        line="כל תגלית הופכת ל**כלל מועמד**: תנאי, תוצאה, איפה הוא חל, וכמה אפשר לסמוך עליו. ==כלל נבחן בשטח לפני שהוא נכנס לתוכנית==." />
      {tab === 'rules' ? <Rules /> : <Twin />}
    </div>
  );
}

function Rules() {
  const [sp] = useSearchParams();
  const scale = (UNIT_TYPES.find(u => u.key === sp.get('u'))?.key ?? 'h3-8') as UnitType;
  // the lab may send the pair in either order
  const raw = sp.get('r');
  const isFocus = (x: string, y: string) => !!raw && (raw === `${x}|${y}` || raw === `${y}|${x}`);
  const [S, setS] = useState<Scales | null>(null);
  const [rules, setRules] = useState<Rule[] | null>(null);
  useEffect(() => {
    Promise.all([loadScales(), discoveries(scale)]).then(([s, d]) => {
      setS(s);
      const pick = d.filter(x => x.q < 0.1 && x.crossFamily).slice(0, 14);
      const extra = raw && !pick.some(x => isFocus(x.x, x.y)) ? d.filter(x => isFocus(x.x, x.y)) : [];
      const all = [...extra, ...pick].map(x => toRule(x, s[scale], scale));
      all.sort((a, b) => (isFocus(a.x, a.y) ? -1 : isFocus(b.x, b.y) ? 1 : b.reliability - a.reliability));
      setRules(all);
    });
  }, [scale, raw]);

  async function adopt(r: Rule) {
    const { saveFinding } = await import('../lib/store');
    const { where } = await saveFinding({
      title: `כלל: ${r.insight}`, x_key: r.x, y_key: r.y, unit_type: r.scale, control_key: r.control ?? null,
      stats: { r: r.d.r, beyond: r.d.beyond, q: r.d.q, nEff: r.d.nEff, reliability: r.reliability, kind: r.kind },
      summary: `${r.condition}: ${r.effect}. ${r.planning}`, note: null,
    });
    toast(where === 'remote' ? 'הכלל אומץ ונשמר בספרייה המשותפת' : 'הכלל נשמר בדפדפן הזה');
  }

  if (!rules || !S) return <div className="card pad muted">גוזר כללים מהתגליות</div>;
  const units = S[scale];
  return (
    <div className="grid" style={{ gap: 16 }} data-testid="rules">
      {rules.map((r, i) => {
        const colors = units.map((_, k) => (r.applies.includes(k) ? '#c8382c' : '#d9dcde'));
        return (
          <motion.article key={r.id} className="card pad" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 6) * 0.05 }}
            style={isFocus(r.x, r.y) ? { outline: '2px solid var(--ink)' } : undefined}>
            <div className="two">
              <div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span className={`kind kind-${r.kind}`}>{KIND_NAME[r.kind]}</span>
                  <span className="small muted">כלל מועמד · {UNIT_TYPES.find(u => u.key === r.scale)?.short}</span>
                </div>
                <h3 className="insight-line" style={{ margin: '10px 0 12px' }}>{r.insight}</h3>
                <div className="grid" style={{ gap: 8 }}>
                  <div className="tone tone-neutral" style={{ padding: '10px 12px' }}><h4>אם</h4><Rich as="p">{r.condition}</Rich></div>
                  <div className="tone tone-insight" style={{ padding: '10px 12px' }}><h4>אז</h4><Rich as="p">{r.effect}</Rich></div>
                  <div className="tone tone-solution" style={{ padding: '10px 12px' }}><h4>מה עושים</h4><Rich as="p">{r.planning}</Rich></div>
                </div>
              </div>
              <div>
                <div className="lbl">איפה הכלל חשוב ({r.applies.length} יחידות)</div>
                <div className="mini" style={{ border: '1px solid var(--line)', background: 'var(--bg-2)' }}><MiniMap units={units} colors={colors} title="יחידות שבהן הכלל חשוב" /></div>
                <div style={{ marginTop: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="lbl">אמינות</span><b className="num">{r.reliability}</b></div>
                  <div className="meter" style={{ height: 6 }}><i style={{ width: `${r.reliability}%`, background: r.reliability >= 70 ? 'var(--ok)' : r.reliability >= 45 ? 'var(--warn)' : 'var(--bad)' }} /></div>
                  <Rich as="p" className="small muted">{`${r.explain} q **${fr(r.d.q, 3)}**, n אפקטיבי **${Math.round(r.d.nEff)}**, ${r.d.consistent ? 'עקבי בקני המידה' : 'לא עקבי בקני המידה'}.`}</Rich>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                  <button className="btn small" onClick={() => adopt(r)}>אימוץ הכלל</button>
                  <Link className="btn ghost small" to={`/plan?tab=twin&y=${r.y}&d=${[r.x, ...(r.control ? [r.control] : [])].join(',')}`}>בדיקה בתאום</Link>
                  <Link className="btn ghost small" to={`/lab?x=${r.x}&y=${r.y}&u=${r.scale}${r.control ? `&c=${r.control}` : ''}`}>במעבדה</Link>
                </div>
              </div>
            </div>
          </motion.article>
        );
      })}
    </div>
  );
}

// ---------- twin: statistical what-if ----------
const FIXED = new Set(['dist_water', 'area', 'plan_density']);

function Twin() {
  const [sp, setSp] = useSearchParams();
  const y = sp.get('y') && VAR[sp.get('y')!] ? sp.get('y')! : 'lst';
  const drivers = (sp.get('d')?.split(',').filter(k => VAR[k] && k !== y) ?? ['green_cover', 'bld_coverage', 'park_share', 'dist_water']).slice(0, 5);
  // quarters by default: the scale at which decisions are taken and vegetation's cooling shows
  const scale = (UNIT_TYPES.find(u => u.key === sp.get('u'))?.key ?? 'quarters') as UnitType;
  const set = (p: Record<string, string>) => { const n = new URLSearchParams(sp); Object.entries(p).forEach(([k, v]) => n.set(k, v)); setSp(n, { replace: true }); };
  const [S, setS] = useState<Scales | null>(null);
  const [sel, setSel] = useState<number | null>(null);
  const [delta, setDelta] = useState<Record<string, number>>({});
  const [citywide, setCitywide] = useState(false);
  useEffect(() => { loadScales().then(setS); }, []);
  useEffect(() => { setDelta({}); setSel(null); }, [y, drivers.join(','), scale]);
  const units = S?.[scale];

  const model = useMemo(() => {
    if (!units) return null;
    const idx = units.map((u, i) => ([y, ...drivers].every(k => u.v[k] != null) ? i : -1)).filter(i => i >= 0);
    const fit = multiRegression(drivers.map(k => idx.map(i => units[i].v[k] as number)), idx.map(i => units[i].v[y] as number), drivers);
    return fit ? { fit, idx } : null;
  }, [units, y, drivers.join(',')]);

  const Y = VAR[y];
  const range = (k: string) => { const v = units ? column(units, k).filter((x): x is number => x != null) : [0]; return [Math.min(...v), Math.max(...v)]; };
  const effect = model ? drivers.reduce((s, k, j) => s + (delta[k] ?? 0) * model.fit.beta[j], 0) : 0;
  const seEff = model ? Math.sqrt(drivers.reduce((s, k, j) => { const se = Math.abs(model.fit.beta[j] / model.fit.t[j]); return s + ((delta[k] ?? 0) * se) ** 2; }, 0)) : 0;
  const worst = useMemo(() => {
    if (!units) return new Set<number>();
    const v = units.map((u, i) => [u.v[y], i] as const).filter(([x]) => x != null) as [number, number][];
    v.sort((a, b) => (Y.good === 'up' ? a[0] - b[0] : b[0] - a[0]));
    return new Set(v.slice(0, Math.ceil(v.length / 4)).map(([, i]) => i));
  }, [units, y]);
  const scenario = useMemo(() => units?.map((u, i) => {
    const base = u.v[y];
    if (base == null) return null;
    const hit = citywide ? worst.has(i) : i === sel;
    return hit ? base + effect : base;
  }) ?? [], [units, effect, citywide, sel, worst, y]);
  // classes are fixed by today's values, so the scenario visibly moves units between classes
  const colors = useMemo(() => quantileColors(scenario, SEQ_RAMP, units ? column(units, y) : []), [scenario, units, y]);

  if (!units || !model) return <div className="card pad muted">בונה את המודל</div>;
  const u = sel != null ? units[sel] : null;

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="tone tone-problem"><h4>חשוב לדעת</h4><Rich as="p">{`זה **מודל סטטיסטי** על **${model.idx.length}** יחידות, לא סימולציה פיזיקלית. הוא אומר מה קורה בדרך כלל באשדוד במקומות שבהם השכבות שונות.`}</Rich></div>
      <div className="card pad">
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end' }}>
          <div style={{ minWidth: 220 }}>
            <label className="lbl" htmlFor="twy">מה משפרים</label>
            <select id="twy" className="field" value={y} onChange={e => set({ y: e.target.value })}>{MATRIX_KEYS.map(k => <option key={k} value={k}>{VAR[k].name}</option>)}</select>
          </div>
          <div className="seg" role="group" aria-label="קנה מידה">{UNIT_TYPES.map(t => <button key={t.key} aria-pressed={scale === t.key} onClick={() => set({ u: t.key })}>{t.short}</button>)}</div>
          <div style={{ flex: 1, minWidth: 260 }}>
            <div className="lbl">מנופים במודל</div>
            <div className="pill-list">{MATRIX_KEYS.filter(k => k !== y).map(k => (
              <button key={k} className="check" aria-pressed={drivers.includes(k)} onClick={() => {
                const next = drivers.includes(k) ? drivers.filter(x => x !== k) : [...drivers, k].slice(-5);
                if (next.length) set({ d: next.join(',') });
              }}>{VAR[k].short}</button>
            ))}</div>
          </div>
        </div>
        <Rich as="p" className="small muted">{`R² **${Math.round(model.fit.r2 * 100)}%** · ${drivers.map((k, j) => `${VAR[k].short} **${fr(model.fit.beta[j], 3, true)}**`).join(' · ')} (${Y.unit} לכל יחידה)`}</Rich>
      </div>

      <div className="two">
        <section className="card mapframe">
          <Suspense fallback={<div className="pad muted">טוען מפה</div>}>
            <CityMap units={units} colors={colors} selected={sel} onSelect={setSel} label={i => `<div style="direction:rtl;text-align:right"><b>${units[i].name}</b><br/>${Y.short}: ${fmt(units[i].v[y], y)}</div>`} />
          </Suspense>
          <div className="map-overlay legend" style={{ bottom: 12, insetInlineEnd: 12 }}>
            <div className="small">{Y.name} {citywide || sel != null ? 'בתרחיש' : 'היום'}</div>
            <div style={{ display: 'flex', direction: 'ltr', marginTop: 4 }}>{SEQ_RAMP.map(c => <span key={c} style={{ width: 18, height: 8, background: c }} />)}</div>
          </div>
        </section>
        <section className="card pad">
          <div className="seg" role="group" aria-label="היקף התרחיש">
            <button aria-pressed={!citywide} onClick={() => setCitywide(false)}>יחידה אחת</button>
            <button aria-pressed={citywide} onClick={() => setCitywide(true)}>כל רבע היחידות הגרוע</button>
          </div>
          {!citywide && !u && <p className="muted" style={{ marginTop: 12 }}>לחצו על משושה במפה כדי לבחור מקום.</p>}
          {(citywide || u) && (
            <>
              <h3 style={{ margin: '14px 0 4px' }}>{citywide ? `${worst.size} היחידות עם ${Y.name} ${Y.good === 'up' ? 'הנמוך' : 'הגבוה'} ביותר` : u!.name}</h3>
              {drivers.map(k => {
                const [lo, hi] = range(k), span = hi - lo, fixed = FIXED.has(k);
                return (
                  <div key={k} style={{ margin: '12px 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>{VAR[k].name}</span>
                      <span className="small">{fixed ? 'קבוע: גיאוגרפיה' : <>שינוי <b className="num">{fr(delta[k] ?? 0, VAR[k].digits > 2 ? 2 : 1, true)}</b> {VAR[k].unit}</>}</span>
                    </div>
                    <input type="range" min={-span / 2} max={span / 2} step="any" value={delta[k] ?? 0} disabled={fixed}
                      onChange={e => setDelta({ ...delta, [k]: +e.target.value })} style={{ width: '100%' }} aria-label={`שינוי ב${VAR[k].name}`} />
                  </div>
                );
              })}
              <div className={`tone ${(effect < 0) === (Y.good === 'down') ? 'tone-solution' : 'tone-problem'}`} data-testid="twin-effect">
                <h4>התוצאה הצפויה</h4>
                <Rich as="p">{`${Y.name} ${effect >= 0 ? 'עולה' : 'יורד'} בכ-**${fmt(Math.abs(effect), y)}** ${Y.unit}, טווח סביר ±**${fmt(1.96 * seEff, y)}**.${citywide ? ` ממוצע העיר זז ב-**${fmt(Math.abs(effect) * worst.size / Math.max(1, units.length), y)}** ${Y.unit}.` : ''}`}</Rich>
              </div>
              <button className="btn ghost small" style={{ marginTop: 10 }} onClick={() => setDelta({})}>איפוס</button>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
