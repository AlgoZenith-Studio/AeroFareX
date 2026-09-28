'use client';

import React from 'react';
import clsx from 'clsx';
import type { SourceHealth } from '@aerofarex/shared-types';
import { SOURCE_COLOR } from '@/lib/entities';
import { relativeTime, pct } from '@/lib/format';
import { StatusPill } from '@/components/ui/StatusPill';
import { DataTable } from '@/components/ui/DataTable';

export const SourceCircuitStateCard: React.FC<{
  sources?: SourceHealth[];
  className?: string;
}> = ({ sources = [], className }) => {
  return (
    <section className={clsx('card flex flex-col p-5', className)} aria-label="Live Circuit State Per Source">
      <header className="mb-4">
        <h2 className="text-[17px] leading-tight font-bold">Live Circuit State Per Source</h2>
        <p className="mt-1 text-xs text-text-3">
          Real-time circuit breaker status, fetch tier mechanism, 7-day success rate, and adapter versions across all 5 sources.
        </p>
      </header>

      <DataTable
        caption="Data sources operational circuit health"
        rowKey={(r) => r.source}
        rows={sources}
        initialSort={{ key: 'success_rate_7d', dir: 'desc' }}
        columns={[
          {
            key: 'label',
            header: 'Source / Carrier',
            sortValue: (r) => r.label,
            render: (r) => (
              <div className="flex items-center gap-3 py-1">
                <span
                  className="grid size-9 shrink-0 place-items-center rounded-full text-xs font-bold text-white"
                  style={{ background: SOURCE_COLOR[r.source] || 'var(--black)' }}
                  aria-hidden
                >
                  {r.label.split(/\s+/).map((w) => w[0]).join('').slice(0, 2)}
                </span>
                <div>
                  <span className="block font-bold text-text-1">{r.label}</span>
                  <span className="block text-[11px] text-text-3">
                    {r.type === 'OTA' ? 'Aggregator' : 'Airline Direct'} · {r.adapter_version}
                  </span>
                </div>
              </div>
            ),
          },
          {
            key: 'fetch_tier',
            header: 'Fetch Tier',
            sortValue: (r) => r.fetch_tier,
            render: (r) => (
              <span className="rounded-md bg-surface-alt px-2.5 py-1 text-xs font-bold text-text-2">
                {r.fetch_tier}
              </span>
            ),
          },
          {
            key: 'state',
            header: 'Circuit State',
            sortValue: (r) => r.state,
            render: (r) => <StatusPill state={r.state} />,
          },
          {
            key: 'success_rate_7d',
            header: '7d Success Rate',
            align: 'right',
            sortValue: (r) => r.success_rate_7d,
            render: (r) => (
              <div className="flex items-center justify-end gap-2.5">
                <div className="w-16 bg-surface-alt h-1.5 rounded-full overflow-hidden">
                  <div
                    className={clsx(
                      'h-full rounded-full',
                      r.success_rate_7d >= 0.95
                        ? 'bg-sky-600'
                        : r.success_rate_7d >= 0.85
                        ? 'bg-status-warning'
                        : 'bg-status-critical',
                    )}
                    style={{ width: `${Math.min(100, r.success_rate_7d * 100)}%` }}
                  />
                </div>
                <span className="num font-bold text-xs text-text-1">{pct(r.success_rate_7d, 1)}</span>
              </div>
            ),
          },
          {
            key: 'consecutive_failures',
            header: 'Failures',
            align: 'right',
            sortValue: (r) => r.consecutive_failures,
            render: (r) => (
              <span
                className={clsx(
                  'num font-bold',
                  r.consecutive_failures > 0 ? 'text-status-warning' : 'text-text-3',
                )}
              >
                {r.consecutive_failures}
              </span>
            ),
          },
          {
            key: 'last_success_at',
            header: 'Last Success',
            align: 'right',
            sortValue: (r) => r.last_success_at || '',
            render: (r) => (
              <span className="text-xs text-text-2">
                {r.last_success_at ? relativeTime(r.last_success_at) : 'None'}
              </span>
            ),
          },
        ]}
      />
    </section>
  );
};
