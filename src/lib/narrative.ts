// Turns a PairResult into Hebrew text: finding, meaning in units, caveats, next step.
// Domain notes are short, sourced statements about well-known urban relations.
import type { PairResult } from './stats';
import { fmtP, fr, strengthHe } from './stats';
import { VAR, fmt } from './variables';

export interface Narrative { headline: string; finding: string; meaning: string; caveats: string[]; action: string; domain?: string }

const DOMAIN: Record<string, string> = {
  'lst|ndvi': 'בספרות, עלייה של 0.1 ב-NDVI מלווה בדרך כלל בירידה של 1 עד 2 מעלות בטמפרטורת פני השטח (Weng et al., 2004). באשדוד הבריזה הימית חזקה מהצמחייה, ולכן כדאי לבחון את הקשר בשליטה על המרחק מהים.',
  'green_cover|lst': 'כיסוי ירוק רציף מקרר יותר מאשר נקודות ירוקות מפוזרות (Zhou et al., 2011). המדד כאן הוא שיעור פיקסלים ירוקים, ולכן הוא רגיש לרציפות.',
  'lst|ndbi': 'משטחים אטומים אוגרים חום ביום ופולטים אותו בלילה. NDBI הוא מנבא חזק של טמפרטורת פני שטח בערים ים-תיכוניות (Guha et al., 2018).',
  'dist_water|lst': 'הבריזה הימית בחוף הישראלי מורידה את טמפרטורת פני השטח ברצועה של כמה קילומטרים מהחוף. זה משתנה מתערב מרכזי בכל ניתוח חום באשדוד.',
  'bld_coverage|lst': 'תכסית גבוהה מחממת, אבל בינוי גבוה גם מטיל צל. לכן הקשר בין תכסית לחום משתנה עם קנה המידה.',
  'intersections|poi_density': 'צפיפות צמתים היא אחד המנבאים החזקים לפעילות מסחרית ולהליכה (Ewing & Cervero, 2010).',
  'food_density|walk_density': 'רחובות עם רשת הליכה צפופה מושכים מסחר קטן ובתי קפה. זה הבסיס לרחוב מסחרי חי.',
  'kinder_density|plan_density': 'הקצאת מבני ציבור לגיל הרך צריכה לעקוב אחרי צפיפות האוכלוסייה. פער בין השניים מסמן מחסור עתידי.',
  'park_share|walk_density': 'גנים מחוברים ברשת הליכה מגדילים את השימוש בהם. גן מבודד משרת פחות.',
  'ndvi|park_share': 'לא כל פארק ירוק בקיץ: מדשאות מושקות לעומת חול ושטח פתוח יבש. פער בין השניים מצביע על פארקים חשופים.',
};

function domainNote(a: string, b: string) {
  return DOMAIN[[a, b].sort().join('|')];
}

/** Hebrew prefix letters take a hyphen before a Latin or numeric word (ש-NDVI). */
const heb = (w: string) => (/^[A-Za-z0-9]/.test(w) ? '-' + w : w);

export function narrate(xKey: string, yKey: string, res: PairResult, controlKey?: string): Narrative {
  const X = VAR[xKey], Y = VAR[yKey];
  const dir = res.r > 0 ? 'חיובי' : 'שלילי';
  const sigS = res.pSpatial < 0.05, sigN = res.p < 0.05;
  const str = strengthHe(res.r);
  const headline = Math.abs(res.r) < 0.1
    ? `אין קשר בין ${X.short} ל${heb(Y.short)}`
    : `ככל ש${heb(X.short)} גבוה יותר, ${Y.short} ${res.r > 0 ? 'גבוה' : 'נמוך'} יותר`;

  const finding = `קשר ${dir} ${str} (r = ${fr(res.r)}, Spearman ‏${fr(res.rho)}) על פני ${res.n} יחידות. ` +
    (sigS ? `הוא מובהק גם אחרי תיקון לאוטוקורלציה מרחבית (p = ${fmtP(res.pSpatial)}).`
      : sigN ? `בלי תיקון הוא נראה מובהק (p = ${fmtP(res.p)}), אבל אחרי תיקון לאוטוקורלציה מרחבית הוא כבר לא (p = ${fmtP(res.pSpatial)}). יחידות שכנות דומות זו לזו, ולכן יש פחות מידע בלתי תלוי ממה שנראה.`
        : `הוא אינו מובהק (p = ${fmtP(res.pSpatial)} אחרי תיקון מרחבי).`);

  const step = typicalStep(xKey);
  const meaning = `בממוצע, כל ${fmt(step, xKey)} ${X.unit} נוספים של ${X.name} מלווים ב-${res.reg.slope * step >= 0 ? 'עלייה' : 'ירידה'} של ${fmt(Math.abs(res.reg.slope * step), yKey)} ${Y.unit} ב${Y.name}. ` +
    `${X.name} מסביר כ-${Math.round(res.reg.r2 * 100)}% מהשונות ב${Y.name}.`;

  const caveats: string[] = [];
  if (res.moranX > 0.3 && res.moranY > 0.3) caveats.push(`שני המשתנים מקובצים במרחב (Moran's I ‏${fr(res.moranX)} ו-${fr(res.moranY)}). לכן המדגם האפקטיבי הוא כ-${res.nEff.toFixed(0)} יחידות ולא ${res.n}.`);
  if (Math.abs(res.r - res.rho) > 0.15) caveats.push(`Pearson ו-Spearman רחוקים זה מזה. כנראה שהקשר אינו ליניארי, או שכמה יחידות חריגות מושכות אותו.`);
  if (res.jack.shift > 0.1) caveats.push(`יחידה אחת משנה את r ב-${fr(res.jack.shift)}. מומלץ לבדוק אותה במפה לפני מסקנה.`);
  if (controlKey && res.partialR != null) {
    const C = VAR[controlKey];
    const flip = Math.sign(res.partialR) !== Math.sign(res.r) && Math.abs(res.partialR) > 0.1;
    const drop = Math.abs(res.partialR) < Math.abs(res.r) * 0.5;
    caveats.push(`בשליטה על ${C.name}: r חלקי = ${fr(res.partialR)} (p = ${fmtP(res.partialP)}). ` +
      (flip ? `הכיוון מתהפך. ${C.name} מסתיר את הקשר האמיתי.` : drop ? `רוב הקשר מוסבר על ידי ${C.name}.` : `הקשר נשמר גם כשמנטרלים את ${C.name}.`));
  }
  caveats.push('מתאם אינו סיבתיות. הממצא מצביע היכן לבדוק, ולא מה גרם למה.');

  const action = sigS && Math.abs(res.r) >= 0.3
    ? `לבדוק בשטח את היחידות שבמפת האשכולות מסומנות "גבוה-נמוך" ו"נמוך-גבוה". הן החריגות מהדפוס העירוני, ושם נמצאות ההזדמנויות או הבעיות.`
    : `להריץ שוב בקנה מידה אחר או עם משתנה בקרה. קשר שאינו יציב אינו בסיס להחלטה תכנונית.`;

  return { headline, finding, meaning, caveats, action, domain: domainNote(xKey, yKey) };
}

/** A readable step for "every N units of X", chosen per variable. */
function typicalStep(xKey: string): number {
  return stepScale[xKey] ?? 1;
}

const stepScale: Record<string, number> = {
  lst: 1, lst_p90: 1, ndvi: 0.1, ndbi: 0.1, green_cover: 10, park_share: 10, bld_density: 100, bld_coverage: 10, bld_footprint: 100,
  road_density: 5, walk_density: 5, intersections: 50, poi_density: 100, food_density: 20, retail_density: 20, health_density: 10,
  kinder_density: 10, school_density: 5, early_density: 5, renewal_projects: 1, renewal_units: 100, plan_density: 1000, shimur_count: 1,
  dist_water: 1, area: 1,
};

