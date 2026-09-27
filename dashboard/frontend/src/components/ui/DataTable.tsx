'use client';

import React, { useMemo, useState } from 'react';
import clsx from 'clsx';
import { ArrowDown, ArrowUp } from 'lucide-react';

export interface Column<Row> {
  key: string;
  header: string;
  /** Sort value; defaults to the rendered cell text. */
  sortValue?: (row: Row) => number | string | null;
  render: (row: Row) => React.ReactNode;
  align?: 'left' | 'right';
}

/**
 * Semantic, sortable table: the accessible alternative to every chart (rule 4).
 * Missing values must be rendered with their reason by the caller, never as 0.
 */
export function DataTable<Row>({
  caption, columns, rows, rowKey, onRowClick, initialSort,
}: {
  caption: string;
  columns: Column<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
  onRowClick?: (row: Row) => void;
  initialSort?: { key: string; dir: 'asc' | 'desc' };
}) {
  const [sort, setSort] = useState(initialSort ?? null);
  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return rows;
    return [...rows].sort((a, b) => {
      const va = col.sortValue!(a);
      const vb = col.sortValue!(b);
      if (va === vb) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;
      return (va < vb ? -1 : 1) * (sort.dir === 'asc' ? 1 : -1);
    });
  }, [rows, columns, sort]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <caption className="mb-2 text-left text-xs text-text-3">{caption}</caption>
        <thead>
          <tr className="border-b border-line">
            {columns.map((c) => {
              const active = sort?.key === c.key;
              return (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  className={clsx('px-3 py-2 font-medium text-text-2', c.align === 'right' ? 'text-right' : 'text-left')}
                >
                  {c.sortValue ? (
                    <button
                      onClick={() => setSort({ key: c.key, dir: active && sort!.dir === 'desc' ? 'asc' : 'desc' })}
                      className="inline-flex items-center gap-1 hover:text-text-1"
                    >
                      {c.header}
                      {active && (sort!.dir === 'asc' ? <ArrowUp size={12} aria-hidden /> : <ArrowDown size={12} aria-hidden />)}
                    </button>
                  ) : c.header}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              onKeyDown={onRowClick ? (e) => { if (e.key === 'Enter') onRowClick(row); } : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              className={clsx('border-b border-line last:border-0', onRowClick && 'cursor-pointer hover:bg-surface-alt')}
            >
              {columns.map((c, i) => {
                const Cell = i === 0 ? 'th' : 'td';
                return (
                  <Cell
                    key={c.key}
                    scope={i === 0 ? 'row' : undefined}
                    className={clsx('px-3 py-2 font-normal', c.align === 'right' ? 'num text-right' : 'text-left')}
                  >
                    {c.render(row)}
                  </Cell>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
