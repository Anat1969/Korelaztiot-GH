import { Link } from 'react-router';
export default function NotFound() {
  return (
    <div className="page" style={{ minHeight: '60vh', display: 'grid', placeItems: 'center', textAlign: 'center' }}>
      <div><div className="eyebrow">404</div><h2 style={{ margin: '10px 0 20px' }}>הדף לא נמצא</h2><Link className="btn" to="/">לדף הבית</Link></div>
    </div>
  );
}
