'use client';

import React, { useState } from 'react';
import clsx from 'clsx';
import type { Attribution, SeriesName } from '@aerofarex/shared-types';
import { ChartFrame } from '@/components/ui/ChartFrame';
import { DataTable } from '@/components/ui/DataTable';
import { signed, points } from '@/lib/format';
import { WaterfallChart } from './WaterfallChart';

export type DimensionKey = 'route' | 'carrier' | 'window' | 'component' | 'driver';

const DIMENSIONS: { key: DimensionKey; label: string }[] = [
  { key: 'route', label: 'By Route' },
  { key: 'carrier', label: 'By Airline' },
  { key: 'window', label: 'By Booking Window' },
  { key: 'component', label: 'By Fee Component' },
  { key: 'driver', label: 'By Economic Driver' },
];

export const WaterfallCard: React.FC<{
  attribution?: Attribution;
  series: SeriesName;
  status: 'pending' | 'error' | 'success';
  error?: unknown;
  onRetry?: () => void;
  className?: string;
}> = ({ attribution, series, status, error, onRetry, className }) => {
  const [activeDimension, setActiveDimension] = useState<DimensionKey>('route');

  const steps = attribution?.axes[activeDimension] ?? [];

  const dimensionPills = (
    <div className="flex flex-wrap rounded-full bg-surface-alt p-0.5 text-xs" role="group" aria-label="Attribution Dimension">
      {DIMENSIONS.map((d) => (
        <button
          key={d.key}
          aria-pressed={activeDimension === d.key}
          onClick={() => setActiveDimension(d.key)}
          className={clsx(
            'rounded-full px-3 py-1 font-medium transition-colors',
            activeDimension === d.key ? 'bg-surface text-text-1 shadow-e1' : 'text-text-3 hover:text-text-1',
          )}
        >
          {d.label}
        </button>
      ))}
    </div>
  );

  return (
    <ChartFrame
      className={className}
      title="Waterfall Attribution"
      subtitle={`Additive bridge from ${attribution ? points(attribution.previous_value) : 'previous'} to ${attribution ? points(attribution.value) : 'current'} index (${series})`}
      action={dimensionPills}
      status={status}
      error={error}
      onRetry={onRetry}
      isEmpty={!attribution || !steps.length}
      emptyReason="No attribution breakdown available for this selection."
      generatedAt={attribution?.quality ? `${attribution.date}T14:30:00Z` : undefined}
      quality={attribution?.quality}
      table={() => (
        <DataTable
          caption={`Waterfall step values (${DIMENSIONS.find((d) => d.key === activeDimension)?.label})`}
          rowKey={(r) => r.key}
          rows={steps}
          initialSort={{ key: 'absContrib', dir: 'desc' }}
          columns={[
            { key: 'label', header: 'Segment / Driver', render: (r) => r.label },
            {
              key: 'contribution',
              header: 'Contribution (pts)',
              align: 'right',
              sortValue: (r) => r.contribution,
              render: (r) => signed(r.contribution, 2),
            },
            {
              key: 'pct',
              header: 'Share of Delta (%)',
              align: 'right',
              sortValue: (r) => Math.abs(r.contribution),
              render: (r) =>
                attribution?.delta
                  ? `${((r.contribution / attribution.delta) * 100).toFixed(1)}%`
                  : '0%',
            },
          ]}
        />
      )}
    >
      {() => (
        <WaterfallChart
          previousValue={attribution?.previous_value ?? 100}
          value={attribution?.value ?? 100}
          steps={steps}
          ariaLabel={`Waterfall chart by ${DIMENSIONS.find((d) => d.key === activeDimension)?.label}`}
        />
      )}
    </ChartFrame>
  );
};
