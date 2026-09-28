'use client';

import React from 'react';
import type { RouteFareDay } from '@aerofarex/shared-types';
import { inr, shortDate } from '@/lib/format';
import { ChartFrame } from '@/components/ui/ChartFrame';
import { DataTable } from '@/components/ui/DataTable';
import { LineChart } from '@/components/charts/LineChart';

export const RouteFareHistoryCard: React.FC<{
  fares?: RouteFareDay[];
  status: 'pending' | 'error' | 'success';
  error?: unknown;
  onRetry?: () => void;
  className?: string;
}> = ({ fares = [], status, error, onRetry, className }) => {
  const series = [
    {
      key: 'total',
      label: 'Total Payable Fare',
      color: 'var(--slot-2)',
      points: fares.map((f) => ({
        date: f.date,
        value: f.components.total_payable_paise / 100,
        provenance: f.provenance,
      })),
    },
    {
      key: 'base',
      label: 'Base Fare',
      color: 'var(--slot-1)',
      points: fares.map((f) => ({
        date: f.date,
        value: f.components.base_fare_paise / 100,
        provenance: f.provenance,
      })),
    },
  ];

  return (
    <ChartFrame
      className={className}
      title="Base vs Total Fare History"
      subtitle="30-day advertised base fare vs final total payable fare with hidden-fee gap"
      status={status}
      error={error}
      onRetry={onRetry}
      isEmpty={!fares.length}
      emptyReason="No fare history available for this route."
      table={() => (
        <DataTable
          caption="Daily base fare, fees, and total payable fare"
          rowKey={(r) => r.date}
          rows={fares}
          initialSort={{ key: 'date', dir: 'desc' }}
          columns={[
            { key: 'date', header: 'Date', sortValue: (r) => r.date, render: (r) => shortDate(r.date) },
            {
              key: 'base',
              header: 'Base Fare',
              align: 'right',
              sortValue: (r) => r.components.base_fare_paise,
              render: (r) => inr(r.components.base_fare_paise),
            },
            {
              key: 'fuel',
              header: 'Fuel Surcharge',
              align: 'right',
              sortValue: (r) => r.components.fuel_surcharge_paise,
              render: (r) => inr(r.components.fuel_surcharge_paise),
            },
            {
              key: 'airport',
              header: 'Airport UDF/PSF',
              align: 'right',
              sortValue: (r) => r.components.udf_paise + r.components.psf_paise,
              render: (r) => inr(r.components.udf_paise + r.components.psf_paise),
            },
            {
              key: 'total',
              header: 'Total Payable',
              align: 'right',
              sortValue: (r) => r.components.total_payable_paise,
              render: (r) => inr(r.components.total_payable_paise),
            },
          ]}
        />
      )}
    >
      {() => (
        <LineChart
          series={series}
          format={(v) => `₹${v.toLocaleString('en-IN')}`}
          ariaLabel="Base fare vs total payable fare over 30 days"
        />
      )}
    </ChartFrame>
  );
};
