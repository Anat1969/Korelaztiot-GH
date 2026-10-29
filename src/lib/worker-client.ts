import type { Num, PairResult } from './stats';
import type { MatrixCell } from './stats.worker';

let w: Worker | null = null;
let seq = 0;
const waiting = new Map<number, (d: unknown) => void>();

function worker() {
  if (!w) {
    w = new Worker(new URL('./stats.worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (e: MessageEvent<{ id: number }>) => { waiting.get(e.data.id)?.(e.data); waiting.delete(e.data.id); };
  }
  return w;
}

function call<T>(msg: object): Promise<T> {
  const id = ++seq;
  return new Promise(res => { waiting.set(id, res as (d: unknown) => void); worker().postMessage({ ...msg, id }); });
}

export const runPair = (x: Num[], y: Num[], coords: [number, number][], control?: Num[]) =>
  call<{ res: PairResult | null }>({ kind: 'pair', x, y, coords, control }).then(d => d.res);

export const runMatrix = (keys: string[], cols: Num[][], coords: [number, number][]) =>
  call<{ cells: (MatrixCell | null)[][]; moran: number[] }>({ kind: 'matrix', keys, cols, coords });

export type { MatrixCell };
