// "What the street network reveals": the municipal street layer (03.11.2026) read against every other layer.
// Every number here comes from the discovery scan; nothing is written by hand.
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import Rich from './Rich';
import MiniMap from './MiniMap';
import Light, { levelOfScore } from './Light';
import { column, loadMeta, UNIT_TYPES, type Meta, type UnitType } from '../lib/data';
import { VAR } from '../lib/variables';
import { URBAN_KEYS } from '../lib/config';
import { toRule, type Scales } from '../lib/engine';
import type { Discovery } from '../lib/discover';
import { chance, fr, iso } from '../lib/stats';
import { quantileColors, topicRamp } from '../lib/color';

export const STREET_KEYS = ['street_density', 'main_street_density', 'local_street_share'];
const isStreet = (k: string) => STREET_KEYS.includes(k);
const pOf = (d: Discovery) => (d.kind === 'hidden' ? d.hidden!.p : d.pBeyond);

/** Street relations that held up, without partners of the "more city" index (more street where more is built is expected). */
export function streetFindings(res: Discovery[]) {
  const all = res.filter(d => isStreet(d.x) || isStreet(d.y));
  const found = all.filter(d => d.q < 0.1 && !URBAN_KEYS.includes(d.x) && !URBAN_KEYS.includes(d.y));
  const expected = all.filter(d => d.q < 0.1 && (URBAN_KEYS.includes(d.x) || URBAN_KEYS.includes(d.y)));
  const heat = all.filter(d => d.x === 'lst' || d.y === 'lst').sort((a, b) => pOf(a) - pOf(b))[0];
  return { all, found, expected, heat };
}

export default function StreetFinding({ res, S, scale }: { res: Discovery[]; S: Scales; scale: UnitType }) {
  const units = S[scale];
  const [meta, setMeta] = useState<Meta | null>(null);
  useEffect(() => { loadMeta().then(setMeta).catch(() => setMeta(null)); }, []);
  const { all, found, expected, heat } = useMemo(() => streetFindings(res), [res]);
  const top = found.slice(0, 3);
  const rules = useMemo(() => top.map(d => toRule(d, units, scale)), [top, units, scale]);
  const lead = rules[0];
  const streetKey = top[0] ? (isStreet(top[0].x) ? top[0].x : top[0].y) : 'local_street_share';
  const ramp = topicRamp(streetKey);
  const colors = useMemo(() => quantileColors(column(units, streetKey), ramp), [units, streetKey, ramp]);
  const scaleName = UNIT_TYPES.find(u => u.key === scale)!.short;
  const heatSafe = heat && heat.q < 0.1;

  return (
    <section className="card pad street-finding" data-testid="street-finding" aria-label="מה רשת הרחובות מגלה">
      <div className="mono small muted">שכבה חדשה על שולחן האור · רחובות העירייה</div>
      <h3 className="insight-line">{lead ? lead.insight : 'רשת הרחובות לא מגלה קשר חדש'}</h3>
      <Rich as="p" className="explain">{lead
        ? `המכונה הניחה את **${VAR[streetKey].name}** על כל השכבות. ==${lead.insight}==, גם באזורים עירוניים באותה מידה.`
        : `המכונה הניחה את **שלוש שכבות הרחובות** על כל השכבות ב${scaleName}. ==אף קשר לא עמד בבדיקות==.`}</Rich>

      <div className="street-grid">
        <div>
          <h4>השאלה</h4>
          <Rich as="p">{'האם **מבנה רשת הרחובות**, כמה רחובות ואיזה סוג, הולך יחד עם חום, צמחייה ושירותים?'}</Rich>
          <h4>התשובה במילים פשוטות</h4>
          {top.length ? (
            <ol className="street-list">
              {top.map((d, i) => (
                <li key={d.x + d.y}>
                  <b>{rules[i].insight}</b>
                  <div className="street-kv">
                    <div className="kv"><span className="k">עוצמה באזורים דומים</span><span className="v">{fr(d.kind === 'hidden' ? d.hidden!.partialR : d.beyond, 2, true)}</span></div>
                    <div className="kv"><span className="k">הסיכוי שזה מקרי</span><span className="v small-v">{chance(pOf(d))}</span></div>
                    <div className="kv"><span className="k">אמינות</span><span className="v"><Light level={levelOfScore(rules[i].reliability)}>{rules[i].reliability}</Light></span></div>
                  </div>
                  <Link className="btn ghost small" to={`/lab?x=${d.x}&y=${d.y}&u=${scale}`}>{`הבנה במעבדה: ${VAR[d.x].short} ו${VAR[d.y].short}`}</Link>
                </li>
              ))}
            </ol>
          ) : (
            <Rich as="p">{`נבדקו **${all.length}** זוגות. ==אף אחד לא נשאר כשמשווים מקומות דומים==. גם זו תשובה: הרחובות כאן הולכים רק עם כמות הבינוי.`}</Rich>
          )}
        </div>
        <div>
          <div className="mini" style={{ border: '1px solid var(--line)', background: 'var(--bg-2)' }}>
            <MiniMap units={units} colors={colors} title={`מפת ${VAR[streetKey].name}`} />
          </div>
          <div className="mini-legend" aria-label="מקרא">
            <span><i style={{ background: ramp[0] }} />{VAR[streetKey].short}: מעט</span>
            <span><i style={{ background: ramp[3] }} />בינוני</span>
            <span><i style={{ background: ramp[6] }} />הרבה</span>
            <span><i style={{ background: 'var(--line)' }} />אין נתון</span>
          </div>
          <p className="hint">איך לקרוא: כל {scale === 'quarters' ? 'רובע' : 'משושה'} צבוע לפי {VAR[streetKey].name}. כהה יותר הוא יותר. שבע דרגות, בכל אחת אותו מספר יחידות.</p>
        </div>
      </div>

      <h4>מה זה אומר בפועל</h4>
      <Rich as="p">{lead
        ? `**${lead.condition}**, ${lead.effect}.`
        : 'כדי לדעת משהו חדש על רחובות צריך שכבה שמתארת אותם מעבר לאורך: רוחב, עצים, חזיתות.'}</Rich>

      <h4>מה לבדוק</h4>
      <ul className="street-checks">
        <li><Rich>{heatSafe
          ? `**חום:** נמצא קשר עם הרחובות (עוצמה ${fr(heat!.beyond, 2, true)}). כדאי לבדוק אותו במעבדה.`
          : `**חום:** אין קשר אמין בין הרחובות לחום.${heat ? ` הקשר החזק ביותר (עוצמה ${fr(heat.beyond, 2, true)}) לא עמד בבדיקה, כשבודקים את כל הזוגות יחד.` : ''}`}</Rich></li>
        <li><Rich>{`**צפוי:** ${expected.length} קשרים עם בינוי, צמתים ועסקים. איפה שבנוי יותר יש יותר רחובות, ולכן הם לא מוצגים כאן.`}</Rich></li>
        <li><Rich>{'**סוג הרחוב** נקרא לפי שמות הרחובות (הערכה). 1 שדרות, 2 רחובות ראשיים, 3 ומעלה מקומיים, 9 רצועות חניה.'}</Rich></li>
        <li><Rich>{`**קנה מידה:** הבדיקה כאן ב${scaleName}. החליפו קנה מידה למעלה ובדקו אם התשובה חוזרת.`}</Rich></li>
      </ul>
      <p className="hint">המקור: שכבת הרחובות של עיריית אשדוד, 03.11.2026{meta?.streets ? `: ${iso(meta.streets.segments.toLocaleString('he-IL'))} קטעי רחוב, ${iso(meta.streets.km.toLocaleString('he-IL'))} ק"מ בלי חניות וכבישים בין-עירוניים` : ''}.</p>
    </section>
  );
}
