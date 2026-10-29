import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { motion } from 'motion/react';
import { pearson, rng, fr } from '../lib/stats';

/** Synthetic sample with a target correlation, for the interactive explainer. */
function sample(rho: number, n = 80) {
  const rand = rng(7);
  const gauss = () => { const u = Math.max(1e-9, rand()), v = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const pts = Array.from({ length: n }, () => { const a = gauss(), b = gauss(); return [a, rho * a + Math.sqrt(1 - rho * rho) * b] as const; });
  return pts;
}

function Demo() {
  const [rho, setRho] = useState(0.6);
  const pts = useMemo(() => sample(rho), [rho]);
  const r = pearson(pts.map(p => p[0]), pts.map(p => p[1]));
  return (
    <div className="card pad" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 20, alignItems: 'center' }}>
      <svg viewBox="-3.4 -3.4 6.8 6.8" style={{ width: '100%', direction: 'ltr', background: 'linear-gradient(160deg, var(--bg-2), var(--paper))' }} aria-label="הדגמת מקדם מתאם">
        <line x1="-3.2" x2="3.2" y1="0" y2="0" stroke="var(--line-2)" strokeWidth="0.02" />
        <line y1="-3.2" y2="3.2" x1="0" x2="0" stroke="var(--line-2)" strokeWidth="0.02" />
        {pts.map((p, i) => <motion.circle key={i} r={0.08} fill={rho >= 0 ? 'var(--pos)' : 'var(--neg)'} fillOpacity={0.75} animate={{ cx: p[0], cy: -p[1] }} transition={{ type: 'spring', stiffness: 120, damping: 16 }} />)}
      </svg>
      <div>
        <div className="eyebrow">נסו בעצמכם</div>
        <div className="r-big" style={{ margin: '8px 0', color: r >= 0 ? 'var(--pos)' : 'var(--neg)' }}>{fr(r, 2, true)}</div>
        <input type="range" min={-0.95} max={0.95} step={0.05} value={rho} onChange={e => setRho(+e.target.value)} style={{ width: '100%' }} aria-label="עוצמת הקשר" />
        <p className="small muted">‎+1 הוא קו עולה מושלם, ‎-1 הוא קו יורד מושלם, ו-0 הוא ענן בלי כיוון. גם ענן רחב יכול להיות מובהק כשיש הרבה נקודות, ולכן מובהקות אינה עוצמה.</p>
      </div>
    </div>
  );
}

export default function Method({ embedded = false }: { embedded?: boolean }) {
  return (
    <div className={embedded ? '' : 'page'}>
      <div className="prose">
        <div className="eyebrow">שיטה</div>
        <h2 style={{ marginTop: 10 }}>איך המעבדה מחשבת, ואיך היא בודקת את עצמה</h2>
        <p className="lead">קורלציה היא מספר אחד שמסכם כמה שני משתנים נעים יחד. במרחב עירוני המספר הזה מטעה בקלות. המעבדה מחשבת אותו, ומיד אחר כך מנסה להפיל אותו בשש בדיקות.</p>
      </div>
      <div style={{ margin: '28px 0', maxWidth: 900 }}><Demo /></div>
      <div className="prose">
        <h2>יחידות ניתוח</h2>
        <p>כל משתנה מחושב לשלוש רמות: 35 הרובעים בגבולות הרשמיים של ה-GIS העירוני, 75 משושי H3 ברזולוציה 8 (כ-0.7 קמ"ר), ו-530 משושים ברזולוציה 9 (כ-0.1 קמ"ר). משושים אחידים בשטח ואינם תלויים בגבולות מנהליים. רובעים הם היחידה שבה מתקבלות החלטות. ברמה 1 של הכלי, החישוב נעשה על רשת 8 על 8 שנגזרה מגבולות המסך, ולכן הזזת המפה שינתה את התוצאה. כאן היחידות קבועות.</p>

        <h2>המדדים עצמם</h2>
        <ul>
          <li><b>חום:</b> ערוץ תרמי של Landsat 9 (Collection 2 Level 2, ST_B10), המרה לצלזיוס לפי מקדמי USGS. נבחרת הסצנה הבהירה ביותר מהקיץ האחרון.</li>
          <li><b>צמחייה, בינוי ומים:</b> NDVI, ‏NDBI ו-NDWI מ-Sentinel-2 L2A, מהסצנה הבהירה הקרובה ביותר בזמן לצילום ה-Landsat, כדי ששני הצדדים יתארו את אותם ימים. פיקסלי ענן וצל מסוננים לפי שכבת SCL.</li>
          <li><b>יבשה בלבד:</b> פיקסלי מים (NDWI גדול מ-0) הוצאו מחישובי החום והצמחייה. בלי זה, ים קר ונטול צמחייה הופך את הקשר בין צמחייה לחום.</li>
          <li><b>בינוי, תנועה ושירותים:</b> Overture Maps, הגרסה החודשית האחרונה: טביעות מבנים, קטעי דרך, שימושי קרקע ונקודות עניין פעילות.</li>
          <li><b>חינוך, שימור, התחדשות ותכנון:</b> מאגר ASHDODMAP של העירייה.</li>
        </ul>

        <h2>שש הבדיקות מאחורי מדד האמינות</h2>
        <h3>1. מובהקות מרחבית</h3>
        <p>יחידות שכנות דומות זו לזו (אוטוקורלציה מרחבית), ולכן יש בהן פחות מידע בלתי תלוי ממספרן. המעבדה מודדת את Moran's I לכל משתנה, על שכנות של 6 השכנים הקרובים, ומחשבת מדגם אפקטיבי: n' = n(1 − Ix·Iy) / (1 + Ix·Iy), לפי Clifford, Richardson ו-Hémon (1989). ה-p מחושב מחדש על n'.</p>
        <h3>2. גודל המדגם האפקטיבי</h3>
        <p>פחות מ-30 יחידות בלתי תלויות מוריד את הציון.</p>
        <h3>3. רוחב רווח הסמך</h3>
        <p>רווח סמך של 95% לפי טרנספורמציית Fisher, ובנוסף bootstrap של 999 דגימות חוזרות. רווח רחב פירושו שהמספר עצמו לא יציב.</p>
        <h3>4. הסכמה בין Pearson ל-Spearman</h3>
        <p>Pearson מודד קשר ליניארי, ו-Spearman מודד קשר מונוטוני לפי דירוגים (עם טיפול נכון בערכים שווים). פער גדול ביניהם מסמן ערכים חריגים או קשר עקום.</p>
        <h3>5. יציבות להוצאת יחידה</h3>
        <p>Jackknife: מחשבים את r שוב, בכל פעם בלי יחידה אחרת. אם יחידה אחת מזיזה את התוצאה, הממצא שלה ולא של העיר.</p>
        <h3>6. עקביות בין קני מידה</h3>
        <p>בעיית יחידת השטח המשתנה (MAUP, ‏Openshaw 1984). קשר שמתהפך בין רובעים למשושים אינו בסיס להחלטה.</p>
        <p>הציון הוא ממוצע גיאומטרי משוקלל של שש הבדיקות, ולכן בדיקה אחת שנכשלה מורידה אותו גם כשהאחרות טובות. 70 ומעלה: אפשר להישען. 45 עד 70: כיוון לבדיקה. מתחת ל-45: לא לבסס החלטה.</p>

        <h2>מעבר למספר אחד</h2>
        <ul>
          <li><b>מבחן תמורות:</b> 999 ערבובים של Y. כמה ערבובים אקראיים נתנו r חזק לפחות כמו המקורי (Phipson ו-Smyth, 2010).</li>
          <li><b>קורלציה חלקית:</b> נטרול משתנה שלישי, כמו המרחק מהים.</li>
          <li><b>אשכולות מקומיים (LISA דו-משתני):</b> לכל יחידה, הערך שלה ב-X מול ממוצע Y אצל שכניה, עם 199 תמורות מותנות (Anselin, 2003). כך רואים איפה הדפוס העירוני נשבר.</li>
          <li><b>מטריצה מתוקנת:</b> בבדיקת 300 זוגות, חלק ייראו מובהקים במקרה. ה-q במטריצה מתוקן לפי Benjamini ו-Hochberg (1995).</li>
        </ul>

        <h2>איך הכלי בודק את עצמו</h2>
        <p>מנוע הסטטיסטיקה נבדק בבדיקות אוטומטיות מול SciPy: Pearson, ‏Spearman עם ערכים שווים, התפלגות t, פונקציית בטא ותיקון Benjamini-Hochberg תואמים עד 9 ספרות אחרי הנקודה. מבחני התמורות וה-bootstrap רצים עם זרע קבוע, ולכן אותו קישור מחזיר אותה תוצאה. כל תאריך צילום וגרסת נתונים מוצגים בדף "מה חדש".</p>

        <h2>מה הכלי לא עושה</h2>
        <p>מתאם אינו סיבתיות. המעבדה מראה איפה לחפש ומה לבדוק, ולא מה גרם למה. נתוני Overture תלויים במיפוי פתוח ועלולים להיות חסרים בשכונות חדשות. גבולות הרובעים בשטחים לא מבונים (נמל, פארקים, משולש חקלאי) כוללים מעט מאוד אוכלוסייה.</p>

        <h2>מקורות</h2>
        <ol className="refs">
          <li>Anselin, L. (1995). Local indicators of spatial association: LISA. Geographical Analysis, 27(2).</li>
          <li>Anselin, L., Syabri, I., Smirnov, O. (2003). Visualizing multivariate spatial correlation with dynamically linked windows.</li>
          <li>Benjamini, Y., Hochberg, Y. (1995). Controlling the false discovery rate. JRSS B, 57(1).</li>
          <li>Clifford, P., Richardson, S., Hémon, D. (1989). Assessing the significance of the correlation between two spatial processes. Biometrics, 45(1).</li>
          <li>Dutilleul, P. (1993). Modifying the t test for assessing the correlation between two spatial processes. Biometrics, 49(1).</li>
          <li>Openshaw, S. (1984). The Modifiable Areal Unit Problem. CATMOG 38.</li>
          <li>Phipson, B., Smyth, G. K. (2010). Permutation p-values should never be zero. SAGMB, 9(1).</li>
          <li>Weng, Q., Lu, D., Schubring, J. (2004). Estimation of land surface temperature-vegetation abundance relationship. Remote Sensing of Environment, 89(4).</li>
          <li>Ewing, R., Cervero, R. (2010). Travel and the built environment. JAPA, 76(3).</li>
        </ol>
        <p style={{ marginTop: 30 }}><Link className="btn" to="/lab">למעבדה</Link></p>
      </div>
    </div>
  );
}
