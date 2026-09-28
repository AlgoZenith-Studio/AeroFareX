'use client';

import React from 'react';
import type { CoverageDay } from '@aerofarex/shared-types';
import { pct, shortDate } from '@/lib/format';
import { ChartFrame } from '@/components/ui/ChartFrame';
import { DataTable } from '@/components/ui/DataTable';
import { LineChart } from '@/components/charts/LineChart';

export const QualityCoverageTrendCard: React.FC<{
  coverageDays?: CoverageDay[];
  status: 'pending' | 'error' | 'success';
  error?: unknown;
  onRetry?: () => void;
  className?: string;
}> = ({ coverageDays = [], status, error, onRetry, className }) => {
  const series = [
    {
      key: 'coverage',
      label: 'Observed Coverage',
      color: 'var(--slot-1)',
      points: coverageDays.map((d) => ({
        date: d.date,
        value: d.coverage * 100,
        provenance: d.provenance,
      })),
    },
    {
      key: 'threshold',
      label: '90% Target Threshold',
      color: 'var(--status-critical)',
      points: coverageDays.map((d) => ({
        date: d.date,
        value: 90,
        provenance: d.provenance,
      })),
    },
  ];

  return (
    <ChartFrame
      className={className}
      title="30-Day Coverage Trend"
      subtitle="Daily scheduled check coverage ratio (%) against the 90% published threshold"
      status={status}
      error={error}
      onRetry={onRetry}
      isEmpty={!coverageDays.length}
      emptyReason="No coverage history available."
      footer={
        <span className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-sky-500" aria-hidden /> Observed Coverage
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-status-critical" aria-hidden /> 90% Target Threshold
          </span>
        </span>
      }
      table={() => (
        <DataTable
          caption="Daily coverage, expected, observed, and imputation rates"
          rowKey={(r) => r.date}
          rows={[...coverageDays].reverse()}
          initialSort={{ key: 'date', dir: 'desc' }}
          columns={[
            { key: 'date', header: 'Date', sortValue: (r) => r.date, render: (r) => shortDate(r.date) },
            {
              key: 'coverage',
              header: 'Coverage (%)',
              align: 'right',
              sortValue: (r) => r.coverage,
              render: (r) => (
                <span
                  className={
                    r.coverage >= 0.9 ? 'font-bold num text-sky-900' : 'font-bold num text-status-critical'
                  }
                >
                  {pct(r.coverage, 1)}
                </span>
              ),
            },
            {
              key: 'expected',
              header: 'Expected Checks',
              align: 'right',
              sortValue: (r) => r.expected,
              render: (r) => r.expected,
            },
            {
              key: 'observed',
              header: 'Usable Checks',
              align: 'right',
              sortValue: (r) => r.observed,
              render: (r) => r.observed,
            },
            {
              key: 'imputed',
              header: 'Imputed Rate',
              align: 'right',
              sortValue: (r) => r.imputation_rate,
              render: (r) => pct(r.imputation_rate, 1),
            },
            {
              key: 'provenance',
              header: 'Provenance',
              render: (r) => (r.provenance === 'REAL' ? 'Real' : 'Simulated'),
            },
          ]}
        />
      )}
    >
      {() => (
        <LineChart
          series={series}
          format={(v) => `${v.toFixed(1)}%`}
          ariaLabel="30-day coverage trend vs 90% target threshold"
        />
      )}
    </ChartFrame>
  );
};
