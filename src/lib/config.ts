// Settings of the discovery engine. One place, so every page searches the same way.
import { MATRIX_KEYS, VAR } from './variables';

/** Variables that measure the same thing twice: a relation between them is not a finding. */
export const TRIVIAL = [
  ['lst', 'lst_p90'], ['ndvi', 'green_cover'], ['poi_density', 'food_density', 'retail_density', 'health_density'],
  ['renewal_projects', 'renewal_units'], ['bld_density', 'bld_coverage'], ['bus_access', 'bus_density'],
  ['green_access', 'park_share'], ['kinder_access', 'kinder_density', 'early_density'],
  ['green_access', 'kinder_access', 'bus_access'], // all three measure how compact a neighbourhood is
];

/** The "more city" index removed from every pair: built mass, streets, activity and where people live.
 *  Two components of the index are never a finding together: they measure the same thing. */
export const URBAN_KEYS = ['bld_density', 'bld_coverage', 'road_density', 'intersections', 'poi_density', 'ndbi', 'bus_density', 'kinder_density', 'school_density'];

/** Third variables tested for hidden relations, besides urban intensity. */
export const CONFOUNDERS = ['dist_water'];

/** Pairs with a known relation in the literature (see narrative.ts): confirmations, not discoveries. */
export const KNOWN = ['lst|ndvi', 'green_cover|lst', 'lst|ndbi', 'dist_water|lst', 'bld_coverage|lst', 'intersections|poi_density', 'food_density|walk_density', 'kinder_density|plan_density', 'park_share|walk_density', 'ndvi|park_share'];

export const FAMILY_OF = Object.fromEntries(MATRIX_KEYS.map(k => [k, VAR[k].family]));

export const KIND_NAME = { hidden: 'קשר נסתר', threshold: 'נקודת מפנה', nonlinear: 'קשר עקום', linear: 'נשאר באזורים דומים' } as const;
export const KIND_ABOUT = {
  hidden: 'במבט ראשון אין קשר. כשמשווים רק אזורים דומים, הוא מופיע.',
  threshold: 'עד ערך מסוים הדברים הולכים בכיוון אחד, ומעליו בכיוון ההפוך. הערך הזה הוא נקודת המפנה לתכנון.',
  nonlinear: 'הקשר קיים, אבל הוא לא קו ישר. לכן חישוב רגיל מחמיץ אותו.',
  linear: 'גם כשמשווים אזורים עירוניים באותה מידה, הקשר נשאר. הוא לא רק "עוד עיר".',
} as const;

/** Reading order of a pair: geography and plans drive, built form and movement mediate, environment and services follow. */
export const DRIVER_ORDER = ['geo', 'plan', 'built', 'move', 'env', 'edu', 'service'];

/** Quarters where almost nobody lives: port, industry, agriculture, cemetery, parks. Rules of thumb do not point there. */
export const NON_RESIDENTIAL = ['rova-40', 'rova-24', 'rova-33', 'rova-47', 'rova-64'];
