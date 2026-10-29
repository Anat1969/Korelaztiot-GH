import { lazy, Suspense, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import VerbHead from '../components/VerbHead';
import Rich from '../components/Rich';

const Method = lazy(() => import('./Method'));
const TABS = [{ k: 'tours', label: 'מסלולי למידה' }, { k: 'method', label: 'שיטה ומקורות' }];

interface Step { title: string; text: string; to: string; cta: string }
interface Tour { id: string; title: string; question: string; steps: Step[] }

// Each tour is a question about Ashdod, walked through the six verbs. Texts follow the distillation standard.
const TOURS: Tour[] = [
  { id: 'sea', title: 'הים מקרר יותר מהעצים', question: 'למה רובעים ירוקים באשדוד לא תמיד קרירים יותר?', steps: [
    { title: 'מדידה', text: 'מפת **החום** של העיר: המזרח חם, החוף קריר.', to: '/measure?tab=atlas&u=h3-9', cta: 'לאטלס' },
    { title: 'הבנה', text: '**מרחק מהים** מסביר את החום יותר מכל שכבה אחרת: ==מתאם גבוה ועקבי בשלושה קני מידה==.', to: '/lab?x=dist_water&y=lst&u=h3-8', cta: 'למעבדה' },
    { title: 'ידיעה', text: 'כשמנטרלים את הים, **הצמחייה מקררת**. הקשר היה מוסתר.', to: '/lab?x=ndvi&y=lst&u=quarters&c=dist_water', cta: 'לבדיקה בשליטה' },
    { title: 'תכנון', text: 'כמה מעלות חוסכת תוספת **כיסוי ירוק** ברובעים החמים?', to: '/plan?tab=twin&y=lst&d=green_cover,bld_coverage,dist_water', cta: 'לתאום' },
  ] },
  { id: 'city', title: 'למה רוב הקשרים מטעים', question: 'מה ההבדל בין "הולך יחד" לבין "קשור באמת"?', steps: [
    { title: 'ידיעה', text: 'במטריצה כמעט הכול קשור להכול: **עוד עיר**.', to: '/know?tab=matrix', cta: 'למטריצה' },
    { title: 'ידיעה', text: 'המכונה מנטרלת **עוצמה עירונית**. נשאר ==מה שלא היינו מחפשים==.', to: '/know?tab=auto', cta: 'לתגליות' },
    { title: 'למידה', text: 'שש הבדיקות מאחורי **מדד האמינות**, ולמה שכנים הם לא תצפיות נפרדות.', to: '/learn?tab=method', cta: 'לשיטה' },
  ] },
  { id: 'kids', title: 'איפה חסרים גני ילדים', question: 'האם הגנים הולכים עם הצפיפות המתוכננת?', steps: [
    { title: 'מדידה', text: 'פרופיל של **רובע שמעון פרס**: כמה מבנים רחוקים מגן ילדים.', to: '/measure?p=34.6622,31.774&n=רובע שמעון פרס&r=500&layer=kinder_access', cta: 'לפרופיל' },
    { title: 'הבנה', text: '**נגישות לגן** מול **יעד הצפיפות** בתוכנית המתאר.', to: '/lab?x=plan_density&y=kinder_access&u=quarters', cta: 'למעבדה' },
    { title: 'תכנון', text: 'כלל מועמד: איפה להקצות **מבני ציבור** לפני שהצפיפות מגיעה.', to: '/plan?tab=rules', cta: 'לכללים' },
  ] },
  { id: 'street', title: 'צמתים ובתי קפה', question: 'מה עושה רחוב לרחוב חי?', steps: [
    { title: 'הבנה', text: '**צפיפות צמתים** מול **מסעדות ובתי קפה** בקנה מידה של בלוק.', to: '/lab?x=intersections&y=food_density&u=h3-9', cta: 'למעבדה' },
    { title: 'ידיעה', text: 'בוחרים שכבות: **הליכה, צמתים, תחבורה ואוכל**, ורואים מה מסביר מה.', to: '/know?tab=pick&L=food_density,intersections,walk_density,bus_access,bld_coverage&t=food_density&u=h3-9', cta: 'לחקירה' },
    { title: 'שימוש', text: 'שומרים את הממצא לספרייה ומורידים את הנתונים.', to: '/use?tab=data', cta: 'לנתונים' },
  ] },
];

export default function Learn() {
  const [sp] = useSearchParams();
  const tab = TABS.find(t => t.k === sp.get('tab'))?.k ?? 'tours';
  return (
    <div className="page">
      <VerbHead verb="למידה" base="/learn" tab={tab} tabs={TABS}
        line="כל מסלול הוא **שאלה על אשדוד**, שעוברת דרך הכלים. בסוף כל מסלול כותבים ==מה למדתי==, והרישום נשמר." />
      {tab === 'tours' ? <Tours /> : <Suspense fallback={<div className="muted">טוען</div>}><Method embedded /></Suspense>}
    </div>
  );
}

function Tours() {
  return (
    <div className="cards" style={{ ['--rows' as string]: 8, ['--min' as string]: '460px' }} data-testid="tours">
      {TOURS.map((t, i) => <TourCard key={t.id} t={t} i={i} />)}
    </div>
  );
}

function TourCard({ t, i }: { t: Tour; i: number }) {
  const key = `kr.tour.${t.id}`;
  const read = (): { step: number; note: string } => { try { return JSON.parse(localStorage.getItem(key) || '') } catch { return { step: 0, note: '' }; } };
  const [st, setSt] = useState(read);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(st)); setSaved(true); } catch { /* private mode */ }
    const h = setTimeout(() => setSaved(false), 1200);
    return () => clearTimeout(h);
  }, [st]);
  const s = t.steps[Math.min(st.step, t.steps.length - 1)];
  return (
    <article className="card pad fade" style={{ animationDelay: `${i * 0.06}s` }}>
      <div className="eyebrow">מסלול {i + 1}</div>
      <h3 className="insight-line">{t.title}</h3>
      <p className="muted">{t.question}</p>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${t.steps.length}, minmax(0,1fr))`, gap: 4 }} aria-label="התקדמות">
        {t.steps.map((x, k) => (
          <button key={k} className="check" aria-pressed={k === st.step} onClick={() => setSt({ ...st, step: k })} style={{ justifyContent: 'center', opacity: k <= st.step ? 1 : 0.6 }}>{x.title}</button>
        ))}
      </div>
      <div className="tone tone-neutral"><Rich as="p">{s.text}</Rich></div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'start' }}>
        <Link className="btn small" to={s.to}>{s.cta}</Link>
        {st.step < t.steps.length - 1 && <button className="btn ghost small" onClick={() => setSt({ ...st, step: st.step + 1 })}>לשלב הבא</button>}
      </div>
      <label className="lbl" htmlFor={`note-${t.id}`} style={{ alignSelf: 'end' }}>מה למדתי {saved && <span style={{ color: 'var(--solution)' }}>· נשמר</span>}</label>
      <textarea id={`note-${t.id}`} className="field" rows={2} value={st.note} onChange={e => setSt({ ...st, note: e.target.value })} placeholder="משפט אחד: מה הפתיע אותי, ומה אבדוק בשטח." />
    </article>
  );
}
