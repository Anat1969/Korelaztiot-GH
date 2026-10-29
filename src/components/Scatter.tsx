import { useMemo } from 'react';
import { motion } from 'motion/react';
import type { PairResult } from '../lib/stats';
import { VAR, fmt } from '../lib/variables';

interface Props {
  xs: number[];
  ys: number[];
  colors: string[];
  res: PairResult;
  xKey: string;
  yKey: string;
  hovered: number | null; // index within xs
  onHover: (k: number | null) => void;
  onSelect?: (k: number) => void;
  names: string[];
}

const W = 360, H = 300, M = { t: 14, r: 14, b: 40, l: 50 };

function ticks(min: number, max: number, n = 4) {
  const span = max - min || 1, step0 = span / n, p = Math.pow(10, Math.floor(Math.log10(step0)));
  const step = [1, 2, 5, 10].map(m => m * p).find(s => span / s <= n) ?? p * 10;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(+v.toFixed(10));
  return out;
}

export default function Scatter({ xs, ys, colors, res, xKey, yKey, hovered, onHover, onSelect, names }: Props) {
  const g = useMemo(() => {
    const pad = (a: number[]) => { const lo = Math.min(...a), hi = Math.max(...a), d = (hi - lo) * 0.06 || 1; return [lo - d, hi + d] as const; };
    const [x0, x1] = pad(xs), [y0, y1] = pad(ys);
    // RTL reading: the x axis still grows to the right, as in every scientific plot
    const sx = (v: number) => M.l + ((v - x0) / (x1 - x0)) * (W - M.l - M.r);
    const sy = (v: number) => H - M.b - ((v - y0) / (y1 - y0)) * (H - M.t - M.b);
    // regression line and 95% confidence band of the mean
    const n = xs.length, mx = xs.reduce((a, b) => a + b, 0) / n;
    const sxx = xs.reduce((a, v) => a + (v - mx) ** 2, 0);
    const s2 = res.reg.resid.reduce((a, v) => a + v * v, 0) / Math.max(1, n - 2);
    const band: string[] = [], bandLow: string[] = [];
    for (let k = 0; k <= 40; k++) {
      const x = x0 + ((x1 - x0) * k) / 40, yh = res.reg.intercept + res.reg.slope * x;
      const se = Math.sqrt(s2 * (1 / n + (x - mx) ** 2 / (sxx || 1))) * 1.96;
      band.push(`${sx(x)},${sy(yh + se)}`); bandLow.unshift(`${sx(x)},${sy(yh - se)}`);
    }
    return { sx, sy, x0, x1, y0, y1, band: [...band, ...bandLow].join(' '), xt: ticks(x0, x1), yt: ticks(y0, y1) };
  }, [xs, ys, res]);

  const X = VAR[xKey], Y = VAR[yKey];
  const line = [g.x0, g.x1].map(x => [g.sx(x), g.sy(res.reg.intercept + res.reg.slope * x)]);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`תרשים פיזור של ${X.name} מול ${Y.name}`} style={{ width: '100%', height: 'auto', direction: 'ltr' }} data-testid="scatter">
      <defs>
        <linearGradient id="sc-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="var(--paper)" /><stop offset="1" stopColor="var(--bg)" /></linearGradient>
      </defs>
      <rect x={M.l} y={M.t} width={W - M.l - M.r} height={H - M.t - M.b} fill="url(#sc-bg)" stroke="var(--line)" rx="6" />
      {g.xt.map(t => <g key={'x' + t}><line x1={g.sx(t)} x2={g.sx(t)} y1={M.t} y2={H - M.b} stroke="var(--line)" strokeDasharray="2 4" /><text x={g.sx(t)} y={H - M.b + 14} fontSize="9" textAnchor="middle" fill="var(--muted)" fontFamily="var(--mono)">{fmt(t, xKey)}</text></g>)}
      {g.yt.map(t => <g key={'y' + t}><line x1={M.l} x2={W - M.r} y1={g.sy(t)} y2={g.sy(t)} stroke="var(--line)" strokeDasharray="2 4" /><text x={M.l - 6} y={g.sy(t) + 3} fontSize="9" textAnchor="end" fill="var(--muted)" fontFamily="var(--mono)">{fmt(t, yKey)}</text></g>)}
      <text x={(W + M.l) / 2} y={H - 6} fontSize="11" textAnchor="middle" fill="var(--ink-2)">{X.name} ({X.unit})</text>
      <text transform={`translate(12 ${(H - M.b) / 2}) rotate(-90)`} fontSize="11" textAnchor="middle" fill="var(--ink-2)">{Y.name} ({Y.unit})</text>
      <motion.polygon points={g.band} fill="color-mix(in oklab, var(--accent) 16%, transparent)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }} />
      <motion.line x1={line[0][0]} y1={line[0][1]} x2={line[1][0]} y2={line[1][1]} stroke="var(--ink)" strokeWidth="1.6"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9, ease: 'easeOut' }} />
      {xs.map((x, k) => (
        <motion.circle key={k} cx={g.sx(x)} cy={g.sy(ys[k])} r={hovered === k ? 7 : xs.length > 300 ? 2.6 : 4.2}
          fill={colors[k] || 'var(--muted)'} stroke={hovered === k ? 'var(--ink)' : 'rgba(0,0,0,.35)'} strokeWidth={hovered === k ? 2 : 0.6}
          initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: Math.min(0.6, k * 0.004), type: 'spring', stiffness: 260, damping: 22 }}
          onMouseEnter={() => onHover(k)} onMouseLeave={() => onHover(null)} onClick={() => onSelect?.(k)} style={{ cursor: 'pointer' }}>
          <title>{`${names[k]}: ${fmt(x, xKey)} / ${fmt(ys[k], yKey)}`}</title>
        </motion.circle>
      ))}
    </svg>
  );
}
