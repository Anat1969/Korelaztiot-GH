import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { motion } from 'motion/react';
import { listUpdates, saveUpdate, editorKey, type Update } from '../lib/store';
import { loadMeta, type Meta } from '../lib/data';
import { toast } from '../components/Toast';
import Rich from '../components/Rich';

// The release notes that ship with the code. Entries added from the editor menu are stored in Supabase (kr_updates).
const BUILT_IN: Update[] = [
  { id: 'v3.1', version: '3.1', kind: 'feature', published_at: '2026-10-29T21:00:00Z', title: 'קריאה במבט: תובנה, הסבר, מספר',
    body: '==כל ממצא נקרא בשלוש שניות==: **שורת תובנה**, משפט הסבר ומספרים בולטים. **רמזור** לאמינות ולמובהקות, **מקרא** לכל מפה, **טבלאות ממוינות**, תמונות של מבני שימור, וקישורים לאפליקציות העירוניות הקשורות.' },
  { id: 'v3.0', version: '3.0', kind: 'feature', published_at: '2026-10-29T20:00:00Z', title: 'כלי אחד לשש פעולות: מדידה, ידיעה, הבנה, תכנון, למידה, שימוש',
    body: 'Urban Pulse נבלעה כ"מדידה": פרופיל לכל נקודה בעיר מול העיר ומול תקני הליכה. מנוע גילוי סורק כל זוג שכבות, מנטרל עוצמה עירונית, ומוצא קשרים נסתרים, ספים וקשרים לא ליניאריים. כל תגלית הופכת לכלל תכנון מועמד, ותאום עירוני מחשב תרחישי מה אם. נוספו תחנות האוטובוס של משרד התחבורה ומדדי נגישות לגן, לגן ילדים ולתחבורה.' },
  { id: 'v3.0-design', version: '3.0', kind: 'fix', published_at: '2026-10-29T20:00:00Z', title: 'שפת העיצוב הקנונית',
    body: 'כפתורים מרובעים ולחיצים, טקסט עשיר עם מרקר תובנה, צבעי בעיה ופתרון, ותעודת DNA: שולחן האור של מקהרג.' },
  { id: 'v2.0', version: '2.0', kind: 'feature', published_at: '2026-10-29', title: 'קורלציות 2.0: מעבדה עירונית לאשדוד',
    body: 'מעבר מכלי GIS כללי למעבדה עירונית של אשדוד. 25 מדדים לשלוש יחידות ניתוח קבועות במקום רשת שתלויה במסך. תיקון לאוטוקורלציה מרחבית, מבחן תמורות, bootstrap, קורלציה חלקית, אשכולות מקומיים, מטריצה עם תיקון לבדיקות מרובות, ומדד אמינות לכל ממצא. מפה תלת-ממדית, אטלס, ספריית ממצאים, התקנה כאפליקציה.' },
  { id: 'v2.0-data', version: '2.0', kind: 'data', published_at: '2026-10-29', title: 'נתוני לוויין אמיתיים במקום מדד AQI',
    body: 'ברמה 1 הוצג ערך AQI של WAQI כאילו הוא PM2.5 ביחידות μg/m³. הוא הוסר. במקומו: טמפרטורת פני שטח מ-Landsat 9, ‏NDVI, ‏NDBI ו-NDWI מ-Sentinel-2, ונתוני Overture Maps מהגרסה החודשית האחרונה.' },
  { id: 'v2.0-fix', version: '2.0', kind: 'fix', published_at: '2026-10-29', title: 'Spearman עם ערכים שווים, וחישוב על יבשה בלבד',
    body: 'הדירוג ברמה 1 נתן לערכים שווים דירוגים שונים. עכשיו הם מקבלים דירוג ממוצע, כמו ב-SciPy. פיקסלי ים הוצאו מחישובי החום והצמחייה.' },
  { id: 'v1', version: '1.0', kind: 'feature', published_at: '2026-04-06', title: 'פלטפורמת מחקר גיאוגרפית (Lovable)',
    body: 'הגרסה הראשונה: שכבות NASA GIBS ו-WorldPop, נתוני OSM ו-WAQI חיים, וקורלציה על רשת 8 על 8 של המסך.' },
];
const KIND: Record<Update['kind'], string> = { feature: 'יכולת', data: 'נתונים', fix: 'תיקון' };

export default function Updates({ embedded = false }: { embedded?: boolean }) {
  const [sp, setSp] = useSearchParams();
  const [remote, setRemote] = useState<Update[] | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [draft, setDraft] = useState({ version: '', title: '', body: '', kind: 'feature' as Update['kind'] });
  const editing = sp.get('new') === '1' && !!editorKey();

  const load = () => listUpdates().then(setRemote);
  useEffect(() => { load(); loadMeta().then(setMeta).catch(() => {}); }, []);
  const all = [...(remote ?? []), ...BUILT_IN].sort((a, b) => b.published_at.localeCompare(a.published_at));

  return (
    <div className={embedded ? '' : 'page'}>
      <div className="eyebrow">מה חדש</div>
      <h2 style={{ margin: '8px 0 12px' }}>עדכונים, נתונים וגרסאות</h2>
      <p className="lead">הנתונים מתעדכנים אוטומטית בתחילת כל חודש: הגרסה החדשה של Overture, והצילומים הבהירים האחרונים של Sentinel-2 ו-Landsat. כשיש גרסה חדשה של האפליקציה, תופיע הודעה ולחיצה אחת תטען אותה.</p>

      <div className="sources" style={{ marginBottom: 30 }}>
        <div className="card flat source"><div className="mono small muted">הנתונים נבנו</div><div className="big">{meta ? new Date(meta.generated).toLocaleDateString('he-IL') : '...'}</div></div>
        <div className="card flat source"><div className="mono small muted">Landsat 9</div><div className="big">{meta?.landsat.date ?? '...'}</div><div className="small muted mono">{meta?.landsat.id}</div></div>
        <div className="card flat source"><div className="mono small muted">Sentinel-2</div><div className="big">{meta?.sentinel2.date ?? '...'}</div><div className="small muted mono">{meta?.sentinel2.id}</div></div>
        <div className="card flat source"><div className="mono small muted">Overture Maps</div><div className="big">{meta?.overture ?? '...'}</div></div>
      </div>

      {editing && (
        <form className="card pad grid" style={{ maxWidth: 720, marginBottom: 24 }} onSubmit={async e => {
          e.preventDefault();
          if (await saveUpdate({ ...draft, published_at: new Date().toISOString() })) { toast('העדכון פורסם'); const n = new URLSearchParams(sp); n.delete('new'); setSp(n, { replace: true }); load(); } else toast('הפרסום נכשל');
        }}>
          <div className="eyebrow">עדכון חדש</div>
          <div style={{ display: 'grid', gridTemplateColumns: '120px minmax(0,1fr)', gap: 10 }}>
            <div><label className="lbl" htmlFor="uv">גרסה</label><input id="uv" className="field" value={draft.version} onChange={e => setDraft({ ...draft, version: e.target.value })} required /></div>
            <div><label className="lbl" htmlFor="ut">כותרת</label><input id="ut" className="field" value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} required /></div>
          </div>
          <div><label className="lbl" htmlFor="ub">פירוט</label><textarea id="ub" className="field" rows={4} value={draft.body} onChange={e => setDraft({ ...draft, body: e.target.value })} /></div>
          <div className="seg" role="group" aria-label="סוג">{(Object.keys(KIND) as Update['kind'][]).map(k => <button type="button" key={k} aria-pressed={draft.kind === k} onClick={() => setDraft({ ...draft, kind: k })}>{KIND[k]}</button>)}</div>
          <div><button className="btn" type="submit">פרסום</button></div>
        </form>
      )}

      <div style={{ position: 'relative', maxWidth: 820 }} data-testid="updates">
        <div aria-hidden style={{ position: 'absolute', insetInlineStart: 7, top: 6, bottom: 6, width: 2, background: 'linear-gradient(var(--a-blue), var(--a-green), var(--a-yellow), var(--a-red))', borderRadius: 2 }} />
        {all.map((u, i) => (
          <motion.div key={u.id} initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.04 }}
            style={{ position: 'relative', paddingInlineStart: 34, marginBottom: 18 }}>
            <span style={{ position: 'absolute', insetInlineStart: 0, top: 22, width: 16, height: 16, borderRadius: '50%', background: 'var(--paper)', border: '3px solid var(--ink)' }} />
            <div className="card pad">
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="tag">{KIND[u.kind]}</span><span className="mono small muted">גרסה {u.version} · {new Date(u.published_at).toLocaleDateString('he-IL')}</span>
              </div>
              <h3 style={{ margin: '10px 0 6px' }}>{u.title}</h3>
              {u.body && <Rich as="p" className="explain">{u.body}</Rich>}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
