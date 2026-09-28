'use client';

import React from 'react';
import clsx from 'clsx';
import type { Observation } from '@aerofarex/shared-types';
import { inr } from '@/lib/format';
import { CARRIER_COLOR } from '@/lib/entities';
import { DataTable } from '@/components/ui/DataTable';

const CARRIERS_META: Record<string, { label: string; tier: string }> = {
  '6E': { label: 'IndiGo', tier: 'HTTP Direct' },
  AI: { label: 'Air India', tier: 'Dynamic Search' },
  QP: { label: 'Akasa Air', tier: 'HTTP Direct' },
  SG: { label: 'SpiceJet', tier: 'Browser Automation' },
};

export const RouteCarrierComparisonCard: React.FC<{
  observations?: Observation[];
  className?: string;
}> = ({ observations = [], className }) => {
  // Aggregate observations by carrier for this route
  const carrierStats = Object.keys(CARRIERS_META).map((code) => {
    const mine = observations.filter((o) => o.carrier_code === code);
    const valid = mine.filter((o) => o.available && o.components !== null);
    const avgBase = valid.length
      ? Math.round(valid.reduce((s, o) => s + o.components!.base_fare_paise, 0) / valid.length)
      : 0;
    const avgTotal = valid.length
      ? Math.round(valid.reduce((s, o) => s + o.components!.total_payable_paise, 0) / valid.length)
      : 0;
    const availabilityRate = mine.length ? (valid.length / mine.length) * 100 : 0;

    return {
      code,
      label: CARRIERS_META[code].label,
      tier: CARRIERS_META[code].tier,
      totalObserved: mine.length,
      validObserved: valid.length,
      avgBase,
      avgTotal,
      hiddenFee: avgTotal - avgBase,
      availabilityRate,
    };
  });

  return (
    <section className={clsx('card flex flex-col p-5', className)} aria-label="Carrier Comparison">
      <header className="mb-4">
        <h2 className="text-[17px] leading-tight font-bold">Airlines & Carrier Comparison</h2>
        <p className="mt-1 text-xs text-text-3">
          Average advertised base fare vs total fare across airlines operating this route.
        </p>
      </header>

      <DataTable
        caption="Carrier pricing summary and data availability"
        rowKey={(r) => r.code}
        rows={carrierStats}
        initialSort={{ key: 'avgTotal', dir: 'asc' }}
        columns={[
          {
            key: 'label',
            header: 'Airline / Carrier',
            sortValue: (r) => r.label,
            render: (r) => (
              <div className="flex items-center gap-2.5">
                <span
                  className="grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold text-white"
                  style={{ background: CARRIER_COLOR[r.code as keyof typeof CARRIER_COLOR] || 'var(--black)' }}
                >
                  {r.code}
                </span>
                <div>
                  <span className="block text-sm font-bold text-text-1">{r.label}</span>
                  <span className="block text-[11px] text-text-3">{r.tier}</span>
                </div>
              </div>
            ),
          },
          {
            key: 'avgBase',
            header: 'Mean Base Fare',
            align: 'right',
            sortValue: (r) => r.avgBase,
            render: (r) => <span className="num font-bold text-text-1">{r.avgBase ? inr(r.avgBase) : 'N/A'}</span>,
          },
          {
            key: 'avgTotal',
            header: 'Mean Total Fare',
            align: 'right',
            sortValue: (r) => r.avgTotal,
            render: (r) => <span className="num font-bold text-text-1">{r.avgTotal ? inr(r.avgTotal) : 'N/A'}</span>,
          },
          {
            key: 'hiddenFee',
            header: 'Hidden Extra',
            align: 'right',
            sortValue: (r) => r.hiddenFee,
            render: (r) => (
              <span className="num font-bold text-status-warning">
                {r.hiddenFee ? `+${inr(r.hiddenFee)}` : 'N/A'}
              </span>
            ),
          },
          {
            key: 'availabilityRate',
            header: 'Availability',
            align: 'right',
            sortValue: (r) => r.availabilityRate,
            render: (r) => (
              <span
                className={clsx(
                  'num font-bold rounded-full px-2.5 py-0.5 text-xs',
                  r.availabilityRate >= 90
                    ? 'bg-surface-tint text-sky-900'
                    : r.availabilityRate >= 75
                    ? 'bg-status-warning/20 text-status-warning'
                    : 'bg-status-critical/20 text-status-critical',
                )}
              >
                {r.availabilityRate.toFixed(0)}%
              </span>
            ),
          },
        ]}
      />
    </section>
  );
};
