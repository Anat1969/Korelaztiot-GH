import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { motion } from 'motion/react';
import { listFindings, removeFinding, editorKey, type Finding } from '../lib/store';
import { VAR } from '../lib/variables';
import { UNIT_TYPES } from '../lib/data';
import { fmtP, fr } from '../lib/stats';
import { toast } from '../components/Toast';
import Rich from '../components/Rich';
import Light, { levelOfScore } from '../components/Light';

export default function Findings({ embedded = false }: { embedded?: boolean }) {
  const [items, setItems] = useState<Finding[] | null>(null);
  const [remote, setRemote] = useState(true);
  const load = () => listFindings().then(d => { setItems(d.items); setRemote(d.remote); });
  useEffect(() => { load(); }, []);
  const canEdit = !!editorKey();

  return (
    <div className={embedded ? '' : 'page'}>
      <div className="eyebrow">ספריית ממצאים</div>
      <h2 style={{ margin: '8px 0 12px' }}>מה כבר למדנו על העיר</h2>
      <p className="lead">כל ממצא נשמר עם המספרים שמאחוריו ועם מדד האמינות שלו ביום השמירה. לחיצה פותחת אותו מחדש במעבדה, על הנתונים העדכניים.</p>
      {!remote && <p className="small" style={{ color: 'var(--warn)' }}>הספרייה המשותפת לא זמינה כרגע. מוצגים רק ממצאים שנשמרו בדפדפן הזה.</p>}
      <div className="grid" style={{ marginTop: 24, gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))' }} data-testid="findings">
        {items === null && <div className="muted">טוען</div>}
        {items?.length === 0 && (
          <div className="card pad">
            <h3>עוד אין ממצאים שמורים</h3>
            <p className="muted">פותחים את המעבדה, מוצאים קשר שעומד בבדיקות, ולוחצים "שמירת הממצא".</p>
            <Link className="btn small" to="/lab">למעבדה</Link>
          </div>
        )}
        {items?.map((f, i) => {
          const rel = Number(f.stats.reliability ?? 0), r = Number(f.stats.r ?? 0);
          return (
            <motion.div key={f.id} className="card pad" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <span className="tag">{UNIT_TYPES.find(u => u.key === f.unit_type)?.short ?? f.unit_type}{f.local ? ' · בדפדפן בלבד' : ''}</span>
                <span className="mono small muted">{new Date(f.created_at).toLocaleDateString('he-IL')}</span>
              </div>
              <h3 style={{ margin: '12px 0 8px' }}>{f.title}</h3>
              <div style={{ display: 'flex', gap: 16, alignItems: 'baseline' }}>
                <span className="mono" style={{ fontSize: 30, color: r >= 0 ? 'var(--pos)' : 'var(--neg)' }}>{fr(r, 2, true)}</span>
                <Light level={levelOfScore(rel)}>אמינות {rel}</Light>
                {f.stats.pSpatial != null && <span className="small muted">p מרחבי {fmtP(Number(f.stats.pSpatial))}</span>}
              </div>
              <p className="small muted">{VAR[f.x_key]?.name} מול {VAR[f.y_key]?.name}{f.control_key ? `, בשליטה על ${VAR[f.control_key]?.name}` : ''}</p>
              {f.summary && <Rich as="p" className="explain" >{f.summary}</Rich>}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Link className="btn small" to={`/lab?x=${f.x_key}&y=${f.y_key}&u=${f.unit_type}${f.control_key ? `&c=${f.control_key}` : ''}`}>פתיחה במעבדה</Link>
                {(f.local || canEdit) && <button className="btn quiet" title="מוחק את הממצא מהספרייה" onClick={async () => { if (await removeFinding(f)) { toast('הממצא הוסר'); load(); } else toast('ההסרה נכשלה'); }}>הסרה</button>}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
