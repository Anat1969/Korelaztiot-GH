// Traffic light (end-to-end-builder): positive green, conditional orange, negative or failing red.
export type Level = 'good' | 'mid' | 'bad';

export const levelOfP = (p: number | null | undefined): Level => (p == null || !isFinite(p) ? 'bad' : p < 0.05 ? 'good' : p < 0.1 ? 'mid' : 'bad');
export const levelOfScore = (s: number): Level => (s >= 70 ? 'good' : s >= 45 ? 'mid' : 'bad');
export const toneOf = (l: Level) => (l === 'good' ? 'tone-solution' : l === 'mid' ? 'tone-mid' : 'tone-problem');
export const colorOf = (l: Level) => `var(--tl-${l})`;

export default function Light({ level, children }: { level: Level; children: React.ReactNode }) {
  return <span className={`tl tl-${level}`}>{children}</span>;
}
