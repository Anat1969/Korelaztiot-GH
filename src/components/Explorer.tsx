import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { motion } from 'motion/react';
import Rich from './Rich';
import SortTable from './SortTable';
import MiniMap from './MiniMap';
import { UNIT_TYPES, type Unit, type UnitType } from '../lib/data';
import { FAMILIES, MATRIX_KEYS, VAR, fmt, type Family } from '../lib/variables';
import { loadScales } from '../lib/engine';
import { breakpoint, kmeans, multiRegression, partialMatrix, zscore } from '../lib/discover';
import { fr, fmtP, pFromR } from '../lib/stats';

const DEFAULT = ['lst', 'green_cover', 'bld_coverage', 'dist_water', 'park_share'];
const CLUSTER = ['#c8382c', '#2b6f9e', '#6fae3f', '#a0662a', '#7a4f86'];

export default function Explorer() {
  const [sp, setSp] = useSearchParams();
  const sel = (sp.get('L')?.split(',').filter(k => MATRIX_KEYS.includes(k)) ?? DEFAULT).slice(0, 8);
  const target = sp.get('t') && sel.includes(sp.get('t')!) ? sp.get('t')! : sel[0];
  const scale = (UNIT_TYPES.find(u => u.key === sp.get('u'))?.key ?? 'h3-8') as UnitType;
  const [units, setUnits] = useState<Unit[] | null>(null);
  useEffect(() => { loadScales().then(S => setUnits(S[scale])); }, [scale]);
  const set = (patch: Record<string, string>) => { const n = new URLSearchParams(sp); Object.entries(patch).forEach(([k, v]) => n.set(k, v)); setSp(n, { replace: true }); };
  const toggle = (k: string) => {
    const next = sel.includes(k) ? sel.filter(x => x !== k) : [...sel, k].slice(-8);
    if (next.length >= 2) set({ L: next.join(','), ...(next.includes(target) ? {} : { t: next[0] }) });
  };

  const out = useMemo(() => {
    if (!units || sel.length < 2) return null;
    const rowsIdx = units.map((u, i) => (sel.every(k => u.v[k] != null && isFinite(u.v[k] as number)) ? i : -1)).filter(i => i >= 0);
    const n = rowsIdx.length;
    if (n < sel.length + 6) return { n, short: true as const };
    const cols = sel.map(k => rowsIdx.map(i => units[i].v[k] as number));
    const P = partialMatrix(cols);
    const edges: { a: number; b: number; r: number; p: number }[] = [];
    if (P) for (let a = 0; a < sel.length; a++) for (let b = a + 1; b < sel.length; b++) {
      const p = pFromR(P[a][b], n - (sel.length - 2));
      if (Math.abs(P[a][b]) >= 0.2 && p < 0.05) edges.push({ a, b, r: P[a][b], p });
    }
    const ti = sel.indexOf(target);
    const others = sel.filter(k => k !== target);
    const fit = multiRegression(others.map(k => cols[sel.indexOf(k)]), cols[ti], others);
    const zc = cols.map(zscore);
    const Z = rowsIdx.map((_, r) => zc.map(c => c[r]));
    const k = Math.min(4, Math.max(2, Math.floor(n / 12)));
    const km = kmeans(Z, k);
    const names = km.centers.map(c => c.map((v, j) => [v, j] as const).sort((x, y) => Math.abs(y[0]) - Math.abs(x[0])).slice(0, 2)
      .map(([v, j]) => `${VAR[sel[j]].short} ${v > 0 ? 'גבוה' : 'נמוך'}`).join(' · '));
    const sizes = km.centers.map((_, j) => km.labels.filter(l => l === j).length);
    const th = others.map(o => ({ o, bp: breakpoint(cols[sel.indexOf(o)], cols[ti]) })).filter(t => t.bp && t.bp.p < 0.01 && t.bp.gain >= 0.1);
    const resid = fit ? rowsIdx.map((ui, r) => ({ ui, e: cols[ti][r] - fit.predict(others.map(o => cols[sel.indexOf(o)][r])) })) : [];
    resid.sort((a, b) => b.e - a.e);
    const clusterColor: (string | null)[] = units.map(() => null);
    rowsIdx.forEach((ui, r) => { clusterColor[ui] = CLUSTER[km.labels[r]]; });
    return { n, short: false as const, P, edges, fit, others, km, names, sizes, th, resid, clusterColor };
  }, [units, sel.join(','), target]);

  const T = VAR[target];
  const drivers = out && !out.short && out.fit ? out.others.map((k, j) => ({ k, b: out.fit!.betaStd[j], p: out.fit!.p[j], vif: out.fit!.vif[j] })).sort((a, b) => Math.abs(b.b) - Math.abs(a.b)) : [];
  const top = drivers[0];

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="card pad">
        <div className="lbl">שכבות לבדיקה (2 עד 8)</div>
        {(Object.keys(FAMILIES) as Family[]).map(f => (
          <div key={f} style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', margin: '6px 0' }}>
            <span className="small muted" style={{ minWidth: 96 }}><span className="dot" style={{ background: FAMILIES[f].color }} /> {FAMILIES[f].name}</span>
            {MATRIX_KEYS.filter(k => VAR[k].family === f).map(k => (
              <button key={k} className="check" aria-pressed={sel.includes(k)} onClick={() => toggle(k)}>{VAR[k].short}</button>
            ))}
          </div>
        ))}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end', marginTop: 12 }}>
          <div style={{ minWidth: 220 }}>
            <label className="lbl" htmlFor="tgt">מה אני רוצה להבין</label>
            <select id="tgt" className="field" value={target} onChange={e => set({ t: e.target.value })}>{sel.map(k => <option key={k} value={k}>{VAR[k].name}</option>)}</select>
          </div>
          <div className="seg" role="group" aria-label="יחידת ניתוח">{UNIT_TYPES.map(u => <button key={u.key} aria-pressed={scale === u.key} onClick={() => set({ u: u.key })}>{u.short}</button>)}</div>
        </div>
      </div>

      {!out && <div className="card pad muted">טוען</div>}
      {out?.short && <div className="tone tone-problem"><h4>מעט מדי יחידות</h4><p>רק {out.n} יחידות עם נתון בכל השכבות. הורידו שכבה או עברו למשושים קטנים.</p></div>}
      {out && !out.short && (
        <>
          <div className="tone tone-insight rise" data-testid="explore-insight">
            <h4 className="insight-line" style={{ fontSize: 20 }}>{top ? `${VAR[top.k].short} מסביר את ${T.short} יותר מכל השאר` : 'אין מודל יציב לשכבות האלה'}</h4>
            {out.fit && <Rich as="p">{`**${Math.round(out.fit.r2 * 100)}%** מהשונות ב${T.name} מוסברת על ידי **${out.others.length}** השכבות, על פני **${out.n}** יחידות.`}</Rich>}
          </div>

          <div className="two">
            <section className="card pad">
              <div className="eyebrow">מי קשור למי</div>
              <Rich as="p" className="hint">{'כל קו מחבר שתי שכבות שקשורות גם כשכל השאר זהה. קו אדום: עולות יחד. קו כחול: אחת עולה והשנייה יורדת. קו עבה: קשר חזק.'}</Rich>
              <Network sel={sel} P={out.P} edges={out.edges} />
            </section>
            <section className="card pad">
              <div className="eyebrow">מה משפיע על {T.name}</div>
              <Rich as="p" className="hint">{`ככל שהפס ארוך יותר, השכבה מסבירה יותר את ${T.name}. פס ימינה באדום: יותר ממנה, יותר ${T.short}. פס שמאלה בכחול: יותר ממנה, פחות ${T.short}. פס חיוור: אולי מקרי.`}</Rich>
              {drivers.map(d => (
                <div key={d.k} style={{ display: 'grid', gridTemplateColumns: '120px minmax(0,1fr) 80px', gap: 8, alignItems: 'center', margin: '8px 0' }}>
                  <span className="small">{VAR[d.k].name}</span>
                  <div className="bar" style={{ direction: 'ltr' }}>
                    <i style={{ insetInlineStart: d.b >= 0 ? '50%' : `${50 + Math.max(-50, d.b * 50)}%`, width: `${Math.min(50, Math.abs(d.b) * 50)}%`, background: d.b >= 0 ? 'var(--heat)' : 'var(--sea)', opacity: d.p < 0.05 ? 1 : 0.35 }} />
                    <b style={{ insetInlineStart: '50%' }} />
                  </div>
                  <span className="small"><b className="num">{fr(d.b, 2, true)}</b> {d.p < 0.05 ? '' : 'אולי מקרי'}</span>
                </div>
              ))}
              {drivers.some(d => d.vif > 5) && <p className="small" style={{ color: 'var(--problem)' }}>שכבות עם VIF מעל 5 חופפות זו לזו. המקדמים שלהן לא יציבים.</p>}
            </section>
          </div>

          <section className="card pad">
            <div className="eyebrow">{out.km.centers.length} סוגי אזורים בעיר</div>
            <Rich as="p" className="hint">{'המכונה מחלקת את העיר לסוגים של מקומות לפי השכבות שבחרת. כל צבע הוא סוג אחד, והשם שלו אומר במה הוא בולט.'}</Rich>
            <div className="two">
              <div>
                <div className="mini" style={{ border: '1px solid var(--line)', background: 'var(--bg-2)' }}><MiniMap units={units!} colors={out.clusterColor} title="מפת טיפולוגיות" /></div>
                <div className="mini-legend">{out.names.map((n, j) => <span key={j}><i style={{ background: CLUSTER[j] }} />{n}</span>)}</div>
              </div>
              <div>
              <SortTable testid="typology-table" initial={{ key: 'n', dir: -1 }}
                rows={out.km.centers.map((c, j) => ({ j, c, name: out.names[j], n: out.sizes[j] }))}
                cols={[
                  { key: 'name', label: 'סוג אזור', value: r => r.name, render: r => <><span className="dot" style={{ background: CLUSTER[r.j] }} /> {r.name}</> },
                  { key: 'n', label: 'יחידות', value: r => r.n, num: true, render: r => <b className="num">{r.n}</b> },
                  ...sel.map((k, t) => ({ key: k, label: VAR[k].short, num: true, value: (r: { c: number[] }) => r.c[t],
                    render: (r: { c: number[] }) => <span className="num" style={{ display: 'block', textAlign: 'center', padding: 2, background: r.c[t] > 0 ? `rgba(200,56,44,${Math.min(0.6, Math.abs(r.c[t]) / 2.5)})` : `rgba(43,111,158,${Math.min(0.6, Math.abs(r.c[t]) / 2.5)})` }}>{fr(r.c[t], 1, true)}</span> })),
                ]} />
              <Rich as="p" className="hint">{'המספר בתא: כמה הסוג רחוק מממוצע העיר. אדום מעל, כחול מתחת.'}</Rich>
              </div>
            </div>
          </section>

          <div className="two">
            <section className="card pad">
              <div className="eyebrow">נקודות מפנה</div>
              {out.th.length ? out.th.map(t => (
                <div key={t.o} className="tone tone-solution" style={{ margin: '8px 0', padding: '10px 12px' }}>
                  <Rich as="p">{`עד **${fmt(t.bp!.k, t.o)} ${VAR[t.o].unit}** של ${VAR[t.o].name}, ${T.short} ${t.bp!.below > 0 ? 'עולה' : 'יורד'} איתו. מעל זה, ${T.short} ${t.bp!.above > 0 ? 'עולה' : 'יורד'}.`}</Rich>
                </div>
              )) : <p className="small muted">לא נמצאה נקודה שבה הקשר עם {T.name} משנה כיוון.</p>}
            </section>
            <section className="card pad">
              <div className="eyebrow">מקומות שבורחים מהכלל</div>
              <Rich as="p" className="hint">{`במקומות האלה ${T.name} רחוק ממה שהשכבות האחרות צופות. ==שם כדאי לחפש בשטח את מה שהנתונים לא רואים==.`}</Rich>
              {[...out.resid.slice(0, 3), ...out.resid.slice(-3).reverse()].map((r, k) => (
                <div key={r.ui} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '6px 0', borderTop: '1px dashed var(--line)' }}>
                  <span>{units![r.ui].name}</span>
                  <span className="small" style={{ color: (r.e > 0) === (T.good === 'down') ? 'var(--problem)' : 'var(--solution)' }}>{k < 3 ? 'מעל' : 'מתחת'} לצפוי ב-<b className="num">{fmt(Math.abs(r.e), target)}</b> {T.unit}</span>
                </div>
              ))}
              <Link className="btn ghost small" style={{ marginTop: 10 }} to={`/plan?tab=twin&y=${target}&d=${out.others.join(',')}`}>לתרחיש בתאום העירוני</Link>
            </section>
          </div>
          <p className="small muted">n = {out.n} יחידות · R² מתוקן {fr(out.fit?.adjR2 ?? NaN)} · p של המודל לפי t לכל מקדם · {fmtP(out.edges[0]?.p)} לקשר החזק ברשת</p>
        </>
      )}
    </div>
  );
}

function Network({ sel, P, edges }: { sel: string[]; P: number[][] | null; edges: { a: number; b: number; r: number }[] }) {
  const R = 120, C = 160;
  const pos = sel.map((_, i) => { const t = (i / sel.length) * 2 * Math.PI - Math.PI / 2; return [C + R * Math.cos(t), C + R * Math.sin(t)]; });
  if (!P) return <p className="small muted">השכבות חופפות מדי לחישוב רשת.</p>;
  return (
    <svg viewBox="0 0 320 320" style={{ width: '100%', maxWidth: 420, direction: 'ltr' }} role="img" aria-label="רשת תלויות בין השכבות">
      {edges.map((e, i) => (
        <motion.line key={i} x1={pos[e.a][0]} y1={pos[e.a][1]} x2={pos[e.b][0]} y2={pos[e.b][1]} stroke={e.r > 0 ? 'var(--heat)' : 'var(--sea)'} strokeWidth={1 + Math.abs(e.r) * 9} strokeOpacity={0.75}
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.8, delay: i * 0.05 }} />
      ))}
      {sel.map((k, i) => (
        <g key={k}>
          <rect x={pos[i][0] - 46} y={pos[i][1] - 13} width={92} height={26} fill="var(--paper)" stroke="var(--ink)" />
          <text x={pos[i][0]} y={pos[i][1] + 4} textAnchor="middle" fontSize="11" fill="var(--ink)" style={{ direction: 'rtl' }}>{VAR[k].short}</text>
        </g>
      ))}
    </svg>
  );
}
