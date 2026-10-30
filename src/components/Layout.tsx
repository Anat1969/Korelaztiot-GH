import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, Link, useLocation, useNavigate } from 'react-router';
import { editorKey, forgetEditorKey } from '../lib/editor';
import { toast, Toaster } from './Toast';
import { asset } from '../lib/data';

// The verbs of the tool, in working order: measure, know, understand, plan, act, use. Learning accompanies all of them.
export const NAV = [
  { to: '/measure', label: 'מדידה', sub: 'פרופיל מקום' },
  { to: '/know', label: 'ידיעה', sub: 'גילוי קשרים' },
  { to: '/lab', label: 'הבנה', sub: 'מעבדה' },
  { to: '/plan', label: 'תכנון', sub: 'כללים ותאום' },
  { to: '/act', label: 'פעולה', sub: 'כללי אצבע' },
  { to: '/use', label: 'שימוש', sub: 'ממצאים ונתונים' },
  { to: '/learn', label: 'למידה', sub: 'מלווה כל שלב' },
];

const CHAT = 'https://claude.ai/code/session_018qeN1BUNpW1ECSbW8uPwSK';

type MenuItem = { label: string; pressed?: boolean; onSelect: () => void };
type AIMenuEl = HTMLElement & { items?: MenuItem[]; status?: string };

export default function Layout() {
  const menu = useRef<AIMenuEl>(null);
  const loc = useLocation();
  const navigate = useNavigate();
  const [editor, setEditor] = useState<string | null>(null);

  useEffect(() => { if (editorKey()) import('../lib/store').then(m => m.whoAmI()).then(setEditor); }, []);
  useEffect(() => { window.scrollTo({ top: 0 }); }, [loc.pathname]);

  useEffect(() => {
    const el = menu.current;
    if (!el) return;
    const items: MenuItem[] = [];
    if (editor) {
      items.push({ label: 'מצב עריכה פעיל', pressed: true, onSelect: () => toast(`מחובר לעריכה: ${editor}`) });
      items.push({ label: 'עדכון חדש ביומן', onSelect: () => navigate('/use?tab=updates&new=1') });
      items.push({ label: 'יציאה ממצב עריכה', onSelect: () => { forgetEditorKey(); setEditor(null); toast('יצאת ממצב עריכה'); } });
    } else {
      items.push({ label: 'מצב עריכה', onSelect: () => toast('כניסה לעריכה דרך קישור העריכה האישי') });
    }
    const apply = () => { el.items = items; el.status = editor ? 'עריכה' : ''; };
    if (customElements.get('ai-menu')) apply(); else customElements.whenDefined('ai-menu').then(apply);
  }, [editor, navigate]);

  useEffect(() => {
    const onCopied = () => toast('הקישור הועתק, כולל המצב הנוכחי');
    const onUpdate = (e: Event) => {
      const reg = (e as CustomEvent<ServiceWorkerRegistration>).detail;
      toast('גרסה חדשה זמינה. לחיצה כאן תטען אותה', () => { reg.waiting?.postMessage('skip'); setTimeout(() => location.reload(), 300); }, 15000);
    };
    document.addEventListener('ai-copied', onCopied);
    window.addEventListener('kr-update-ready', onUpdate);
    return () => { document.removeEventListener('ai-copied', onCopied); window.removeEventListener('kr-update-ready', onUpdate); };
  }, []);

  return (
    <>
      <header className="topbar">
        <Link to="/" className="brand" aria-label="קורלציות, לדף הבית">
          <img src={asset('/icon.svg')} alt="" width={28} height={28} style={{ alignSelf: 'center' }} />
          <b>קורלציות</b>
          <span>Urban correlation lab · Ashdod</span>
        </Link>
        <nav className="nav" aria-label="ניווט ראשי">
          {NAV.map(n => <NavLink key={n.to} to={n.to} viewTransition>{n.label}<small>{n.sub}</small></NavLink>)}
        </nav>
        <ai-menu ref={menu} brand="ashdod" chat={CHAT}></ai-menu>
      </header>
      <main><Outlet /></main>
      <Toaster />
    </>
  );
}
