import { Link, useLocation } from 'react-router';
import { NAV } from './Layout';
import Rich from './Rich';

// The tool has an order: each page ends with the next step and why it comes next.
const WHY: Record<string, string> = {
  '/measure': 'ראית מה יש במקום אחד. **עכשיו: מה קשור למה בכל העיר.**',
  '/know': 'מצאת קשר מעניין. **עכשיו: להבין אותו לעומק, על המפה ובגרף.**',
  '/lab': 'הבנת קשר אחד. **עכשיו: להפוך אותו לכלל תכנון ולבדוק תרחיש.**',
  '/plan': 'יש כללים ותרחישים. **עכשיו: הנחיות קצרות שאפשר לפעול לפיהן מחר.**',
  '/act': 'יש הנחיות. **עכשיו: לשמור, להוריד ולשתף אותן.**',
  '/use': 'רוצים להעמיק? **מסלולי הלמידה עוברים על כל השלבים עם שאלות על אשדוד.**',
  '/learn': 'סיימת מסלול? **חוזרים להתחלה: מודדים מקום שמעניין אותך.**',
};

export default function NextStep() {
  const { pathname } = useLocation();
  const i = NAV.findIndex(n => n.to === pathname);
  if (i < 0) return null;
  const next = NAV[(i + 1) % NAV.length];
  return (
    <aside className="card pad" style={{ marginTop: 32, display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 16, alignItems: 'center' }} data-testid="next-step">
      <div>
        <div className="eyebrow">הצעד הבא · {i + 1} מתוך {NAV.length}</div>
        <Rich as="p" className="explain">{WHY[pathname]}</Rich>
      </div>
      <Link className="btn" to={next.to}>{next.label}: {next.sub}</Link>
    </aside>
  );
}
