// Shared entry points: load the three scales once, run the discovery scan once, derive rules.
import { column, loadUnits, UNIT_TYPES, type Unit, type UnitType } from './data';
import { MATRIX_KEYS, VAR, fmt } from './variables';
import { CONFOUNDERS, DRIVER_ORDER, FAMILY_OF, KNOWN, TRIVIAL, URBAN_KEYS } from './config';
import { runScan } from './worker-client';
import { multiRegression, type Discovery } from './discover';
import { fr } from './stats';

export type Scales = Record<UnitType, Unit[]>;

let scalesP: Promise<Scales> | null = null;
export function loadScales(): Promise<Scales> {
  if (!scalesP) scalesP = Promise.all(UNIT_TYPES.map(t => loadUnits(t.key))).then(([q, a, b]) => ({ quarters: q, 'h3-8': a, 'h3-9': b }));
  return scalesP;
}

const scanCache = new Map<string, Promise<Discovery[]>>();
/** Discoveries with `primary` as the ranking scale and the other two as the consistency check. */
export function discoveries(primary: UnitType = 'h3-8'): Promise<Discovery[]> {
  if (!scanCache.has(primary)) {
    scanCache.set(primary, loadScales().then(S => {
      const order = [primary, ...UNIT_TYPES.map(t => t.key).filter(k => k !== primary)];
      return runScan({
        keys: MATRIX_KEYS, families: FAMILY_OF, known: KNOWN, trivial: TRIVIAL, confounders: CONFOUNDERS, urbanKeys: URBAN_KEYS, driverOrder: DRIVER_ORDER,
        scales: order.map(k => ({ key: k, cols: MATRIX_KEYS.map(v => column(S[k], v)), coords: S[k].map(u => u.c) })),
      });
    }));
  }
  return scanCache.get(primary)!;
}

/** Urban-intensity index per unit (mean z-score of the URBAN_KEYS), leaving out the keys in `skip`. */
export function urbanity(units: Unit[], skip: string[] = []): (number | null)[] {
  const keys = URBAN_KEYS.filter(k => !skip.includes(k));
  const z = keys.map(k => {
    const col = column(units, k), v = col.filter((x): x is number => x != null);
    const m = v.reduce((a, b) => a + b, 0) / v.length, s = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, v.length - 1)) || 1;
    return col.map(x => (x == null ? null : (x - m) / s));
  });
  return units.map((_, i) => {
    const v = z.map(c => c[i]).filter((x): x is number => x != null);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  });
}

// ---------- rules ----------
export interface Rule {
  id: string; x: string; y: string; kind: Discovery['kind'];
  insight: string;      // up to 8 words
  explain: string;      // up to 20 words, rich text
  condition: string;    // "if"
  effect: string;       // "then"
  planning: string;     // what a planner does with it
  reliability: number;  // 0-100
  applies: number[];    // unit indices on the scale the rule was built on
  scale: UnitType;
  control?: string;
  d: Discovery;
}

const STEP: Record<string, number> = {
  lst: 1, lst_p90: 1, ndvi: 0.1, ndbi: 0.1, green_cover: 10, park_share: 10, green_access: 10, bld_density: 100, bld_coverage: 10, bld_footprint: 100,
  road_density: 5, walk_density: 5, intersections: 50, bus_access: 10, bus_density: 5, poi_density: 100, food_density: 20, retail_density: 20, health_density: 10,
  kinder_density: 10, kinder_access: 10, school_density: 5, early_density: 5, renewal_projects: 1, renewal_units: 100, plan_density: 1000, shimur_count: 1, dist_water: 1,
};
const FIXED_GEO = ['dist_water', 'area'];
const heb = (w: string) => (/^[A-Za-z0-9]/.test(w) ? '-' + w : w);

export function toRule(d: Discovery, units: Unit[], scale: UnitType): Rule {
  const X = VAR[d.x], Y = VAR[d.y];
  const xs = column(units, d.x), ys = column(units, d.y);
  const ctrlKey = d.kind === 'hidden' ? d.hidden!.by : 'urbanity';
  const ctrl = ctrlKey === 'urbanity' ? urbanity(units, [d.x, d.y]) : column(units, ctrlKey);
  const rows = units.map((_, i) => [xs[i], ys[i], ctrl[i]] as const).filter(r => r.every(v => v != null && isFinite(v as number))) as unknown as [number, number, number][];
  const fit = rows.length > 8 ? multiRegression([rows.map(r => r[0]), rows.map(r => r[2])], rows.map(r => r[1]), [d.x, ctrlKey]) : null;
  const step = STEP[d.x] ?? 1;
  const slope = fit ? fit.beta[0] : 0;
  const delta = slope * step;
  const ctrlName = ctrlKey === 'urbanity' ? 'בינוי, כבישים ועסקים' : VAR[ctrlKey].name;
  const up = delta > 0;
  let insight = '', condition = '', effect = '';
  if (d.kind === 'threshold' && d.bp) {
    insight = `${X.short} מעל ${fmt(d.bp.k, d.x)}: ${Y.short} מתהפך`;
    condition = `כש${heb(X.name)} עובר **${fmt(d.bp.k, d.x)} ${X.unit}**`;
    effect = `השיפוע של **${Y.name}** משתנה מ-**${fr(d.bp.below * step, 2)}** ל-**${fr(d.bp.above * step, 2)}** ${Y.unit} לכל ${fmt(step, d.x)} ${X.unit}`;
  } else {
    insight = d.kind === 'hidden' ? `${X.short} ו${heb(Y.short)}: קשר מוסתר` : `יותר ${X.short}, ${up ? 'יותר' : 'פחות'} ${Y.short}`;
    condition = `בכל **${fmt(step, d.x)} ${X.unit}** נוספים של **${X.name}**, באזורים דומים ב${ctrlName}`;
    effect = `**${Y.name}** ${up ? 'עולה' : 'יורד'} בכ-**${fmt(Math.abs(delta), d.y)} ${Y.unit}**`;
  }
  const explain = d.kind === 'hidden'
    ? `במבט ראשון אין קשר (עוצמה **${fr(d.r)}**). כשמשווים רק מקומות דומים ב**${ctrlName}**, הוא מופיע: ==עוצמה ${fr(d.hidden!.partialR)}==.`
    : d.kind === 'threshold'
      ? `עד **${fmt(d.bp!.k, d.x)} ${X.unit}** הדברים הולכים בכיוון אחד, ומעל זה בכיוון ההפוך. ==זו נקודת המפנה==.`
      : d.kind === 'nonlinear'
        ? `הקשר חזק יותר ממה שחישוב רגיל מראה (**${fr(d.dcor)}** מול **${fr(d.r)}**). ==הוא עקום, לא קו ישר==.`
        : `הם הולכים יחד (עוצמה **${fr(d.r)}**). גם כשמשווים רק אזורים דומים בבינוי, בכבישים ובעסקים, ==הקשר נשאר: ${fr(d.beyond)}==.`;
  // where the rule matters: units on the "bad" side of Y, or the top quarter of X when Y has no direction
  const yv = ys.map((v, i) => [v, i] as const).filter(([v]) => v != null) as [number, number][];
  const sorted = [...yv].sort((a, b) => a[0] - b[0]);
  const qn = Math.max(1, Math.floor(sorted.length / 4));
  const applies = (Y.good === 'down' ? sorted.slice(-qn) : Y.good === 'up' ? sorted.slice(0, qn) : sorted.slice(-qn)).map(([, i]) => i);
  const evidence = d.q < 0.01 ? 1 : d.q < 0.05 ? 0.82 : d.q < 0.1 ? 0.55 : 0.3;
  const reliability = Math.round(100 * evidence * (d.consistent ? 1 : 0.65) * Math.sqrt(Math.min(1, d.nEff / 30)));
  const lever = Y.good ? (Y.good === 'down') === up ? `להפחית ${X.name}` : `להגדיל ${X.name}` : `לבחון את ${X.name}`;
  // geography cannot be changed: the rule then says where to compensate, not what to move
  const fixed = FIXED_GEO.includes(d.x);
  const planning = fixed
    ? `${X.name} אינו מנוף. ==לפצות ביחידות שבהן ${Y.name} ${Y.good === 'up' ? 'נמוך' : 'גבוה'}==: צל, צמחייה ושטחים פתוחים קודם שם.`
    : d.kind === 'threshold'
    ? `להגדיר **${fmt(d.bp!.k, d.x)} ${X.unit}** כ==סף תכנוני==, ולבדוק כל תוכנית שחוצה אותו.`
    : `==${lever}== ביחידות שבהן **${Y.name} ${Y.good === 'up' ? 'נמוך' : 'גבוה'}**, ולמדוד אחרי שנה.`;
  return { id: `${d.x}|${d.y}`, x: d.x, y: d.y, kind: d.kind, insight, explain, condition, effect, planning, reliability, applies, scale, control: ctrlKey === 'urbanity' ? undefined : ctrlKey, d };
}
