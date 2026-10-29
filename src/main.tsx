import { StrictMode, lazy, Suspense, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, createHashRouter, RouterProvider, Navigate, useLocation } from 'react-router';
import './styles.css';
import Layout from './components/Layout';
import Landing from './pages/Landing';
import NotFound from './pages/NotFound';
import ErrorPage from './pages/ErrorPage';

const Lab = lazy(() => import('./pages/Lab'));
const Measure = lazy(() => import('./pages/Measure'));
const Know = lazy(() => import('./pages/Know'));
const Plan = lazy(() => import('./pages/Plan'));
const Learn = lazy(() => import('./pages/Learn'));
const Use = lazy(() => import('./pages/Use'));

/** Old addresses (version 2.0) keep working: they open the same tool inside its verb. */
function Moved({ to }: { to: string }) {
  const loc = useLocation();
  const [path, tab] = to.split('?');
  const q = new URLSearchParams(loc.search);
  if (tab) new URLSearchParams(tab).forEach((v, k) => q.set(k, v));
  return <Navigate to={`${path}?${q}`} replace />;
}
const page = (el: ReactNode) => <Suspense fallback={<div className="page muted">טוען</div>}>{el}</Suspense>;
import { captureEditorKey } from './lib/editor';

captureEditorKey();

// Vercel serves real paths; the app/ build on raw.githack has no rewrites, so it uses hash routing.
const isRoot = import.meta.env.BASE_URL === '/';
const router = (isRoot ? createBrowserRouter : createHashRouter)([
  {
    element: <Layout />,
    errorElement: <ErrorPage />,
    children: [{ errorElement: <ErrorPage />, children: [
      { path: '/', element: <Landing /> },
      { path: '/measure', element: page(<Measure />) },
      { path: '/know', element: page(<Know />) },
      { path: '/lab', element: page(<Lab />) },
      { path: '/plan', element: page(<Plan />) },
      { path: '/learn', element: page(<Learn />) },
      { path: '/use', element: page(<Use />) },
      { path: '/matrix', element: <Moved to="/know?tab=matrix" /> },
      { path: '/atlas', element: <Moved to="/measure?tab=atlas" /> },
      { path: '/findings', element: <Moved to="/use?tab=findings" /> },
      { path: '/method', element: <Moved to="/learn?tab=method" /> },
      { path: '/updates', element: <Moved to="/use?tab=updates" /> },
      { path: '*', element: <NotFound /> },
    ] }],
  },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD && isRoot) {
  navigator.serviceWorker.register('/sw.js').then(reg => {
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) {
          window.dispatchEvent(new CustomEvent('kr-update-ready', { detail: reg }));
        }
      });
    });
  }).catch(() => {});
}
