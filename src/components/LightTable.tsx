import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import type { Unit } from '../lib/data';
import { column } from '../lib/data';
import { project } from './MiniMap';
import { quantileColors } from '../lib/color';
import { VAR } from '../lib/variables';

// McHarg's light table (Design with Nature, 1969): transparent layers of the same city,
// stacked in isometric projection. They spread apart, then register on top of each other.
const COS = Math.cos(Math.PI / 6), SIN = 0.5;
const iso = (x: number, y: number, z: number) => [(x - y) * COS, (x + y) * SIN - z] as const;

export const LAYERS = [
  { k: 'lst', name: 'חום', ramp: ['#fbe9d9', '#f6c9a0', '#ef9c66', '#e06b3a', '#c8382c', '#8f2016'] },
  { k: 'green_cover', name: 'צמחייה', ramp: ['#f1f3e6', '#d5e6c0', '#a9d08f', '#76b45f', '#4a8f3d', '#2a6526'] },
  { k: 'bld_coverage', name: 'בינוי', ramp: ['#f4efe9', '#e2d3c2', '#c9ad8f', '#a8835f', '#80603f', '#553e28'] },
  { k: 'bus_access', name: 'תחבורה', ramp: ['#eef3f8', '#cfe0ee', '#a0c4e0', '#6ea2cc', '#3f7cb2', '#22578c'] },
];

export default function LightTable({ units, active, onActive }: { units: Unit[] | null; active: number | null; onActive: (i: number | null) => void }) {
  const [spread, setSpread] = useState(1);
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => setSpread(s => (s ? 0 : 1)), 3800);
    return () => clearInterval(t);
  }, []);

  const geo = useMemo(() => {
    if (!units) return null;
    const P = units.map(u => project(u.c));
    const xs = P.map(p => p[0]), ys = P.map(p => p[1]);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    const k = 300 / span;
    // rotate the city a little so the coast runs across the sheet
    const rot = (x: number, y: number) => { const a = -0.45, X = (x - cx) * k, Y = (y - cy) * k; return [X * Math.cos(a) - Y * Math.sin(a), X * Math.sin(a) + Y * Math.cos(a)] as const; };
    const shapes = units.map(u => {
      const ring = (u.g!.type === 'Polygon' ? u.g!.coordinates[0] : u.g!.coordinates[0][0]) as number[][];
      return ring.map(c => rot(...project(c)));
    });
    const colors = LAYERS.map(L => quantileColors(column(units, L.k), L.ramp));
    return { shapes, colors };
  }, [units]);

  const gap = 70;
  const sheet = (z: number) => [iso(-175, -175, z), iso(175, -175, z), iso(175, 175, z), iso(-175, 175, z)].map(p => p.join(',')).join(' ');

  return (
    <svg viewBox="-330 -360 660 600" role="img" aria-label="ארבע שכבות של אשדוד על שולחן אור: חום, צמחייה, בינוי ותחבורה" style={{ width: '100%', height: 'auto', direction: 'ltr', overflow: 'visible' }}
      onPointerLeave={() => onActive(null)}>
      <defs>
        <radialGradient id="lt-glow" cx=".5" cy=".55" r=".55"><stop offset="0" stopColor="#fffbe8" stopOpacity=".95" /><stop offset="1" stopColor="#fffbe8" stopOpacity="0" /></radialGradient>
        <filter id="lt-shadow" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="10" stdDeviation="10" floodOpacity=".18" /></filter>
      </defs>
      <ellipse cx="0" cy="40" rx="320" ry="170" fill="url(#lt-glow)" />
      {geo && LAYERS.map((L, li) => {
        const z = spread ? li * gap : li * 6;
        const dim = active != null && active !== li;
        return (
          <motion.g key={L.k} initial={false} animate={{ y: -z, opacity: dim ? 0.18 : 1 }} transition={{ type: 'spring', stiffness: 70, damping: 16, delay: li * 0.08 }}
            onPointerEnter={() => onActive(li)} style={{ cursor: 'pointer' }} filter="url(#lt-shadow)">
            <polygon points={sheet(0)} fill="var(--acetate)" stroke="rgba(21,25,28,.25)" strokeWidth={1} />
            {geo.shapes.map((ring, i) => {
              const c = geo.colors[li][i];
              if (!c) return null;
              return <polygon key={i} points={ring.map(([x, y]) => iso(x, y, 0).join(',')).join(' ')} fill={c} fillOpacity={0.88} stroke="rgba(255,255,255,.6)" strokeWidth={0.6} />;
            })}
            <text x={iso(175, -175, 0)[0] + 10} y={iso(175, -175, 0)[1] + 4} fontSize="15" fill="var(--ink)" style={{ direction: 'rtl' }}>{L.name}</text>
          </motion.g>
        );
      })}
    </svg>
  );
}

export function LightTableLegend({ active, onActive }: { active: number | null; onActive: (i: number | null) => void }) {
  return (
    <div className="pill-list" style={{ justifyContent: 'center' }}>
      {LAYERS.map((L, i) => (
        <button key={L.k} className="check" aria-pressed={active === i} onPointerEnter={() => onActive(i)} onPointerLeave={() => onActive(null)} onFocus={() => onActive(i)} onBlur={() => onActive(null)}>
          <span style={{ display: 'inline-flex', direction: 'ltr' }}>{L.ramp.slice(1, 5).map(c => <i key={c} style={{ width: 8, height: 10, background: c, display: 'inline-block' }} />)}</span>
          {VAR[L.k].name}
        </button>
      ))}
    </div>
  );
}
