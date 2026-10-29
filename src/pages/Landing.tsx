import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { motion, useScroll, useTransform } from 'motion/react';
import { column, loadMeta, loadUnits, type Meta, type Unit } from '../lib/data';
import { project } from '../components/MiniMap';
import { quantileColors } from '../lib/color';
import { MATRIX_KEYS, VAR } from '../lib/variables';
import { pairsOf, pearson, partial, fr } from '../lib/stats';
import { runMatrix, type MatrixCell } from '../lib/worker-client';

// pairs that measure the same thing twice are not findings
const SAME = [['lst', 'lst_p90'], ['ndvi', 'green_cover'], ['poi_density', 'food_density', 'retail_density', 'health_density'], ['renewal_projects', 'renewal_units'], ['bld_density', 'bld_coverage', 'ndbi'], ['kinder_density', 'early_density', 'school_density'], ['road_density', 'intersections', 'walk_density']];
const trivial = (a: string, b: string) => SAME.some(g => g.includes(a) && g.includes(b));

function HeroStage({ units }: { units: Unit[] | null }) {
  const [asChart, setAsChart] = useState(false);
  useEffect(() => {
    if (!units) return;
    const t = setInterval(() => setAsChart(v => !v), 4200);
    const first = setTimeout(() => setAsChart(true), 1800);
    return () => { clearInterval(t); clearTimeout(first); };
  }, [units]);

  const g = useMemo(() => {
    if (!units) return null;
    const ok = units.filter(u => u.v.lst != null && u.v.dist_water != null);
    const colors = quantileColors(ok.map(u => u.v.lst ?? null), ['#2b6f9e', '#5a95b8', '#9cc0cf', '#e9dcc0', '#f2b05a', '#e4772f', '#c8382c']);
    const P = ok.map(u => project(u.c));
    const xs = P.map(p => p[0]), ys = P.map(p => p[1]);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    const k = 860 / span;
    const dw = ok.map(u => u.v.dist_water!), lst = ok.map(u => u.v.lst!);
    const [d0, d1] = [Math.min(...dw), Math.max(...dw)], [l0, l1] = [Math.min(...lst), Math.max(...lst)];
    return ok.map((u, i) => {
      const ring = (u.g!.type === 'Polygon' ? u.g!.coordinates[0] : u.g!.coordinates[0][0]) as number[][];
      const shape = ring.map(c => { const [x, y] = project(c); return `${((x - P[i][0]) * k).toFixed(1)},${((y - P[i][1]) * k).toFixed(1)}`; }).join(' ');
      return {
        id: u.id, color: colors[i]!, shape,
        map: { x: 500 + (P[i][0] - cx) * k, y: 500 + (P[i][1] - cy) * k },
        // chart: distance from the sea grows to the left (RTL reading), heat grows upward
        chart: { x: 880 - ((dw[i] - d0) / (d1 - d0)) * 760, y: 880 - ((lst[i] - l0) / (l1 - l0)) * 760 },
      };
    });
  }, [units]);

  const r = useMemo(() => {
    if (!units) return null;
    const { xs, ys } = pairsOf(column(units, 'dist_water'), column(units, 'lst'));
    return pearson(xs, ys);
  }, [units]);

  return (
    <div className="hero-stage" aria-label="הנפשה: משושי העיר הופכים לתרשים פיזור" role="img">
      <div className={`stage-plane ${asChart ? 'flat' : ''}`} style={{ width: '100%', height: '100%' }}>
        <svg viewBox="0 0 1000 1000">
          <defs>
            <filter id="lift" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="6" stdDeviation="8" floodOpacity=".22" /></filter>
            <radialGradient id="floor" cx=".5" cy=".5" r=".6"><stop offset="0" stopColor="var(--paper)" stopOpacity=".9" /><stop offset="1" stopColor="var(--paper)" stopOpacity="0" /></radialGradient>
          </defs>
          <circle cx="500" cy="500" r="480" fill="url(#floor)" />
          <motion.g initial={false} animate={{ opacity: asChart ? 1 : 0 }} transition={{ duration: 0.6 }}>
            <line x1="120" y1="880" x2="900" y2="880" stroke="var(--line-2)" />
            <line x1="900" y1="880" x2="900" y2="100" stroke="var(--line-2)" />
            <text x="510" y="930" textAnchor="middle" fontSize="26" fill="var(--muted)">מרחק מהים</text>
            <text x="950" y="490" textAnchor="middle" fontSize="26" fill="var(--muted)" transform="rotate(90 950 490)">חום פני השטח</text>
          </motion.g>
          {g?.map((h, i) => (
            <motion.g key={h.id} initial={false} animate={{ x: asChart ? h.chart.x : h.map.x, y: asChart ? h.chart.y : h.map.y, scale: asChart ? 0.55 : 1 }}
              transition={{ type: 'spring', stiffness: 60, damping: 14, delay: (i % 25) * 0.012 }}>
              <polygon points={h.shape} fill={h.color} stroke="rgba(255,255,255,.75)" strokeWidth="2" filter="url(#lift)" />
            </motion.g>
          ))}
        </svg>
      </div>
      <div className="hero-caption">{g ? (asChart ? `אותם ${g.length} משושים כתרשים: r = ${fr(r)}` : `אשדוד ב-${g.length} משושים, צבע לפי חום פני השטח`) : 'טוען את העיר'}</div>
    </div>
  );
}

export default function Landing() {
  const [units, setUnits] = useState<Unit[] | null>(null);
  const [quarters, setQuarters] = useState<Unit[] | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [cells, setCells] = useState<(MatrixCell | null)[][] | null>(null);
  const { scrollYProgress } = useScroll();
  const glow = useTransform(scrollYProgress, [0, 1], [0, 220]);

  useEffect(() => {
    loadUnits('h3-8').then(us => { setUnits(us); runMatrix(MATRIX_KEYS, MATRIX_KEYS.map(k => column(us, k)), us.map(u => u.c)).then(d => setCells(d.cells)); });
    loadUnits('quarters').then(setQuarters);
    loadMeta().then(setMeta).catch(() => {});
  }, []);

  const trap = useMemo(() => {
    if (!units || !quarters) return null;
    const pr = (us: Unit[]) => {
      const rows = us.filter(u => u.v.ndvi != null && u.v.lst != null && u.v.dist_water != null);
      const a = rows.map(u => u.v.ndvi!), b = rows.map(u => u.v.lst!), c = rows.map(u => u.v.dist_water!);
      return { raw: pearson(a, b), part: partial(a, b, c) };
    };
    return { hex: pr(units), q: pr(quarters) };
  }, [units, quarters]);

  const top = useMemo(() => {
    if (!cells) return [];
    const out: { a: string; b: string; c: MatrixCell }[] = [];
    cells.forEach((row, i) => row.forEach((c, j) => {
      if (c && j > i && c.q < 0.05 && !trivial(MATRIX_KEYS[i], MATRIX_KEYS[j])) out.push({ a: MATRIX_KEYS[i], b: MATRIX_KEYS[j], c });
    }));
    return out.sort((x, y) => Math.abs(y.c.r) - Math.abs(x.c.r)).slice(0, 6);
  }, [cells]);

  return (
    <>
      <section className="hero">
        <div>
          <motion.div className="eyebrow" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>עיריית אשדוד · מעבדה עירונית לנתונים</motion.div>
          <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} style={{ margin: '14px 0 20px' }}>
            מה הולך יחד<br /><b>עם מה</b> בעיר
          </motion.h1>
          <motion.p className="lead" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
            קורלציות מצליבה נתוני לוויין, בינוי, תנועה, שירותים ותכנון של אשדוד, יחידה מול יחידה. היא מראה איפה דברים הולכים יחד, ובאותה נשימה כמה אפשר לסמוך על כל קשר.
          </motion.p>
          <motion.div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 26 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
            <Link className="btn" to="/lab?x=dist_water&y=lst&u=h3-8" viewTransition>כניסה למעבדה</Link>
            <a className="btn ghost" href="#how">איך זה עובד</a>
          </motion.div>
          <div className="municipal">
            <img src="/ashdod-logo.png" alt="לוגו עיריית אשדוד" />
            <div className="small muted">פרויקט של עיריית אשדוד<br />נתונים: ASHDODMAP, Sentinel-2, Landsat, Overture</div>
          </div>
        </div>
        <HeroStage units={units} />
      </section>

      <section className="band" id="why">
        <div className="eyebrow">למה מעבדה, ולא עוד מפה</div>
        <h2 style={{ margin: '10px 0 14px', maxWidth: '18ch' }}>שלוש מלכודות שמפה רגילה לא מראה</h2>
        <div className="steps">
          <motion.div className="card step" initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <span className="num">01</span>
            <h3>שכנים דומים זה לזה</h3>
            <p className="muted">יחידות סמוכות חולקות אקלים, היסטוריה ובינוי. 75 משושים אינם 75 תצפיות בלתי תלויות. המעבדה מחשבת את המדגם האפקטיבי (Clifford ו-Richardson) ומתקנת את ה-p.</p>
          </motion.div>
          <motion.div className="card step" initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }}>
            <span className="num">02</span>
            <h3>קנה המידה משנה את התשובה</h3>
            <p className="muted">אותו קשר יכול להיות חזק ברמת רובע וחלש ברמת בלוק. כל ניתוח רץ במקביל על רובעים, על משושים גדולים ועל משושים קטנים, ומדד האמינות יורד כשהם לא מסכימים.</p>
          </motion.div>
          <motion.div className="card step" initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }}>
            <span className="num">03</span>
            <h3>משתנה שלישי מסתתר</h3>
            <p className="muted">
              {trap ? <>באשדוד, צמחייה מול חום במשושים: r = {fr(trap.hex.raw)}. בשליטה על המרחק מהים: {fr(trap.hex.part)}. ברמת הרובע, בשליטה: {fr(trap.q.part)}. הבריזה הימית מסתירה את אפקט הקירור של הצמחייה, וקנה המידה קובע כמה ממנו נראה.</> : 'טוען דוגמה חיה מהנתונים'}
            </p>
          </motion.div>
        </div>
      </section>

      <section className="band" id="how" style={{ paddingTop: 30 }}>
        <div className="eyebrow">איך זה עובד</div>
        <h2 style={{ margin: '10px 0 14px' }}>בוחרים שני משתנים. מקבלים ממצא, מפה ומדד אמינות.</h2>
        <div className="steps">
          {[
            ['בוחרים', 'שני משתנים מתוך ' + MATRIX_KEYS.length + ', משתנה בקרה אם רוצים, ויחידת ניתוח: רובע, משושה גדול או משושה קטן.'],
            ['רואים', 'מפה דו-משתנית, מפת אשכולות מקומיים (LISA) שמסמנת איפה הדפוס חריג, ותרשים פיזור עם קו מגמה ורווח סמך. מעבר עכבר מקשר בין המפה לתרשים.'],
            ['מחליטים', 'פרשנות בעברית: מה הקשר אומר ביחידות אמיתיות, מה ההסתייגויות, ומה הצעד הבא. ממצא טוב נשמר לספרייה המשותפת.'],
          ].map(([h, p], i) => (
            <motion.div key={h} className="card step" initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
              <span className="num">{String(i + 1).padStart(2, '0')}</span><h3>{h}</h3><p className="muted">{p}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="band" style={{ paddingTop: 30 }}>
        <motion.div className="card" style={{ overflow: 'hidden', boxShadow: `var(--shadow)` }}>
          <motion.div aria-hidden style={{ position: 'absolute', insetInlineEnd: -120, top: -120, width: 360, height: 360, borderRadius: '50%', background: 'radial-gradient(circle, color-mix(in oklab, var(--a-yellow) 35%, transparent), transparent 70%)', y: glow }} />
          <div className="pad" style={{ padding: 28 }}>
            <div className="eyebrow">ממצאים חיים</div>
            <h2 style={{ margin: '10px 0 6px' }}>הקשרים החזקים בעיר, עכשיו</h2>
            <p className="muted">מחושבים בדפדפן ברגע זה, מ-75 משושים. רק קשרים שעמדו בתיקון המרחבי ובתיקון לבדיקות מרובות.</p>
          </div>
          {!cells && <div className="pad muted">מחשב 300 זוגות</div>}
          {top.map(({ a, b, c }, i) => (
            <motion.div key={a + b} initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }}>
              <Link className="finding-row" to={`/lab?x=${a}&y=${b}&u=h3-8`}>
                <span className="r" style={{ color: c.r > 0 ? 'var(--pos)' : 'var(--neg)' }}>{fr(c.r, 2, true)}</span>
                <span>{c.r > 0 ? 'יותר' : 'פחות'} {VAR[b].name} איפה שיש יותר {VAR[a].name}</span>
                <span className="tag">פתיחה במעבדה</span>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </section>

      <section className="band" style={{ paddingTop: 30 }}>
        <div className="eyebrow">מקורות</div>
        <h2 style={{ margin: '10px 0 6px' }}>חמישה מקורות, תאריך לכל אחד</h2>
        <p className="lead">הנתונים מתעדכנים אוטומטית פעם בחודש. התאריכים כאן הם תאריכי הצילום והגרסה בפועל.</p>
        <div className="sources">
          {[
            ['Landsat 9', meta?.landsat.date, 'טמפרטורת פני שטח, 30 מ\''],
            ['Sentinel-2', meta?.sentinel2.date, 'צמחייה, בינוי ומים, 10 מ\''],
            ['Overture Maps', meta?.overture, `${meta?.counts.buildings?.toLocaleString('he-IL') ?? ''} מבנים, ${meta?.counts.places?.toLocaleString('he-IL') ?? ''} עסקים`],
            ['ASHDODMAP', meta ? meta.generated.slice(0, 10) : undefined, `${meta?.counts.kinder ?? ''} גנים, ${meta?.counts.shimur ?? ''} מבני שימור, רובעים רשמיים`],
          ].map(([n, d, s]) => (
            <div key={n} className="card flat source">
              <div className="mono small muted">{n}</div>
              <div className="big">{d ?? '...'}</div>
              <div className="small muted">{s}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="band" style={{ textAlign: 'center' }}>
        <h2 style={{ marginBottom: 18 }}>שאלה טובה מתחילה בקשר אחד</h2>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link className="btn" to="/lab?x=ndvi&y=lst&u=quarters&c=dist_water">צמחייה וחום, בשליטה על הים</Link>
          <Link className="btn ghost" to="/lab?x=intersections&y=food_density&u=h3-9">צמתים ובתי קפה</Link>
          <Link className="btn ghost" to="/matrix">כל הקשרים</Link>
        </div>
        <img src="/ashdod-logo.png" alt="עיריית אשדוד" style={{ height: 54, marginTop: 40, background: '#fff', padding: '8px 12px', borderRadius: 12 }} />
      </section>
    </>
  );
}
