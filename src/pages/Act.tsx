import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import VerbHead from '../components/VerbHead';
import Rich from '../components/Rich';
import Light, { levelOfScore } from '../components/Light';
import NextStep from '../components/NextStep';
import { asset } from '../lib/data';
import { KIND_NAME } from '../lib/config';
import { topicOf } from '../lib/color';
import { discoveries, loadScales, toRule } from '../lib/engine';
import { dedupe, toThumb, type ThumbEntry } from '../lib/thumbs';
import type { Finding } from '../lib/store';

// Rules of thumb: every finding that held up becomes a short instruction.
// The list grows month by month: scripts/snapshot_thumbs.ts keeps the date each rule first appeared.
export default function Act() {
  const [items, setItems] = useState<ThumbEntry[] | null>(null);
  const [updated, setUpdated] = useState('');
  const [adopted, setAdopted] = useState<Finding[]>([]);

  useEffect(() => {
    fetch(asset('/data/thumbs.json')).then(r => (r.ok ? r.json() : Promise.reject())).then(d => { setItems(d.items); setUpdated(d.updated); })
      .catch(async () => {
        // no stored history yet: derive today's rules in the browser
        const [S, d] = await Promise.all([loadScales(), discoveries('h3-8')]);
        const today = new Date().toISOString().slice(0, 10);
        const now = dedupe(d.filter(x => x.q < 0.1 && x.crossFamily).map(x => toThumb(toRule(x, S['h3-8'], 'h3-8'), S['h3-8'])).filter(t => t.reliability >= 45));
        setItems(now.map(t => ({ ...t, first_seen: today, last_seen: today, status: 'active', history: [{ date: today, reliability: t.reliability }] })));
        setUpdated(today);
      });
    import('../lib/store').then(m => m.listFindings()).then(r => setAdopted(r.items.filter(f => f.title.startsWith('כלל')))).catch(() => {});
  }, []);

  const fresh = useMemo(() => (items ?? []).filter(i => i.status === 'active' && i.first_seen === updated), [items, updated]);
  const active = useMemo(() => (items ?? []).filter(i => i.status === 'active' && i.first_seen !== updated), [items, updated]);
  const faded = useMemo(() => (items ?? []).filter(i => i.status === 'faded'), [items]);
  const date = (d: string) => new Date(d).toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="page">
      <VerbHead verb="פעולה" line={`כללי אצבע שנולדו מהנתונים של אשדוד. כל כלל הוא ==הנחיה שאפשר לפעול לפיה מחר==. הרשימה מתעדכנת אוטומטית בכל חודש, וכל כלל נשמר עם תאריך הגילוי שלו.`} />
      {!items && <div className="card pad muted">אוסף את הכללים</div>}
      {items && (
        <>
          <Section title={fresh.length ? `חדשים: ${fresh.length} כללים שהתגלו ב-${date(updated)}` : 'אין כללים חדשים החודש'} hint="כללים שהופיעו לראשונה בעדכון הנתונים האחרון." list={fresh} date={date} />
          {active.length > 0 && <Section title={`פעילים: ${active.length} כללים שחוזרים בנתונים`} hint="כללים שהתגלו קודם ועדיין מופיעים בכל עדכון. ככל שכלל חוזר יותר חודשים, אפשר לסמוך עליו יותר." list={active} date={date} />}
          {faded.length > 0 && <Section title={`לא חזרו: ${faded.length} כללים`} hint="כללים שהופיעו בעבר ולא חזרו בנתונים האחרונים. כדאי לבדוק מה השתנה בעיר." list={faded} date={date} />}
          <section style={{ marginTop: 28 }}>
            <h3 className="insight-line" style={{ fontSize: 24 }}>אומצו על ידי הצוות: {adopted.length}</h3>
            <Rich as="p" className="explain">{adopted.length ? 'כללים שמישהו מהצוות אימץ בדף התכנון.' : 'עוד לא אומץ כלל. בדף התכנון לוחצים "אימוץ הכלל", והוא יופיע כאן.'}</Rich>
            {adopted.length > 0 && (
              <div className="cards" style={{ ['--rows' as string]: 3, ['--min' as string]: '320px', marginTop: 12 }}>
                {adopted.map(f => (
                  <div key={f.id} className="card pad fade">
                    <h4 style={{ margin: 0, fontSize: 18 }}>{f.title.replace(/^כלל:\s*/, '')}</h4>
                    <Rich as="p" className="small">{f.summary ?? ''}</Rich>
                    <span className="hint">{new Date(f.created_at).toLocaleDateString('he-IL')}{f.local ? ' · בדפדפן הזה' : ''}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
      <NextStep />
    </div>
  );
}

function Section({ title, hint, list, date }: { title: string; hint: string; list: ThumbEntry[]; date: (d: string) => string }) {
  return (
    <section style={{ marginTop: 24 }}>
      <h3 className="insight-line" style={{ fontSize: 24 }}>{title}</h3>
      <Rich as="p" className="explain">{hint}</Rich>
      {list.length > 0 && (
        <div className="cards" style={{ ['--rows' as string]: 6, ['--min' as string]: '360px', marginTop: 12 }} data-testid="thumbs">
          {list.map((t, i) => <ThumbCard key={t.id} t={t} n={i + 1} date={date} />)}
        </div>
      )}
    </section>
  );
}

function ThumbCard({ t, n, date }: { t: ThumbEntry; n: number; date: (d: string) => string }) {
  const tx = topicOf(t.x), ty = topicOf(t.y);
  const months = t.history.length;
  return (
    <article className="card pad fade" style={{ borderInlineStart: `5px solid ${ty.hue}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span className="mono muted" style={{ fontSize: 22 }}>{String(n).padStart(2, '0')}</span>
        <span className="small"><span className="dot" style={{ background: tx.hue }} /> {tx.name} <span className="muted">ו</span><span className="dot" style={{ background: ty.hue }} /> {ty.name}</span>
      </div>
      <h4 className="insight-line" style={{ fontSize: 23 }} data-testid="directive">{t.directive}</h4>
      <Rich as="p" className="explain">{t.why}</Rich>
      <Rich as="p" className="small">{t.where.length ? `**איפה להתחיל:** ${t.where.join(', ')}.` : '**איפה להתחיל:** בכל העיר באותה מידה.'}</Rich>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <Light level={levelOfScore(t.reliability)}>אמינות {t.reliability}</Light>
        <span className="hint">{KIND_NAME[t.kind]} · התגלה ב-{date(t.first_seen)}{months > 1 ? ` · חזר ${months} חודשים` : ''}</span>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignSelf: 'end' }}>
        <Link className="btn small" to={`/lab?x=${t.x}&y=${t.y}&u=${t.scale}`}>למה? לראות במעבדה</Link>
        <Link className="btn ghost small" to={`/plan?tab=twin&y=${t.y}&d=${t.x}`}>לנסות בתאום</Link>
      </div>
    </article>
  );
}
