import { memo } from 'react';

/** Small static scatter for cards: points, trend line, optional breakpoint. SVG is LTR inside RTL pages. */
function MiniScatter({ xs, ys, color = 'var(--ink)', k, title }: { xs: number[]; ys: number[]; color?: string; k?: number; title?: string }) {
  const W = 160, H = 110, P = 8;
  if (xs.length < 3) return null;
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const sx = (v: number) => P + ((v - x0) / (x1 - x0 || 1)) * (W - 2 * P);
  const sy = (v: number) => H - P - ((v - y0) / (y1 - y0 || 1)) * (H - 2 * P);
  const n = xs.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; }
  const b = sxx ? sxy / sxx : 0, a = my - b * mx;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', direction: 'ltr', background: 'linear-gradient(160deg, var(--bg-2), var(--paper))', border: '1px solid var(--line)' }} role="img" aria-label={title}>
      {k != null && <line x1={sx(k)} x2={sx(k)} y1={P} y2={H - P} stroke="#a0662a" strokeDasharray="3 3" />}
      {xs.map((x, i) => <circle key={i} cx={sx(x)} cy={sy(ys[i])} r={n > 200 ? 1.3 : 2.4} fill={color} fillOpacity={0.55} />)}
      <line x1={sx(x0)} y1={sy(a + b * x0)} x2={sx(x1)} y2={sy(a + b * x1)} stroke="var(--ink)" strokeWidth={1.4} />
    </svg>
  );
}
export default memo(MiniScatter);
