'use client';

import React, { useMemo, useState } from 'react';
import clsx from 'clsx';
import { Search, TrendingDown, TrendingUp } from 'lucide-react';
import type { Attribution } from '@aerofarex/shared-types';
import { DataTable } from '@/components/ui/DataTable';
import { signed } from '@/lib/format';
import { QualityBadge } from '@/components/ui/QualityBadge';

interface FlatContributionRow {
  key: string;
  axis: string;
  label: string;
  contribution: number;
  share: number;
}

export const ContributionTableCard: React.FC<{
  attribution?: Attribution;
  className?: string;
}> = ({ attribution, className }) => {
  const [search, setSearch] = useState('');
  const [axisFilter, setAxisFilter] = useState<string>('ALL');
  const [directionFilter, setDirectionFilter] = useState<'ALL' | 'DROP' | 'RISE'>('ALL');

  const rows = useMemo<FlatContributionRow[]>(() => {
    if (!attribution) return [];
    const out: FlatContributionRow[] = [];
    const delta = attribution.delta || 1;

    for (const [axis, items] of Object.entries(attribution.axes)) {
      for (const item of items) {
        out.push({
          key: `${axis}-${item.key}`,
          axis: axis.toUpperCase(),
          label: item.label,
          contribution: item.contribution,
          share: (item.contribution / delta) * 100,
        });
      }
    }
    return out;
  }, [attribution]);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      // Search text filter
      const matchesSearch =
        !search ||
        r.label.toLowerCase().includes(search.toLowerCase()) ||
        r.axis.toLowerCase().includes(search.toLowerCase());

      // Axis filter
      const matchesAxis = axisFilter === 'ALL' || r.axis === axisFilter;

      // Direction filter
      const matchesDir =
        directionFilter === 'ALL' ||
        (directionFilter === 'DROP' && r.contribution < 0) ||
        (directionFilter === 'RISE' && r.contribution > 0);

      return matchesSearch && matchesAxis && matchesDir;
    });
  }, [rows, search, axisFilter, directionFilter]);

  if (!attribution) return null;

  return (
    <section className={clsx('card flex flex-col p-5', className)} aria-label="Contribution Table">
      <header className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-[17px] leading-tight font-bold">Contribution Table</h2>
          <p className="mt-1 text-xs text-text-3">
            Granular breakdown of point impact and share of net index movement across all segments.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Search box */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-3" />
            <input
              type="text"
              placeholder="Search drivers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 rounded-full border border-line bg-surface-alt pl-8 pr-3 text-xs text-text-1 focus:border-black focus:outline-none"
            />
          </div>

          {/* Direction filters */}
          <div className="flex rounded-full bg-surface-alt p-0.5 text-xs">
            {(['ALL', 'DROP', 'RISE'] as const).map((dir) => (
              <button
                key={dir}
                onClick={() => setDirectionFilter(dir)}
                className={clsx(
                  'rounded-full px-2.5 py-1 font-medium transition-colors',
                  directionFilter === dir ? 'bg-surface text-text-1 shadow-e1' : 'text-text-3 hover:text-text-1',
                )}
              >
                {dir === 'ALL' ? 'All' : dir === 'DROP' ? 'Price Drop' : 'Price Rise'}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Axis category tabs */}
      <div className="flex flex-wrap gap-1.5 mb-4 border-b border-line pb-3">
        {['ALL', 'ROUTE', 'CARRIER', 'WINDOW', 'COMPONENT', 'DRIVER'].map((cat) => (
          <button
            key={cat}
            onClick={() => setAxisFilter(cat)}
            className={clsx(
              'rounded-full px-3 py-1 text-xs font-bold transition-colors',
              axisFilter === cat
                ? 'bg-black text-white'
                : 'bg-surface-alt text-text-2 hover:bg-surface-tint hover:text-text-1',
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      <DataTable
        caption="Points contribution by segment and axis"
        rowKey={(r) => r.key}
        rows={filteredRows}
        initialSort={{ key: 'contribution', dir: 'asc' }}
        columns={[
          {
            key: 'label',
            header: 'Segment / Driver',
            sortValue: (r) => r.label,
            render: (r) => (
              <div className="flex items-center gap-2">
                <span className="font-medium text-text-1">{r.label}</span>
              </div>
            ),
          },
          {
            key: 'axis',
            header: 'Axis',
            sortValue: (r) => r.axis,
            render: (r) => (
              <span className="rounded-md bg-surface-alt px-2 py-0.5 text-[11px] font-bold text-text-3">
                {r.axis}
              </span>
            ),
          },
          {
            key: 'contribution',
            header: 'Point Impact',
            align: 'right',
            sortValue: (r) => r.contribution,
            render: (r) => (
              <span
                className={clsx(
                  'font-bold num inline-flex items-center gap-1',
                  r.contribution > 0 ? 'text-status-warning' : r.contribution < 0 ? 'text-sky-900' : 'text-text-3',
                )}
              >
                {r.contribution >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                {signed(r.contribution, 2)} pts
              </span>
            ),
          },
          {
            key: 'share',
            header: 'Share of Delta',
            align: 'right',
            sortValue: (r) => Math.abs(r.share),
            render: (r) => (
              <div className="flex items-center justify-end gap-2">
                <div className="w-16 bg-surface-alt h-1.5 rounded-full overflow-hidden">
                  <div
                    className={clsx('h-full rounded-full', r.contribution >= 0 ? 'bg-status-warning' : 'bg-sky-500')}
                    style={{ width: `${Math.min(100, Math.abs(r.share))}%` }}
                  />
                </div>
                <span className="num font-medium text-xs text-text-2">{r.share.toFixed(1)}%</span>
              </div>
            ),
          },
          {
            key: 'status',
            header: 'Quality',
            render: () => <QualityBadge quality={attribution.quality} />,
          },
        ]}
      />
    </section>
  );
};
