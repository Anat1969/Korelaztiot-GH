import { motion } from 'motion/react';
import type { ReliabilityPart } from '../lib/stats';
import Rich from './Rich';

const tone = (s: number) => (s >= 70 ? 'var(--tl-good)' : s >= 45 ? 'var(--tl-mid)' : 'var(--tl-bad)');
const word = (s: number) => (s >= 70 ? 'אפשר להישען על הממצא' : s >= 45 ? 'כיוון לבדיקה, לא מסקנה' : 'לא לבסס החלטה על הממצא');

export default function Reliability({ score, parts }: { score: number; parts: ReliabilityPart[] }) {
  return (
    <div data-testid="reliability">
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
        <div>
          <div className="eyebrow">מדד אמינות</div>
          <div style={{ color: tone(score), fontSize: 18, fontWeight: 600 }}>{word(score)}</div>
        </div>
        <div className="mono" style={{ fontSize: 40, color: tone(score), lineHeight: 1 }}>{score}</div>
      </div>
      <div className="meter" style={{ marginTop: 10 }} aria-hidden>
        <motion.i style={{ background: `linear-gradient(90deg, ${tone(score)}, color-mix(in oklab, ${tone(score)} 60%, white))` }}
          initial={{ width: 0 }} animate={{ width: `${score}%` }} transition={{ duration: 0.9, ease: 'easeOut' }} />
      </div>
      <div style={{ marginTop: 10 }}>
        {parts.map(p => (
          <div className="part" key={p.key}>
            <div style={{ fontSize: 13.5 }}>{p.label}</div>
            <div className="meter" style={{ height: 6 }}><i style={{ width: `${Math.round(p.score * 100)}%`, background: tone(p.score * 100) }} /></div>
            <Rich as="div" className="note">{p.note}</Rich>
          </div>
        ))}
      </div>
    </div>
  );
}
