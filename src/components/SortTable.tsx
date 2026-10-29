import { Fragment, useMemo, useState, type ReactNode } from 'react';

// Every table is sortable by every column, and by groups (end-to-end-builder). Arrows show the order.
export interface Col<T> { key: string; label: string; value: (r: T) => string | number | null; render?: (r: T) => ReactNode; num?: boolean }

export default function SortTable<T>({ rows, cols, group, groupLabel, initial, testid }: {
  rows: T[]; cols: Col<T>[]; group?: (r: T) => string; groupLabel?: (g: string) => ReactNode; initial?: { key: string; dir: 1 | -1 }; testid?: string;
}) {
  const [sort, setSort] = useState(initial ?? { key: cols[0].key, dir: 1 as 1 | -1 });
  const [grouped, setGrouped] = useState(!!group);
  const sorted = useMemo(() => {
    const col = cols.find(c => c.key === sort.key)!;
    const cmp = (a: T, b: T) => {
      const x = col.value(a), y = col.value(b);
      if (x == null) return 1;
      if (y == null) return -1;
      return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'he')) * sort.dir;
    };
    const r = [...rows].sort(cmp);
    return grouped && group ? r.sort((a, b) => group(a).localeCompare(group(b), 'he') || cmp(a, b)) : r;
  }, [rows, cols, sort, grouped, group]);
  let last = '';
  return (
    <div style={{ overflowX: 'auto' }}>
      {group && (
        <div className="seg" role="group" aria-label="קיבוץ" style={{ marginBottom: 8 }}>
          <button aria-pressed={grouped} onClick={() => setGrouped(true)}>לפי קבוצות</button>
          <button aria-pressed={!grouped} onClick={() => setGrouped(false)}>רשימה אחת</button>
        </div>
      )}
      <table className="sort" data-testid={testid}>
        <thead><tr>{cols.map(c => {
          const on = sort.key === c.key;
          return (
            <th key={c.key} aria-sort={on ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
              <button onClick={() => setSort({ key: c.key, dir: on ? (-sort.dir as 1 | -1) : (c.num ? -1 : 1) })}>
                {c.label} <span className="arrow">{on ? (sort.dir === 1 ? '▲' : '▼') : '▲▼'}</span>
              </button>
            </th>
          );
        })}</tr></thead>
        <tbody>{sorted.map((r, i) => {
          const g = grouped && group ? group(r) : '';
          const head = g && g !== last ? (last = g, true) : false;
          return (
            <Fragment key={i}>
              {head && <tr className="group"><td colSpan={cols.length}>{groupLabel ? groupLabel(g) : g}</td></tr>}
              <tr>{cols.map(c => <td key={c.key} className={c.num ? 'num' : undefined}>{c.render ? c.render(r) : (c.value(r) ?? '')}</td>)}</tr>
            </Fragment>
          );
        })}</tbody>
      </table>
    </div>
  );
}
