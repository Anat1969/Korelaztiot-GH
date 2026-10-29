import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { motion } from 'motion/react';
import { asset, loadMeta, loadUnits, type Meta, type Unit } from '../lib/data';
import { MATRIX_KEYS, VAR } from '../lib/variables';
import { fr, partial } from '../lib/stats';
import { discoveries } from '../lib/engine';
import { KIND_NAME } from '../lib/config';
import type { Discovery } from '../lib/discover';
import LightTable, { LightTableLegend } from '../components/LightTable';
import MorphStage from '../components/MorphStage';
import Rich from '../components/Rich';
import { NAV } from '../components/Layout';

export default function Landing() {
  const [units, setUnits] = useState<Unit[] | null>(null);
  const [quarters, setQuarters] = useState<Unit[] | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [disc, setDisc] = useState<Discovery[] | null>(null);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    loadUnits('h3-8').then(setUnits);
    loadUnits('quarters').then(setQuarters);
    loadMeta().then(setMeta).catch(() => {});
    discoveries('h3-8').then(setDisc);
  }, []);

  const found = useMemo(() => (disc ?? []).filter(d => d.q < 0.1 && d.crossFamily), [disc]);
  const hidden = found.filter(d => d.kind === 'hidden').length;
  const trap = useMemo(() => {
    if (!quarters) return null;
    const rows = quarters.filter(u => u.v.ndvi != null && u.v.lst != null && u.v.dist_water != null);
    return partial(rows.map(u => u.v.ndvi!), rows.map(u => u.v.lst!), rows.map(u => u.v.dist_water!));
  }, [quarters]);

  const verbNum: Record<string, string> = {
    '/measure': `${meta?.counts.bus_stops ?? 508} תחנות · ${meta?.counts.kinder ?? 578} גנים`,
    '/know': `${found.length || '...'} תגליות ששרדו ניטרול`,
    '/lab': '6 בדיקות אמינות לכל קשר',
    '/plan': `${Math.min(14, found.length) || '...'} כללים מועמדים`,
    '/learn': '4 מסלולים, יומן אישי',
    '/use': 'CSV, GeoJSON, ספרייה משותפת',
  };
  const verbLine: Record<string, string> = {
    '/measure': 'פרופיל לכל נקודה בעיר, מול העיר ומול תקנים.',
    '/know': 'המכונה מחפשת קשרים שלא היינו מחפשים.',
    '/lab': 'קשר אחד לעומק: מפה, תרשים, אמינות.',
    '/plan': 'מתגלית לכלל, ומכלל לתרחיש בתאום העירוני.',
    '/learn': 'שאלות על אשדוד, צעד אחרי צעד.',
    '/use': 'ממצאים שאומצו, ונתונים פתוחים לכל תוכנה.',
  };

  return (
    <>
      <section className="hero">
        <div>
          <motion.div className="eyebrow" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>עיריית אשדוד · מעבדה עירונית לנתונים</motion.div>
          <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} style={{ margin: '14px 0 20px' }}>
            מה הולך יחד<br /><b>עם מה</b> בעיר
          </motion.h1>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
            <Rich as="p" className="lead">{`שכבות שנראות לא קשורות מסתירות **כללי תכנון**. המכונה מוצאת אותם בין **${MATRIX_KEYS.length}** שכבות, ==ואומרת כמה אפשר לסמוך עליהם==.`}</Rich>
          </motion.div>
          <motion.div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 26 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
            <Link className="btn" to="/know" viewTransition>לתגליות</Link>
            <Link className="btn ghost" to="/measure" viewTransition>פרופיל של מקום</Link>
          </motion.div>
          <div className="municipal">
            <img src={asset('/ashdod-logo.png')} alt="לוגו עיריית אשדוד" />
            <div className="small muted">פרויקט של עיריית אשדוד, בדרך ל<b>עיר תאומה</b><br />נתונים: ASHDODMAP, Sentinel-2, Landsat, Overture, משרד התחבורה</div>
          </div>
        </div>
        <div>
          <LightTable units={units} active={active} onActive={setActive} />
          <LightTableLegend active={active} onActive={setActive} />
          <p className="small muted" style={{ textAlign: 'center', marginTop: 8 }}>ארבע שכבות של אשדוד על שולחן אור. כשהן מתיישרות, הדפוס נראה.</p>
        </div>
      </section>

      <section className="band" style={{ paddingTop: 20 }}>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))' }}>
          <div className="tone tone-problem"><h4>הבעיה</h4><Rich as="p">{'כל מחלקה מחזיקה **שכבה משלה**. קשרים בין חום, גנים, תחבורה והתחדשות ==לא נבדקים==.'}</Rich></div>
          <div className="tone tone-solution"><h4>הפתרון</h4><Rich as="p">{'כל השכבות על **אותן יחידות**, ומנוע שסורק **כל זוג** ומנטרל את מה שמובן מאליו.'}</Rich></div>
          <div className="tone tone-insight"><h4>התובנה</h4><Rich as="p">{trap != null ? `ברובעים, בשליטה על הים, הצמחייה מקררת: מתאם חלקי **${fr(trap)}**. ==הים הסתיר את זה==.` : 'טוען דוגמה חיה מהנתונים'}</Rich></div>
        </div>
      </section>

      <section className="band" style={{ paddingTop: 30 }} id="verbs">
        <div className="eyebrow">שש פעולות, כלי אחד</div>
        <h2 style={{ margin: '10px 0 22px' }}>למדוד, לדעת, להבין, לתכנן, ללמוד, להשתמש</h2>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: 14 }}>
          {NAV.map((n, i) => (
            <motion.div key={n.to} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: (i % 3) * 0.07 }}>
              <Link to={n.to} className="card pad" style={{ display: 'block', textDecoration: 'none', minHeight: 170, position: 'relative' }}>
                <span className="mono muted" style={{ position: 'absolute', insetInlineEnd: 16, top: 12, fontSize: 40, opacity: 0.25 }}>0{i + 1}</span>
                <div style={{ fontSize: 34, fontWeight: 200 }}>{n.label}</div>
                <div className="muted small" style={{ margin: '2px 0 10px' }}>{n.sub}</div>
                <div>{verbLine[n.to]}</div>
                <div className="small mono" style={{ marginTop: 10, color: 'var(--accent)' }}>{verbNum[n.to]}</div>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="band" style={{ paddingTop: 30 }}>
        <div className="eyebrow">תגליות חיות</div>
        <h2 style={{ margin: '10px 0 6px' }}>{hidden ? `${hidden} קשרים נסתרים, ${found.length} תגליות` : 'מה המכונה מצאה עכשיו'}</h2>
        <p className="muted">מחושב בדפדפן, ברגע זה, על כל הזוגות ובשלושה קני מידה.</p>
        <div className="card" style={{ overflow: 'hidden', marginTop: 14 }}>
          {!disc && <div className="pad muted">סורק</div>}
          {found.slice(0, 6).map((d, i) => {
            const v = d.kind === 'hidden' ? d.hidden!.partialR : d.beyond;
            return (
              <motion.div key={d.x + d.y} initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}>
                <Link className="finding-row" to={`/lab?x=${d.x}&y=${d.y}&u=h3-8${d.hidden && d.hidden.by !== 'urbanity' ? `&c=${d.hidden.by}` : ''}`}>
                  <span className="r" style={{ color: v > 0 ? 'var(--pos)' : 'var(--neg)' }}>{fr(v, 2, true)}</span>
                  <span>{VAR[d.x].name} ו{VAR[d.y].name}</span>
                  <span className={`kind kind-${d.kind}`}>{KIND_NAME[d.kind]}</span>
                </Link>
              </motion.div>
            );
          })}
        </div>
        <Link className="btn ghost" style={{ marginTop: 14 }} to="/know">לכל התגליות</Link>
      </section>

      <section className="band two" style={{ paddingTop: 30, alignItems: 'center' }}>
        <div>
          <div className="eyebrow">איך נראית קורלציה</div>
          <h2 style={{ margin: '10px 0 14px' }}>אותם משושים, פעם מפה ופעם תרשים</h2>
          <Rich as="p" className="lead">{'כל משושה עובר מהמקום שלו בעיר למקום שלו בתרשים: **מרחק מהים** מול **חום**. ==כשהם מסתדרים בקו, יש קשר==.'}</Rich>
        </div>
        <MorphStage units={units} />
      </section>

      <section className="band" style={{ paddingTop: 30 }}>
        <div className="eyebrow">מקורות</div>
        <h2 style={{ margin: '10px 0 6px' }}>חמישה מקורות, תאריך לכל אחד</h2>
        <div className="sources">
          {[
            ['Landsat 9', meta?.landsat.date, 'טמפרטורת פני שטח, 30 מ\''],
            ['Sentinel-2', meta?.sentinel2.date, 'צמחייה, בינוי ומים, 10 מ\''],
            ['Overture Maps', meta?.overture, `${meta?.counts.buildings?.toLocaleString('he-IL') ?? ''} מבנים, ${meta?.counts.places?.toLocaleString('he-IL') ?? ''} עסקים`],
            ['משרד התחבורה', meta ? meta.generated.slice(0, 10) : undefined, `${meta?.counts.bus_stops ?? ''} תחנות אוטובוס`],
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
        <h2 style={{ marginBottom: 18 }}>שאלה טובה מתחילה בשתי שכבות</h2>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link className="btn" to="/know?tab=pick">אני בוחרת שכבות</Link>
          <Link className="btn ghost" to="/plan?tab=twin">תאום עירוני: מה אם</Link>
          <Link className="btn ghost" to="/learn">מסלול למידה</Link>
        </div>
        <img src={asset('/ashdod-logo.png')} alt="עיריית אשדוד" style={{ height: 54, marginTop: 40, background: '#fff', padding: '8px 12px' }} />
        <p className="small muted" style={{ marginTop: 14 }}>מקור השראה: איאן מקהרג (Ian McHarg), Design with Nature, ‏1969: שכבות שקופות על שולחן אור.</p>
      </section>
    </>
  );
}
