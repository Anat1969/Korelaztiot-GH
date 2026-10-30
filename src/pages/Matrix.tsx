import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import Rich from '../components/Rich';
import { motion } from 'motion/react';
import { column, loadUnits, UNIT_TYPES, type UnitType } from '../lib/data';
import { MATRIX_KEYS, VAR, FAMILIES } from '../lib/variables';
import { runMatrix, type MatrixCell } from '../lib/worker-client';
import { rColor } from '../lib/color';
import { fmtP, fr, chance } from '../lib/stats';

export default function Matrix({ embedded = false }: { embedded?: boolean }) {
  const [sp, setSp] = useSearchParams();
  const unit = (UNIT_TYPES.find(u => u.key === sp.get('u'))?.key ?? 'h3-8') as UnitType;
  const onlySig = sp.get('s') !== '0';
  const [cells, setCells] = useState<(MatrixCell | null)[][] | null>(null);
  const [tip, setTip] = useState<{ i: number; j: number } | null>(null);
  const nav = useNavigate();

  useEffect(() => {
    let live = true;
    setCells(null);
    loadUnits(unit).then(us => runMatrix(MATRIX_KEYS, MATRIX_KEYS.map(k => column(us, k)), us.map(u => u.c))).then(d => live && setCells(d.cells));
    return () => { live = false; };
  }, [unit]);

  const top = useMemo(() => {
    if (!cells) return [];
    const out: { i: number; j: number; c: MatrixCell }[] = [];
    cells.forEach((row, i) => row.forEach((c, j) => { if (c && j > i && c.q < 0.05) out.push({ i, j, c }); }));
    return out.sort((a, b) => Math.abs(b.c.r) - Math.abs(a.c.r)).slice(0, 8);
  }, [cells]);

  const set = (k: string, v: string) => { const n = new URLSearchParams(sp); n.set(k, v); setSp(n, { replace: true }); };
  const t = tip && cells?.[tip.i][tip.j];

  const Wrap = embedded ? 'div' : 'section';
  return (
    <Wrap className={embedded ? '' : 'page'}>
      {!embedded && <><div className="eyebrow">מטריצת קשרים</div>
      <h2 style={{ margin: '8px 0 12px' }}>כל המשתנים מול כל המשתנים</h2></>}
      <Rich as="p" className="lead">{`כל שורה וכל עמודה היא שכבה. כל תא אומר עד כמה שתי השכבות הולכות יחד בעיר. ==אדום: עולות יחד. כחול: אחת עולה והשנייה יורדת==. המספר הוא העוצמה, מ-100 עד 100-. כשבודקים ${(MATRIX_KEYS.length * (MATRIX_KEYS.length - 1)) / 2} זוגות, חלקם ייראו קשורים במקרה, ולכן "רק קשרים בטוחים" מסתיר אותם. לחיצה על תא פותחת אותו במעבדה.`}</Rich>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '18px 0' }}>
        <div className="seg" role="group" aria-label="יחידת ניתוח">{UNIT_TYPES.map(u => <button key={u.key} aria-pressed={unit === u.key} onClick={() => set('u', u.key)}>{u.short}</button>)}</div>
        <div className="seg" role="group" aria-label="סינון"><button aria-pressed={onlySig} onClick={() => set('s', '1')}>רק קשרים בטוחים</button><button aria-pressed={!onlySig} onClick={() => set('s', '0')}>הכול</button></div>
      </div>
      <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1fr)', gap: 18 }}>
        <div className="card pad matrix-wrap" data-testid="matrix">
          {!cells ? <div className="muted">מחשב {(MATRIX_KEYS.length * (MATRIX_KEYS.length - 1)) / 2} זוגות</div> : (
            <table className="matrix" onMouseLeave={() => setTip(null)}>
              <thead><tr><th />{MATRIX_KEYS.map(k => <th key={k} scope="col"><span className="dot" style={{ background: FAMILIES[VAR[k].family].color, marginInlineEnd: 4 }} />{VAR[k].short}</th>)}</tr></thead>
              <tbody>
                {MATRIX_KEYS.map((ki, i) => (
                  <tr key={ki}>
                    <th scope="row"><span className="dot" style={{ background: FAMILIES[VAR[ki].family].color, marginInlineEnd: 6 }} />{VAR[ki].short}</th>
                    {MATRIX_KEYS.map((kj, j) => {
                      const c = cells[i][j];
                      if (i === j) return <td key={kj} style={{ background: 'var(--line)', cursor: 'default' }} />;
                      const show = c && (!onlySig || c.q < 0.05);
                      return (
                        <td key={kj} onMouseEnter={() => setTip({ i, j })} onFocus={() => setTip({ i, j })} tabIndex={c ? 0 : -1}
                          onClick={() => nav(`/lab?x=${ki}&y=${kj}&u=${unit}`)} onKeyDown={e => { if (e.key === 'Enter') nav(`/lab?x=${ki}&y=${kj}&u=${unit}`); }}
                          style={{ background: show ? rColor(c!.r) : 'transparent', color: show && Math.abs(c!.r) > 0.55 ? '#fff' : 'var(--ink-2)', border: c ? '1px solid var(--line)' : 'none' }}
                          aria-label={c ? `${VAR[ki].name} מול ${VAR[kj].name}: r ${c.r.toFixed(2)}` : undefined}>
                          {show ? fr(c!.r * 100, 0) : ''}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="small muted" style={{ marginTop: 10, minHeight: 22 }}>
            {t ? <Rich as="span">{`**${VAR[MATRIX_KEYS[tip!.i]].name}** ו**${VAR[MATRIX_KEYS[tip!.j]].name}**: ${t.r > 0 ? 'עולות יחד' : 'אחת עולה והשנייה יורדת'}, עוצמה **${fr(t.r)}**. הסיכוי שזה מקרי: **${chance(t.q)}**.`}</Rich> : 'מעבר עכבר על תא מסביר אותו.'}
          </div>
        </div>
        <div className="card pad">
          <div className="eyebrow">הקשרים החזקים שעמדו בכל התיקונים</div>
          {top.map(({ i, j, c }, k) => (
            <motion.a key={`${i}-${j}`} className="finding-row" href={`/lab?x=${MATRIX_KEYS[i]}&y=${MATRIX_KEYS[j]}&u=${unit}`} onClick={e => { e.preventDefault(); nav(`/lab?x=${MATRIX_KEYS[i]}&y=${MATRIX_KEYS[j]}&u=${unit}`); }}
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: k * 0.05 }}>
              <span className="r" style={{ color: c.r > 0 ? 'var(--pos)' : 'var(--neg)' }}>{fr(c.r, 2, true)}</span>
              <span>{VAR[MATRIX_KEYS[i]].name} ו{VAR[MATRIX_KEYS[j]].name}</span>
              <span className="tag">q {fmtP(c.q)}</span>
            </motion.a>
          ))}
          {cells && !top.length && <div className="muted" style={{ marginTop: 10 }}>אין קשרים שעמדו בכל התיקונים בקנה המידה הזה.</div>}
        </div>
      </div>
    </Wrap>
  );
}
