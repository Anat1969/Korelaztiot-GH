import { StrictMode, lazy, Suspense, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
import './styles.css';
import Layout from './components/Layout';
import Landing from './pages/Landing';
import NotFound from './pages/NotFound';
import ErrorPage from './pages/ErrorPage';

const Lab = lazy(() => import('./pages/Lab'));
const Matrix = lazy(() => import('./pages/Matrix'));
const Atlas = lazy(() => import('./pages/Atlas'));
const Findings = lazy(() => import('./pages/Findings'));
const Method = lazy(() => import('./pages/Method'));
const Updates = lazy(() => import('./pages/Updates'));
const page = (el: ReactNode) => <Suspense fallback={<div className="page muted">טוען</div>}>{el}</Suspense>;
import { captureEditorKey } from './lib/editor';

captureEditorKey();

const router = createBrowserRouter([
  {
    element: <Layout />,
    errorElement: <ErrorPage />,
    children: [{ errorElement: <ErrorPage />, children: [
      { path: '/', element: <Landing /> },
      { path: '/lab', element: page(<Lab />) },
      { path: '/matrix', element: page(<Matrix />) },
      { path: '/atlas', element: page(<Atlas />) },
      { path: '/findings', element: page(<Findings />) },
      { path: '/method', element: page(<Method />) },
      { path: '/updates', element: page(<Updates />) },
      { path: '*', element: <NotFound /> },
    ] }],
  },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
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
