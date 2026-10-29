import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { column, type Unit } from '../lib/data';
import { project } from './MiniMap';
import { quantileColors } from '../lib/color';
import { pairsOf, pearson, fr } from '../lib/stats';

// The city turns into a scatter plot: the same hexagons, placed by distance from the sea and heat.
export default function MorphStage({ units }: { units: Unit[] | null }) {
  const [asChart, setAsChart] = useState(false);
  useEffect(() => {
    if (!units) return;
    const t = setInterval(() => setAsChart(v => !v), 4200);
    const first = setTimeout(() => setAsChart(true), 1800);
    return () => { clearInterval(t); clearTimeout(first); };
  }, [units]);

  const g = useMemo(() => {
    if (!units) return null;
    const ok = units.filter(u => u.v.lst != null && u.v.dist_water != null);
    const colors = quantileColors(ok.map(u => u.v.lst ?? null), ['#2b6f9e', '#5a95b8', '#9cc0cf', '#e9dcc0', '#f2b05a', '#e4772f', '#c8382c']);
    const P = ok.map(u => project(u.c));
    const xs = P.map(p => p[0]), ys = P.map(p => p[1]);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    const k = 860 / span;
    const dw = ok.map(u => u.v.dist_water!), lst = ok.map(u => u.v.lst!);
    const [d0, d1] = [Math.min(...dw), Math.max(...dw)], [l0, l1] = [Math.min(...lst), Math.max(...lst)];
    return ok.map((u, i) => {
      const ring = (u.g!.type === 'Polygon' ? u.g!.coordinates[0] : u.g!.coordinates[0][0]) as number[][];
      const shape = ring.map(c => { const [x, y] = project(c); return `${((x - P[i][0]) * k).toFixed(1)},${((y - P[i][1]) * k).toFixed(1)}`; }).join(' ');
      return {
        id: u.id, color: colors[i]!, shape,
        map: { x: 500 + (P[i][0] - cx) * k, y: 500 + (P[i][1] - cy) * k },
        // chart: distance from the sea grows to the left (RTL reading), heat grows upward
        chart: { x: 880 - ((dw[i] - d0) / (d1 - d0)) * 760, y: 880 - ((lst[i] - l0) / (l1 - l0)) * 760 },
      };
    });
  }, [units]);

  const r = useMemo(() => {
    if (!units) return null;
    const { xs, ys } = pairsOf(column(units, 'dist_water'), column(units, 'lst'));
    return pearson(xs, ys);
  }, [units]);

  return (
    <div className="hero-stage" aria-label="הנפשה: משושי העיר הופכים לתרשים פיזור" role="img">
      <div style={{ width: '100%', height: '100%' }}>
        <svg viewBox="0 0 1000 1000">
          <defs>
            <filter id="lift" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="6" stdDeviation="8" floodOpacity=".22" /></filter>
            <radialGradient id="floor" cx=".5" cy=".5" r=".6"><stop offset="0" stopColor="var(--paper)" stopOpacity=".9" /><stop offset="1" stopColor="var(--paper)" stopOpacity="0" /></radialGradient>
          </defs>
          <circle cx="500" cy="500" r="480" fill="url(#floor)" />
          <motion.g initial={false} animate={{ opacity: asChart ? 1 : 0 }} transition={{ duration: 0.6 }}>
            <line x1="120" y1="880" x2="900" y2="880" stroke="var(--line-2)" />
            <line x1="900" y1="880" x2="900" y2="100" stroke="var(--line-2)" />
            <text x="510" y="930" textAnchor="middle" fontSize="26" fill="var(--muted)">מרחק מהים</text>
            <text x="950" y="490" textAnchor="middle" fontSize="26" fill="var(--muted)" transform="rotate(90 950 490)">חום פני השטח</text>
          </motion.g>
          {g?.map((h, i) => (
            <motion.g key={h.id} initial={false} animate={{ x: asChart ? h.chart.x : h.map.x, y: asChart ? h.chart.y : h.map.y, scale: asChart ? 0.55 : 1 }}
              transition={{ type: 'spring', stiffness: 60, damping: 14, delay: (i % 25) * 0.012 }}>
              <polygon points={h.shape} fill={h.color} stroke="rgba(255,255,255,.75)" strokeWidth="2" filter="url(#lift)" />
            </motion.g>
          ))}
        </svg>
      </div>
      <div className="hero-caption">{g ? (asChart ? `אותם ${g.length} משושים כתרשים: r = ${fr(r)}` : `אשדוד ב-${g.length} משושים, צבע לפי חום פני השטח`) : 'טוען את העיר'}</div>
    </div>
  );
}

