// Turns a PairResult into Hebrew text: finding, meaning in units, caveats, next step.
// Domain notes are short, sourced statements about well-known urban relations.
import type { PairResult } from './stats';
import { chance, fr, strengthHe } from './stats';
import { VAR, fmt } from './variables';

export interface Narrative { headline: string; question: string; explain: string; finding: string; meaning: string; caveats: string[]; action: string; domain?: string }

const DOMAIN: Record<string, string> = {
  'lst|ndvi': 'בספרות, עלייה של 0.1 ב-NDVI מלווה בדרך כלל בירידה של 1 עד 2 מעלות בטמפרטורת פני השטח (Weng et al., 2004). באשדוד הבריזה הימית חזקה מהצמחייה, ולכן כדאי להשוות רק בין מקומות שרחוקים מהים באותה מידה.',
  'green_cover|lst': 'כיסוי ירוק רציף מקרר יותר מאשר נקודות ירוקות מפוזרות (Zhou et al., 2011). המדד כאן הוא שיעור פיקסלים ירוקים, ולכן הוא רגיש לרציפות.',
  'lst|ndbi': 'משטחים אטומים אוגרים חום ביום ופולטים אותו בלילה. NDBI הוא מנבא חזק של טמפרטורת פני שטח בערים ים-תיכוניות (Guha et al., 2018).',
  'dist_water|lst': 'הבריזה הימית בחוף הישראלי מקררת את פני השטח ברצועה של כמה קילומטרים מהחוף. לכן בכל שאלה על חום באשדוד כדאי לבדוק גם את המרחק מהים.',
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

/** Plain words for the strength of a relation, from 0 to 1. */
const strengthWord = (r: number) => { const a = Math.abs(r); return a >= 0.7 ? 'חזק מאוד' : a >= 0.5 ? 'חזק' : a >= 0.3 ? 'בינוני' : a >= 0.1 ? 'חלש' : 'כמעט אפסי'; };

export function narrate(xKey: string, yKey: string, res: PairResult, controlKey?: string): Narrative {
  const X = VAR[xKey], Y = VAR[yKey];
  const together = res.r > 0;
  const real = res.pSpatial < 0.05, looksReal = res.p < 0.05;
  void strengthHe;
  // the story: a question, an answer in words, what it means on the ground, what to check, what to do
  const question = `האם במקומות עם יותר **${X.name}** יש גם ${Y.name} ${Y.good === 'down' ? 'גבוה' : 'רב'} יותר?`;
  const headline = Math.abs(res.r) < 0.1
    ? `${X.short} ו${heb(Y.short)} לא הולכים יחד`
    : `ככל ש${heb(X.short)} גבוה יותר, ${Y.short} ${together ? 'גבוה' : 'נמוך'} יותר`;
  const answer = Math.abs(res.r) < 0.1 ? 'לא. אין ביניהם קשר שאפשר לראות.'
    : together ? `כן. כש${heb(X.short)} עולה, גם ${Y.short} עולה.` : `להפך. כש${heb(X.short)} עולה, ${Y.short} יורד.`;
  const verdict = real ? '==זה לא מקרי==, גם אחרי שבודקים ששכנים דומים זה לזה.'
    : looksReal ? '==זה עלול להיות מקרי==: שכנים דומים זה לזה ומנפחים את התוצאה.'
      : '==זה יכול להיות מקרי==.';
  const explain = `${answer} הקשר **${strengthWord(res.r)}** (עוצמה **${fr(Math.abs(res.r))}** מתוך 1), על פני **${res.n}** ${res.n > 100 ? 'משושים' : 'יחידות'}. ${verdict}`;

  const finding = `בדקנו את כל **${res.n}** היחידות בעיר. ` +
    (real ? `גם כשמחשבים ששכנים דומים זה לזה, הסיכוי שזה מקרי הוא **${chance(res.pSpatial)}**.`
      : looksReal ? `במבט ראשון הקשר נראה בטוח. כשמביאים בחשבון ששכנים דומים זה לזה, הסיכוי שזה מקרי עולה ל-**${chance(res.pSpatial)}**.`
        : `הסיכוי שזה מקרי הוא **${chance(res.pSpatial)}**, גבוה מדי למסקנה.`);

  const step = typicalStep(xKey);
  const delta = res.reg.slope * step;
  const meaning = `בפועל: כל **${fmt(step, xKey)} ${X.unit}** נוספים של ${X.name} מלווים ב${delta >= 0 ? 'עלייה' : 'ירידה'} של **${fmt(Math.abs(delta), yKey)} ${Y.unit}** ב${Y.name}. ` +
    `${X.short} לבדו מסביר כ-**${Math.round(res.reg.r2 * 100)}%** מההבדלים ב${Y.short} בין המקומות.`;

  const caveats: string[] = [];
  if (res.moranX > 0.3 && res.moranY > 0.3) caveats.push(`**שכנים דומים זה לזה.** לכן יש כאן בפועל כ-**${res.nEff.toFixed(0)}** מקומות שונים באמת, ולא ${res.n}.`);
  if (Math.abs(res.r - res.rho) > 0.15) caveats.push(`**הקשר לא ישר.** שתי שיטות חישוב לא מסכימות, כנראה בגלל כמה מקומות חריגים.`);
  if (res.jack.shift > 0.1) caveats.push(`**מקום אחד משנה את התמונה.** כדאי למצוא אותו במפה ולבדוק אותו.`);
  if (controlKey && res.partialR != null) {
    const C = VAR[controlKey];
    const flip = Math.sign(res.partialR) !== Math.sign(res.r) && Math.abs(res.partialR) > 0.1;
    const drop = Math.abs(res.partialR) < Math.abs(res.r) * 0.5;
    caveats.push(`כשמשווים רק מקומות עם **${C.name}** דומה, העוצמה היא **${fr(res.partialR)}**. ` +
      (flip ? `==הכיוון מתהפך==: ${C.short} הסתיר את הקשר האמיתי.` : drop ? `==רוב הקשר הוא בעצם ${C.short}==.` : `==הקשר נשאר==.`));
  }
  caveats.push('**הולכים יחד זה לא גורם ותוצאה.** הממצא אומר איפה לחפש, לא מה גרם למה.');

  const action = real && Math.abs(res.r) >= 0.3
    ? `לפתוח את **"מוקדים חריגים"** במפה. המקומות שבורחים מהדפוס הם ==המקום הראשון לבדוק בשטח==.`
    : `לנסות **גודל יחידה אחר**, או להשוות רק מקומות דומים. ==קשר לא יציב הוא לא בסיס להחלטה==.`;

  return { headline, question, explain, finding, meaning, caveats, action, domain: domainNote(xKey, yKey) };
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

