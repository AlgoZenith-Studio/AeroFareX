'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { Plane, ArrowRight, Search, TrendingDown, TrendingUp } from 'lucide-react';
import type { RouteSummary } from '@aerofarex/shared-types';
import { inr, pct, signed } from '@/lib/format';
import { DataTable } from '@/components/ui/DataTable';
import { RouteSparkline } from './RouteSparkline';

export const RoutesTableCard: React.FC<{
  routes?: RouteSummary[];
  className?: string;
}> = ({ routes = [], className }) => {
  const [search, setSearch] = useState('');

  const filteredRoutes = useMemo(() => {
    if (!search) return routes;
    const s = search.toLowerCase();
    return routes.filter(
      (r) =>
        r.label.toLowerCase().includes(s) ||
        r.origin.toLowerCase().includes(s) ||
        r.destination.toLowerCase().includes(s) ||
        r.route_id.toLowerCase().includes(s),
    );
  }, [routes, search]);

  return (
    <section className={clsx('card flex flex-col p-5', className)} aria-label="DGCA Trunk Routes Table">
      <header className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-[17px] leading-tight font-bold">Five DGCA Trunk Routes</h2>
          <p className="mt-1 text-xs text-text-3">
            Real-time advertised base fare vs total payable fare, passenger weights, and 14-day price sparklines.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Search Bar */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-3" />
            <input
              type="text"
              placeholder="Search routes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 rounded-full border border-line bg-surface-alt pl-8 pr-3 text-xs text-text-1 focus:border-black focus:outline-none"
            />
          </div>
        </div>
      </header>

      <DataTable
        caption="DGCA five-route passenger index basket"
        rowKey={(r) => r.route_id}
        rows={filteredRoutes}
        initialSort={{ key: 'pax_share', dir: 'desc' }}
        columns={[
          {
            key: 'label',
            header: 'Route / City Pair',
            sortValue: (r) => r.label,
            render: (r) => (
              <Link
                href={`/routes/${r.route_id}/`}
                className="group flex items-center gap-3 py-1 hover:text-black"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-sky-200 text-sky-900 transition-colors group-hover:bg-sky-400 group-hover:text-black">
                  <Plane size={17} />
                </span>
                <div>
                  <span className="block text-sm font-bold text-text-1 group-hover:underline">
                    {r.origin} → {r.destination}
                  </span>
                  <span className="block text-xs text-text-3">{r.label}</span>
                </div>
              </Link>
            ),
          },
          {
            key: 'pax_share',
            header: 'DGCA Pax Weight',
            align: 'right',
            sortValue: (r) => r.pax_share,
            render: (r) => (
              <div className="flex items-center justify-end gap-2.5">
                <div className="w-16 bg-surface-alt h-1.5 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-black"
                    style={{ width: `${Math.min(100, r.pax_share * 100 * 2.5)}%` }}
                  />
                </div>
                <span className="num font-bold text-xs text-text-1">{pct(r.pax_share, 1)}</span>
              </div>
            ),
          },
          {
            key: 'base_fare_paise',
            header: 'Base Fare',
            align: 'right',
            sortValue: (r) => r.base_fare_paise,
            render: (r) => <span className="num font-bold text-text-1">{inr(r.base_fare_paise)}</span>,
          },
          {
            key: 'total_fare_paise',
            header: 'Total Payable',
            align: 'right',
            sortValue: (r) => r.total_fare_paise,
            render: (r) => <span className="num font-bold text-text-1">{inr(r.total_fare_paise)}</span>,
          },
          {
            key: 'hidden_extra',
            header: 'Hidden Extra',
            align: 'right',
            sortValue: (r) => r.total_fare_paise - r.base_fare_paise,
            render: (r) => {
              const diff = r.total_fare_paise - r.base_fare_paise;
              const pctDiff = (diff / r.base_fare_paise) * 100;
              return (
                <div className="flex flex-col items-end">
                  <span className="num font-bold text-status-warning">{inr(diff)}</span>
                  <span className="text-[10px] text-text-3"><span className="num font-bold">+{pctDiff.toFixed(1)}%</span> above base</span>
                </div>
              );
            },
          },
          {
            key: 'change_24h_pct',
            header: '24h Movement',
            align: 'right',
            sortValue: (r) => r.change_24h_pct,
            render: (r) => (
              <span
                className={clsx(
                  'num font-bold inline-flex items-center gap-1',
                  r.change_24h_pct > 0
                    ? 'text-status-warning'
                    : r.change_24h_pct < 0
                    ? 'text-sky-900'
                    : 'text-text-3',
                )}
              >
                {r.change_24h_pct >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                {signed(r.change_24h_pct, 1, '%')}
              </span>
            ),
          },
          {
            key: 'sparkline',
            header: '14-Day Sparkline',
            render: (r) => <RouteSparkline data={r.sparkline} />,
          },
          {
            key: 'action',
            header: '',
            align: 'right',
            render: (r) => (
              <Link
                href={`/routes/${r.route_id}/`}
                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line-control bg-surface px-3 text-xs font-bold text-text-1 hover:border-black hover:bg-surface-alt transition-colors"
              >
                Detail <ArrowRight size={13} aria-hidden />
              </Link>
            ),
          },
        ]}
      />
    </section>
  );
};
