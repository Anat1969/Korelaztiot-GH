import { Link, useRouteError } from 'react-router';

export default function ErrorPage() {
  const err = useRouteError() as Error | undefined;
  return (
    <div className="page" style={{ minHeight: '60vh', display: 'grid', placeItems: 'center', textAlign: 'center' }}>
      <div>
        <div className="eyebrow">שגיאה</div>
        <h2 style={{ margin: '10px 0 12px' }}>משהו השתבש בדף הזה</h2>
        <p className="muted small mono" style={{ direction: 'ltr' }}>{err?.message}</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button className="btn" onClick={() => location.reload()}>טעינה מחדש</button>
          <Link className="btn ghost" to="/">לדף הבית</Link>
        </div>
      </div>
    </div>
  );
}
