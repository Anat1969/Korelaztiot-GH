// Catalogue of the indicators computed by scripts/build_data.py.
// `good` says which direction is desirable for residents (used only for wording), `family` groups the picker.

export type Family = 'env' | 'built' | 'move' | 'service' | 'edu' | 'plan' | 'geo';

export interface Variable {
  key: string;
  name: string;
  short: string;
  unit: string;
  family: Family;
  source: string;
  about: string;
  good?: 'up' | 'down';
  digits: number;
}

export const FAMILIES: Record<Family, { name: string; color: string }> = {
  env: { name: 'סביבה ואקלים', color: '#2f7d5b' },
  built: { name: 'בינוי', color: '#8a5a3c' },
  move: { name: 'תנועה והליכה', color: '#5b5f9a' },
  service: { name: 'שירותים ומסחר', color: '#a0662a' },
  edu: { name: 'חינוך', color: '#3f6f9c' },
  plan: { name: 'תכנון והתחדשות', color: '#7a4f86' },
  geo: { name: 'גיאוגרפיה', color: '#4c6a73' },
};

const S2 = 'Sentinel-2 L2A, 10 מ\'';
const LS = 'Landsat 9, ערוץ תרמי, 30 מ\'';
const OV = 'Overture Maps';
const MUNI = 'עיריית אשדוד, ASHDODMAP';

export const VARIABLES: Variable[] = [
  { key: 'lst', name: 'טמפרטורת פני שטח', short: 'חום', unit: '°C', family: 'env', source: LS, about: 'ממוצע טמפרטורת פני השטח ביום קיץ בהיר, ביבשה בלבד. מדד מקובל לאי חום עירוני.', good: 'down', digits: 1 },
  { key: 'lst_p90', name: 'מוקדי חום (אחוזון 90)', short: 'מוקדי חום', unit: '°C', family: 'env', source: LS, about: 'הטמפרטורה שרק עשירית מפני השטח ביחידה חמים ממנה. מבליט מוקדים.', good: 'down', digits: 1 },
  { key: 'ndvi', name: 'צמחייה (NDVI)', short: 'NDVI', unit: 'מדד', family: 'env', source: S2, about: 'מדד צמחייה מנורמל. ערך גבוה הוא צמחייה חיה וצפופה. מחושב על יבשה בלבד.', good: 'up', digits: 3 },
  { key: 'green_cover', name: 'כיסוי ירוק', short: 'כיסוי ירוק', unit: '%', family: 'env', source: S2, about: 'שיעור הפיקסלים ביחידה שבהם NDVI גדול מ-0.3.', good: 'up', digits: 1 },
  { key: 'ndbi', name: 'אטימות ובינוי (NDBI)', short: 'NDBI', unit: 'מדד', family: 'env', source: S2, about: 'מדד בינוי מנורמל מערוצי SWIR ו-NIR. גבוה הוא משטח בנוי או אטום.', good: 'down', digits: 3 },
  { key: 'green_access', name: 'גן ציבורי בהישג יד', short: 'גן קרוב', unit: '%', family: 'env', source: 'Overture Maps, שימושי קרקע', about: 'שיעור המבנים שיש להם גן או פארק של חצי דונם ומעלה עד 300 מ\'. היעד של ארגון הבריאות העולמי (WHO, 2016).', good: 'up', digits: 0 },
  { key: 'park_share', name: 'שטח גנים ופארקים', short: 'פארקים', unit: '%', family: 'env', source: OV, about: 'שיעור שטח היחידה שמסווג כגן, פארק, מגרש משחקים או שטח פתוח.', good: 'up', digits: 1 },
  { key: 'bld_density', name: 'צפיפות מבנים', short: 'מבנים לקמ"ר', unit: 'לקמ"ר', family: 'built', source: OV, about: 'מספר טביעות מבנים לקילומטר רבוע.', digits: 0 },
  { key: 'bld_coverage', name: 'תכסית בינוי', short: 'תכסית', unit: '%', family: 'built', source: OV, about: 'שיעור הקרקע המכוסה בטביעות מבנים.', digits: 1 },
  { key: 'bld_footprint', name: 'גודל מבנה ממוצע', short: 'טביעת מבנה', unit: 'מ"ר', family: 'built', source: OV, about: 'שטח טביעה ממוצע. מבחין בין צמודי קרקע לבינוי רב קומות ומבני תעשייה.', digits: 0 },
  { key: 'bus_access', name: 'נגישות לתחבורה ציבורית', short: 'תחנה קרובה', unit: '%', family: 'move', source: 'משרד התחבורה, מאגר תחנות (data.gov.il)', about: 'שיעור המבנים ביחידה שיש להם תחנת אוטובוס עד 400 מ\' בקו אווירי. 400 מ\' הוא סף ההליכה המקובל לתחנה (TCQSM).', good: 'up', digits: 0 },
  { key: 'bus_density', name: 'תחנות אוטובוס', short: 'תחנות', unit: 'לקמ"ר', family: 'move', source: 'משרד התחבורה, מאגר תחנות (data.gov.il)', about: 'תחנות תחבורה ציבורית לקילומטר רבוע.', good: 'up', digits: 1 },
  { key: 'road_density', name: 'צפיפות כבישים', short: 'כבישים', unit: 'ק"מ לקמ"ר', family: 'move', source: OV, about: 'אורך כבישים לקילומטר רבוע.', digits: 1 },
  { key: 'walk_density', name: 'רשת הליכה ואופניים', short: 'שבילים', unit: 'ק"מ לקמ"ר', family: 'move', source: OV, about: 'אורך מדרחובים, שבילי הולכי רגל ושבילי אופניים לקילומטר רבוע.', good: 'up', digits: 1 },
  { key: 'intersections', name: 'צמתים', short: 'צמתים', unit: 'לקמ"ר', family: 'move', source: OV, about: 'צמתים של שלוש זרועות ומעלה. מדד מקובל לקישוריות ולהליכתיות.', good: 'up', digits: 0 },
  { key: 'poi_density', name: 'עסקים ושירותים', short: 'עסקים', unit: 'לקמ"ר', family: 'service', source: OV, about: 'נקודות עניין פעילות (רמת ביטחון 0.5 ומעלה) לקילומטר רבוע.', good: 'up', digits: 0 },
  { key: 'food_density', name: 'מסעדות ובתי קפה', short: 'אוכל', unit: 'לקמ"ר', family: 'service', source: OV, about: 'עסקי מזון ומשקה לקילומטר רבוע.', good: 'up', digits: 0 },
  { key: 'retail_density', name: 'מסחר קמעונאי', short: 'מסחר', unit: 'לקמ"ר', family: 'service', source: OV, about: 'חנויות לקילומטר רבוע.', good: 'up', digits: 0 },
  { key: 'health_density', name: 'שירותי בריאות', short: 'בריאות', unit: 'לקמ"ר', family: 'service', source: OV, about: 'מרפאות, בתי מרקחת ושירותי בריאות לקילומטר רבוע.', good: 'up', digits: 0 },
  { key: 'kinder_density', name: 'גני ילדים', short: 'גנים', unit: 'לקמ"ר', family: 'edu', source: MUNI, about: 'גני ילדים עירוניים ופרטיים לקילומטר רבוע.', good: 'up', digits: 1 },
  { key: 'kinder_access', name: 'גן ילדים בהליכה', short: 'גן ילדים קרוב', unit: '%', family: 'edu', source: 'עיריית אשדוד, ASHDODMAP', about: 'שיעור המבנים שיש להם גן ילדים עד 400 מ\'.', good: 'up', digits: 0 },
  { key: 'school_density', name: 'בתי ספר', short: 'בתי ספר', unit: 'לקמ"ר', family: 'edu', source: MUNI, about: 'בתי ספר ומוסדות חינוך לקילומטר רבוע.', good: 'up', digits: 1 },
  { key: 'early_density', name: 'מעונות ומשפחתונים', short: 'גיל רך', unit: 'לקמ"ר', family: 'edu', source: MUNI, about: 'מסגרות לגיל הרך לקילומטר רבוע.', good: 'up', digits: 1 },
  { key: 'renewal_projects', name: 'פרויקטי התחדשות', short: 'התחדשות', unit: 'פרויקטים', family: 'plan', source: MUNI + ', מה נבנה סביבי', about: 'פרויקטי התחדשות ובינוי שמרכזם ביחידה.', digits: 0 },
  { key: 'renewal_units', name: 'תוספת יח"ד מתוכננת', short: 'תוספת יח"ד', unit: 'יח"ד', family: 'plan', source: MUNI + ', מה נבנה סביבי', about: 'יחידות דיור מתוכננות פחות קיימות, בפרויקטים שמרכזם ביחידה.', digits: 0 },
  { key: 'plan_density', name: 'צפיפות יעד בתוכנית המתאר', short: 'יעד צפיפות', unit: 'נפש לקמ"ר', family: 'plan', source: MUNI + ', מתחמי תוכנית המתאר', about: 'אוכלוסיית היעד של המתחם חלקי שטחו. ערך ברמת מתחם, משותף לכל הרובעים שבו.', digits: 0 },
  { key: 'shimur_count', name: 'מבני שימור', short: 'שימור', unit: 'מבנים', family: 'plan', source: MUNI + ', רשימת השימור', about: 'מבנים ואתרים ברשימת השימור העירונית.', digits: 0 },
  { key: 'dist_water', name: 'מרחק מהים ומהמים', short: 'מרחק מהים', unit: 'ק"מ', family: 'geo', source: S2 + ', NDWI', about: 'מרחק מנקודת מרכז היחידה לפיקסל המים הקרוב (ים, מרינה, נחל לכיש).', digits: 2 },
  { key: 'area', name: 'שטח היחידה', short: 'שטח', unit: 'קמ"ר', family: 'geo', source: 'חישוב', about: 'שטח יחידת הניתוח בתוך גבול השיפוט.', digits: 2 },
];

export const VAR = Object.fromEntries(VARIABLES.map(v => [v.key, v])) as Record<string, Variable>;

/** Variables that make sense in the matrix (area is a technical variable). */
export const MATRIX_KEYS = VARIABLES.filter(v => v.key !== 'area').map(v => v.key);

export function fmt(v: number | null | undefined, key: string): string {
  if (v == null || !isFinite(v)) return 'אין נתון';
  const d = VAR[key]?.digits ?? 2;
  return `\u2066${v.toLocaleString('he-IL', { minimumFractionDigits: d, maximumFractionDigits: d })}\u2069`;
}
