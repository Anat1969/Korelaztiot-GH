import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import Rich from '../components/Rich';
import { motion } from 'motion/react';
import MiniMap from '../components/MiniMap';
import { column, loadUnits, UNIT_TYPES, type Unit, type UnitType } from '../lib/data';
import { FAMILIES, MATRIX_KEYS, VAR, fmt } from '../lib/variables';
import { quantileColors, SEQ_RAMP } from '../lib/color';

export default function Atlas({ embedded = false }: { embedded?: boolean }) {
  const [sp, setSp] = useSearchParams();
  const unit = (UNIT_TYPES.find(u => u.key === sp.get('u'))?.key ?? 'h3-9') as UnitType;
  const [units, setUnits] = useState<Unit[] | null>(null);
  useEffect(() => { setUnits(null); loadUnits(unit).then(setUnits); }, [unit]);
  return (
    <div className={embedded ? '' : 'page'}>
      <div className="eyebrow">אטלס</div>
      <h2 style={{ margin: '8px 0 12px' }}>העיר ב-{MATRIX_KEYS.length} שכבות</h2>
      <Rich as="p" className="lead">{'כל מפה מציגה משתנה אחד בשבעה מדרגים שווים במספר היחידות. כשמניחים אותן זו לצד זו רואים דפוסים חוזרים: צפון מול דרום, החוף מול המזרח, הרובעים הוותיקים מול החדשים. לחיצה על מפה פותחת אותה במעבדה.'}</Rich>
      <div className="seg" role="group" aria-label="יחידת ניתוח" style={{ margin: '18px 0' }}>{UNIT_TYPES.map(u => <button key={u.key} aria-pressed={unit === u.key} onClick={() => { const n = new URLSearchParams(sp); n.set('u', u.key); setSp(n, { replace: true }); }}>{u.short}</button>)}</div>
      <div className="atlas" data-testid="atlas">
        {MATRIX_KEYS.map((k, i) => {
          const vals = units ? column(units, k).filter((v): v is number => v != null) : [];
          const sorted = [...vals].sort((a, b) => a - b);
          return (
            <motion.div key={k} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: (i % 4) * 0.05 }}>
              <Link to={`/lab?x=${k}&y=${k === 'lst' ? 'ndvi' : 'lst'}&u=${unit}&m=x`} className="card">
                <div className="mini" style={{ background: 'linear-gradient(160deg, var(--bg-2), var(--bg))', padding: 6 }}>
                  {units ? <MiniMap units={units} colors={quantileColors(column(units, k))} title={VAR[k].name} /> : <div style={{ aspectRatio: '1' }} />}
                </div>
                <div className="pad" style={{ paddingTop: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span className="dot" style={{ background: FAMILIES[VAR[k].family].color }} /><b style={{ fontWeight: 400 }}>{VAR[k].name}</b></div>
                  <div className="small muted mono" style={{ marginTop: 4 }}>{sorted.length ? `${fmt(sorted[0], k)} עד ${fmt(sorted[sorted.length - 1], k)} ${VAR[k].unit}` : ''}</div>
                  <div style={{ display: 'flex', marginTop: 8, direction: 'ltr' }}>{SEQ_RAMP.map(c => <span key={c} style={{ flex: 1, height: 5, background: c }} />)}</div>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
