// Turns a PairResult into Hebrew text: finding, meaning in units, caveats, next step.
// Domain notes are short, sourced statements about well-known urban relations.
import type { PairResult } from './stats';
import { fmtP, fr, strengthHe } from './stats';
import { VAR, fmt } from './variables';

export interface Narrative { headline: string; explain: string; finding: string; meaning: string; caveats: string[]; action: string; domain?: string }

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
  // insight line: up to 8 words, says the point
  const headline = Math.abs(res.r) < 0.1
    ? `אין קשר בין ${X.short} ל${heb(Y.short)}`
    : `ככל ש${heb(X.short)} גבוה יותר, ${Y.short} ${res.r > 0 ? 'גבוה' : 'נמוך'} יותר`;
  // one explanation sentence, up to 20 words, 2-3 bold terms, the verdict in the marker
  const verdict = sigS ? '==מובהק גם אחרי תיקון מרחבי==' : sigN ? '==נעלם אחרי תיקון מרחבי==' : '==לא מובהק==';
  const explain = `קשר **${dir} ${str}** על **${res.n}** יחידות, מתאם **${fr(res.r)}**: ${verdict}.`;

  const finding = `**Spearman ${fr(res.rho)}** מאשר את הכיוון. ` +
    (sigS ? `**p מרחבי ${fmtP(res.pSpatial)}** אחרי תיקון לשכנים דומים.`
      : sigN ? `בלי תיקון **p ${fmtP(res.p)}**, אחרי תיקון **${fmtP(res.pSpatial)}**: ==שכנים דומים מנפחים את המובהקות==.`
        : `**p מרחבי ${fmtP(res.pSpatial)}**.`);

  const step = typicalStep(xKey);
  const meaning = `כל **${fmt(step, xKey)} ${X.unit}** של ${X.name} מלווים ב${res.reg.slope * step >= 0 ? 'עלייה' : 'ירידה'} של **${fmt(Math.abs(res.reg.slope * step), yKey)} ${Y.unit}** ב${Y.name}. ` +
    `${X.short} מסביר **${Math.round(res.reg.r2 * 100)}%** מהשונות.`;

  const caveats: string[] = [];
  if (res.moranX > 0.3 && res.moranY > 0.3) caveats.push(`**מקובצים במרחב** (Moran's I ${fr(res.moranX)} ו-${fr(res.moranY)}): מדגם אפקטיבי **${res.nEff.toFixed(0)}** ולא ${res.n}.`);
  if (Math.abs(res.r - res.rho) > 0.15) caveats.push(`**Pearson ו-Spearman רחוקים**: קשר עקום, או יחידות חריגות שמושכות אותו.`);
  if (res.jack.shift > 0.1) caveats.push(`**יחידה אחת** מזיזה את r ב-${fr(res.jack.shift)}. לבדוק אותה במפה.`);
  if (controlKey && res.partialR != null) {
    const C = VAR[controlKey];
    const flip = Math.sign(res.partialR) !== Math.sign(res.r) && Math.abs(res.partialR) > 0.1;
    const drop = Math.abs(res.partialR) < Math.abs(res.r) * 0.5;
    caveats.push(`בשליטה על **${C.name}**: מתאם חלקי **${fr(res.partialR)}**, מובהקות **${fmtP(res.partialP)}**. ` +
      (flip ? `==הכיוון מתהפך: ${C.short} הסתיר את הקשר==.` : drop ? `==רוב הקשר הוא ${C.short}==.` : `==הקשר נשמר==.`));
  }
  caveats.push('**מתאם אינו סיבתיות**: הממצא אומר איפה לבדוק, לא מה גרם.');

  const action = sigS && Math.abs(res.r) >= 0.3
    ? `לבדוק בשטח את היחידות **"גבוה ליד נמוך"** ו**"נמוך ליד גבוה"** במפת האשכולות: ==שם ההזדמנויות==.`
    : `להריץ ב**קנה מידה אחר** או עם **משתנה בקרה**. ==קשר לא יציב אינו בסיס להחלטה==.`;

  return { headline, explain, finding, meaning, caveats, action, domain: domainNote(xKey, yKey) };
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

