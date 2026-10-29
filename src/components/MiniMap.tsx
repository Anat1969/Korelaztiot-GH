import { memo, useMemo } from 'react';
import type { Unit } from '../lib/data';

// Lightweight SVG map for small multiples and the landing page (no WebGL per tile).
const LON0 = 34.655, LAT0 = 31.8, K = Math.cos((LAT0 * Math.PI) / 180);
export const project = ([lon, lat]: number[]): [number, number] => [(lon - LON0) * K * 1000, -(lat - LAT0) * 1000];

function ringPath(ring: number[][]) {
  return ring.map((c, i) => { const [x, y] = project(c); return `${i ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`; }).join('') + 'Z';
}
export function geomPath(g: Unit['g']): string {
  if (!g) return '';
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  return (polys as number[][][][]).map(p => p.map(r => ringPath(r)).join('')).join('');
}

export const VIEW = (() => {
  const [x0, y0] = project([34.6, 31.875]), [x1, y1] = project([34.72, 31.735]);
  return `${x0} ${y0} ${x1 - x0} ${y1 - y0}`;
})();

function MiniMap({ units, colors, stroke = 'rgba(0,0,0,.08)', title }: { units: Unit[]; colors: (string | null)[]; stroke?: string; title?: string }) {
  const paths = useMemo(() => units.map(u => geomPath(u.g)), [units]);
  return (
    <svg viewBox={VIEW} role="img" aria-label={title} preserveAspectRatio="xMidYMid meet">
      {paths.map((d, i) => <path key={i} d={d} fill={colors[i] ?? 'var(--line)'} stroke={stroke} strokeWidth={0.4} />)}
    </svg>
  );
}
export default memo(MiniMap);
