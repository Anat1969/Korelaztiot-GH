import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { motion } from 'motion/react';
import VerbHead from '../components/VerbHead';
import Rich from '../components/Rich';
import MiniScatter from '../components/MiniScatter';
import MiniMap from '../components/MiniMap';
import { column, UNIT_TYPES, type UnitType } from '../lib/data';
import { FAMILIES, VAR } from '../lib/variables';
import { KIND_ABOUT, KIND_NAME } from '../lib/config';
import { discoveries, loadScales, toRule, type Scales } from '../lib/engine';
import type { Discovery, Kind } from '../lib/discover';
import { pairsOf, fr } from '../lib/stats';
import { bivariateColors } from '../lib/color';

const Explorer = lazy(() => import('../components/Explorer'));
const Matrix = lazy(() => import('./Matrix'));

const TABS = [{ k: 'auto', label: 'המכונה מחפשת' }, { k: 'pick', label: 'אני בוחרת שכבות' }, { k: 'matrix', label: 'מטריצה מלאה' }];

export default function Know() {
  const [sp, setSp] = useSearchParams();
  const tab = TABS.find(t => t.k === sp.get('tab'))?.k ?? 'auto';
  return (
    <div className="page">
      <VerbHead verb="ידיעה" base="/know" tab={tab} tabs={TABS}
        line="המכונה סורקת **כל זוג שכבות** בשלושה קני מידה, מנטרלת את **עוצמת העירוניות**, ומחזירה רק את ==מה שלא היינו מחפשים==." />
      {tab === 'auto' && <Auto sp={sp} setSp={setSp} />}
      <Suspense fallback={<div className="muted">טוען</div>}>
        {tab === 'pick' && <Explorer />}
        {tab === 'matrix' && <Matrix embedded />}
      </Suspense>
    </div>
  );
}

function Auto({ sp, setSp }: { sp: URLSearchParams; setSp: (p: URLSearchParams, o?: { replace?: boolean }) => void }) {
  const scale = (UNIT_TYPES.find(u => u.key === sp.get('u'))?.key ?? 'h3-8') as UnitType;
  const kind = (sp.get('k') as Kind | 'all') || 'all';
  const cross = sp.get('x') !== '0';
  const [res, setRes] = useState<Discovery[] | null>(null);
  const [S, setS] = useState<Scales | null>(null);
  useEffect(() => { setRes(null); discoveries(scale).then(setRes); loadScales().then(setS); }, [scale]);
  const set = (k: string, v: string) => { const n = new URLSearchParams(sp); n.set(k, v); setSp(n, { replace: true }); };

  const list = useMemo(() => (res ?? []).filter(d => d.q < 0.1 && (kind === 'all' || d.kind === kind) && (!cross || d.crossFamily)).slice(0, 24), [res, kind, cross]);
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: 0 };
    (res ?? []).filter(d => d.q < 0.1 && (!cross || d.crossFamily)).forEach(d => { c.all++; c[d.kind] = (c[d.kind] ?? 0) + 1; });
    return c;
  }, [res, cross]);

  return (
    <>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', marginBottom: 18 }}>
        <div className="tone tone-problem"><h4>הבעיה</h4><Rich as="p">רוב הקשרים בעיר הם **עוד עיר**: איפה שיש מבנים יש גם כבישים, עסקים ותחנות.</Rich></div>
        <div className="tone tone-solution"><h4>מה המכונה עושה</h4><Rich as="p">בונה מדד **עוצמה עירונית** ומנטרלת אותו. נשאר רק **מה ששורד** את הניטרול.</Rich></div>
        <div className="tone tone-insight"><h4>התוצאה</h4><Rich as="p">==כללי תכנון מועמדים==, כל אחד עם ראיות, קני מידה ומדד אמינות.</Rich></div>
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 18 }}>
        <div className="seg" role="group" aria-label="קנה מידה מוביל">{UNIT_TYPES.map(u => <button key={u.key} aria-pressed={scale === u.key} onClick={() => set('u', u.key)}>{u.short}</button>)}</div>
        <div className="seg" role="group" aria-label="סוג קשר">
          {(['all', 'hidden', 'threshold', 'nonlinear', 'linear'] as const).map(k => (
            <button key={k} aria-pressed={kind === k} onClick={() => set('k', k)}>{k === 'all' ? 'הכול' : KIND_NAME[k]} <span className="num">{counts[k] ?? 0}</span></button>
          ))}
        </div>
        <button className="check" aria-pressed={cross} onClick={() => set('x', cross ? '0' : '1')}>רק בין תחומים שונים</button>
      </div>
      {kind !== 'all' && <p className="muted small" style={{ marginTop: -8 }}>{KIND_ABOUT[kind]}</p>}
      {!res && <div className="card pad muted">סורק את כל הזוגות בשלושה קני מידה</div>}
      {res && !list.length && <div className="card pad">אין תגליות שעומדות בסף בבחירה הזו. נסו קנה מידה אחר או בטלו את הסינון.</div>}
      <div className="disc-grid" data-testid="discoveries">
        {S && list.map((d, i) => <DiscoveryCard key={d.x + d.y} d={d} S={S} scale={scale} i={i} />)}
      </div>
    </>
  );
}

function DiscoveryCard({ d, S, scale, i }: { d: Discovery; S: Scales; scale: UnitType; i: number }) {
  const units = S[scale];
  const rule = useMemo(() => toRule(d, units, scale), [d, units, scale]);
  const pts = useMemo(() => pairsOf(column(units, d.x), column(units, d.y)), [units, d]);
  const colors = useMemo(() => bivariateColors(column(units, d.x), column(units, d.y)), [units, d]);
  const fx = FAMILIES[VAR[d.x].family], fy = FAMILIES[VAR[d.y].family];
  const lab = `/lab?x=${d.x}&y=${d.y}&u=${scale}${rule.control ? `&c=${rule.control}` : ''}`;
  return (
    <motion.article className="card pad" initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: (i % 3) * 0.06 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
        <span className={`kind kind-${d.kind}`}>{KIND_NAME[d.kind]}</span>
        <span className="small muted">אמינות <b className="num">{rule.reliability}</b></span>
      </div>
      <h3 className="insight-line" style={{ margin: '12px 0 6px' }}>{rule.insight}</h3>
      <Rich as="p" className="small" >{rule.explain}</Rich>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 8, margin: '10px 0' }}>
        <MiniScatter xs={pts.xs} ys={pts.ys} k={d.kind === 'threshold' ? d.bp?.k : undefined} color={d.r >= 0 ? 'var(--heat)' : 'var(--sea)'} title={`${VAR[d.x].name} מול ${VAR[d.y].name}`} />
        <div className="mini" style={{ border: '1px solid var(--line)', background: 'var(--bg-2)' }}><MiniMap units={units} colors={colors} title="מפה דו-משתנית" /></div>
      </div>
      <div className="small" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <span><span className="dot" style={{ background: fx.color }} /> {VAR[d.x].name}</span>
        <span className="muted">מול</span>
        <span><span className="dot" style={{ background: fy.color }} /> {VAR[d.y].name}</span>
      </div>
      <div className="small muted" style={{ marginTop: 6 }}>
        {d.scales.map(s => <span key={s.key} style={{ marginInlineEnd: 10 }}>{UNIT_TYPES.find(u => u.key === s.key)?.short} <b className="num" style={{ color: s.r >= 0 ? 'var(--pos)' : 'var(--neg)' }}>{fr(s.r, 2, true)}</b></span>)}
      </div>
      <div className="tone tone-solution" style={{ marginTop: 10, padding: '10px 12px' }}>
        <Rich as="p">{`**${rule.condition}**, ${rule.effect}.`}</Rich>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
        <Link className="btn small" to={lab}>הבנה במעבדה</Link>
        <Link className="btn ghost small" to={`/plan?tab=rules&r=${encodeURIComponent(rule.id)}&u=${scale}`}>לכלל תכנון</Link>
      </div>
    </motion.article>
  );
}

