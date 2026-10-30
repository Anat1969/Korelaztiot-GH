// Rules of thumb: a discovery rewritten as a short instruction that moves a planner to act.
// Shared by the page (live) and by scripts/snapshot_thumbs.ts (monthly history).
import type { Unit, UnitType } from './data';
import type { Rule } from './engine';
import { VAR, fmt } from './variables';
import { NON_RESIDENTIAL, TRIVIAL } from './config';

export interface Thumb {
  id: string; x: string; y: string; kind: Rule['kind'];
  directive: string;   // imperative, one line
  why: string;         // the story behind it, rich text
  where: string[];     // places where it matters most
  reliability: number;
  scale: UnitType;
}

export interface ThumbEntry extends Thumb {
  first_seen: string; last_seen: string; status: 'active' | 'faded';
  history: { date: string; reliability: number }[];
}

const FIXED = ['dist_water', 'area'];
const heb = (w: string) => (/^[A-Za-z0-9]/.test(w) ? '-' + w : w);

export function toThumb(r: Rule, units: Unit[]): Thumb {
  const X = VAR[r.x], Y = VAR[r.y];
  const d = r.d;
  const s = Math.sign(d.kind === 'hidden' ? d.hidden!.partialR : d.beyond || d.r);
  // only places where people live
  const lived = (u: Unit) => !NON_RESIDENTIAL.includes(u.id) && !NON_RESIDENTIAL.includes(u.q ?? '') && u.name !== 'שולי העיר';
  const where = [...new Set(r.applies.map(i => units[i]).filter(u => u && lived(u)).map(u => u.name))].slice(0, 4);
  const many = `במקומות עם הרבה ${Y.short}`, few = `במקומות עם מעט ${Y.short}`;
  let directive: string;
  if (d.kind === 'threshold' && d.bp) {
    directive = `אל תעברו ${fmt(d.bp.k, r.x)} ${X.unit} של ${X.short} בלי לבדוק את ה${Y.short}`;
  } else if (d.kind === 'hidden') {
    directive = `בדקו ${X.short} ו${heb(Y.short)} יחד, גם כשנראה שאין קשר`;
  } else if (FIXED.includes(r.x) && Y.good) {
    const side = r.x === 'dist_water' ? (s > 0 ? 'במקומות הרחוקים מהים' : 'במקומות הקרובים לים') : (s > 0 ? 'ביחידות הגדולות' : 'ביחידות הקטנות');
    directive = `${side}, ${Y.good === 'down' ? 'טפלו קודם ב' : 'הוסיפו קודם '}${Y.short}`;
  } else if (X.family === 'plan') {
    // a plan is not a lever: the rule is to check the other layer before the plan is carried out
    directive = `לפני שמממשים ${X.short}, בדקו מה יקרה ל${Y.short} במקום: ${s > 0 ? 'הם נמצאים יחד היום' : 'האחד בא על חשבון השני'}`;
  } else if (Y.good) {
    const raise = (s > 0) === (Y.good === 'up');
    directive = `${raise ? 'הוסיפו' : 'צמצמו'} ${X.short} ${Y.good === 'up' ? few : many}`;
  } else {
    directive = `כשמתכננים ${X.short}, תכננו יחד גם ${Y.short}: ${s > 0 ? 'הם עולים יחד' : 'הם הולכים הפוך'}`;
  }
  const scales = d.scales.filter(c => Math.sign(c.r) === Math.sign(d.r) && Math.abs(c.r) >= 0.2).length;
  const why = `${r.condition}, ${r.effect}. ${scales >= 2 ? `נמצא ב-**${scales}** גדלים של יחידה.` : 'נמצא בגודל יחידה אחד בלבד.'}`;
  return { id: r.id, x: r.x, y: r.y, kind: d.kind, directive, why, where, reliability: r.reliability, scale: r.scale };
}

/** One rule per lever and subject: heat and heat hot-spots with the same lever are the same advice. */
export function dedupe(list: Thumb[]): Thumb[] {
  const group = (k: string) => TRIVIAL.findIndex(g => g.includes(k));
  const seen = new Map<string, Thumb>();
  for (const t of [...list].sort((a, b) => b.reliability - a.reliability)) {
    const key = `${t.x}|${group(t.y) >= 0 ? 'g' + group(t.y) : t.y}`;
    if (!seen.has(key)) seen.set(key, t);
  }
  return [...seen.values()];
}

/** Merge today's thumbs into the stored history: new ones get today's date, missing ones fade. */
export function mergeHistory(prev: ThumbEntry[], now: Thumb[], date: string): ThumbEntry[] {
  const byId = new Map(prev.map(e => [e.id, e]));
  const out: ThumbEntry[] = [];
  for (const t of now) {
    const old = byId.get(t.id);
    byId.delete(t.id);
    const history = [...(old?.history ?? []).filter(h => h.date !== date), { date, reliability: t.reliability }].slice(-24);
    out.push({ ...t, first_seen: old?.first_seen ?? date, last_seen: date, status: 'active', history });
  }
  for (const old of byId.values()) out.push({ ...old, status: 'faded' });
  return out.sort((a, b) => (a.status === b.status ? b.reliability - a.reliability : a.status === 'active' ? -1 : 1));
}
