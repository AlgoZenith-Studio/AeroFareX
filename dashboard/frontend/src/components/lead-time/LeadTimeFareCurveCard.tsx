'use client';

import React from 'react';
import type { AdvanceWindow, LeadTimeMatrix, RouteId } from '@aerofarex/shared-types';
import { inr } from '@/lib/format';
import { ChartFrame } from '@/components/ui/ChartFrame';
import { DataTable } from '@/components/ui/DataTable';
import { LineChart } from '@/components/charts/LineChart';

const ROUTE_LABELS: Record<RouteId, string> = {
  'DEL-BOM': 'Delhi → Mumbai',
  'DEL-BLR': 'Delhi → Bengaluru',
  'BOM-BLR': 'Mumbai → Bengaluru',
  'DEL-CCU': 'Delhi → Kolkata',
  'BLR-HYD': 'Bengaluru → Hyderabad',
};

const WINDOW_DAYS: Record<AdvanceWindow, number> = {
  'T+45': 45,
  'T+30': 30,
  'T+15': 15,
  'T+7': 7,
  'T+1': 1,
};

const ROUTE_COLORS: Record<RouteId, string> = {
  'DEL-BOM': 'var(--slot-1)',
  'DEL-BLR': 'var(--slot-2)',
  'BOM-BLR': 'var(--slot-3)',
  'DEL-CCU': 'var(--slot-4)',
  'BLR-HYD': 'var(--slot-5)',
};

export const LeadTimeFareCurveCard: React.FC<{
  matrix?: LeadTimeMatrix;
  status: 'pending' | 'error' | 'success';
  error?: unknown;
  onRetry?: () => void;
  className?: string;
}> = ({ matrix, status, error, onRetry, className }) => {
  const routes: RouteId[] = ['DEL-BOM', 'DEL-BLR', 'BOM-BLR', 'DEL-CCU', 'BLR-HYD'];
  const windowList: AdvanceWindow[] = ['T+45', 'T+30', 'T+15', 'T+7', 'T+1'];

  const series = routes.map((r) => ({
    key: r,
    label: ROUTE_LABELS[r],
    color: ROUTE_COLORS[r],
    points: windowList.map((w) => {
      const cell = matrix?.cells.find((c) => c.route_id === r && c.window === w);
      return {
        date: `${WINDOW_DAYS[w]} days out`,
        value: cell?.total_fare_paise ? cell.total_fare_paise / 100 : 0,
        provenance: cell?.provenance ?? 'REAL',
      };
    }),
  }));

  return (
    <ChartFrame
      className={className}
      title="Fare Curve by Days Before Departure"
      subtitle="Yield management escalation curve comparing advance purchase (45d out) vs last-minute (1d out)"
      status={status}
      error={error}
      onRetry={onRetry}
      isEmpty={!matrix || !matrix.cells.length}
      emptyReason="No fare curve data available."
      table={() => (
        <DataTable
          caption="Fare curve by advance booking window (rupees)"
          rowKey={(r) => r.route}
          rows={routes.map((r) => ({
            route: r,
            label: ROUTE_LABELS[r],
            t45: matrix?.cells.find((c) => c.route_id === r && c.window === 'T+45')?.total_fare_paise,
            t30: matrix?.cells.find((c) => c.route_id === r && c.window === 'T+30')?.total_fare_paise,
            t15: matrix?.cells.find((c) => c.route_id === r && c.window === 'T+15')?.total_fare_paise,
            t7: matrix?.cells.find((c) => c.route_id === r && c.window === 'T+7')?.total_fare_paise,
            t1: matrix?.cells.find((c) => c.route_id === r && c.window === 'T+1')?.total_fare_paise,
          }))}
          columns={[
            { key: 'label', header: 'Route', render: (r) => r.label },
            { key: 't45', header: 'T+45 (45d)', align: 'right', render: (r) => (r.t45 ? inr(r.t45) : 'N/A') },
            { key: 't30', header: 'T+30 (30d)', align: 'right', render: (r) => (r.t30 ? inr(r.t30) : 'N/A') },
            { key: 't15', header: 'T+15 (15d)', align: 'right', render: (r) => (r.t15 ? inr(r.t15) : 'N/A') },
            { key: 't7', header: 'T+7 (7d)', align: 'right', render: (r) => (r.t7 ? inr(r.t7) : 'N/A') },
            { key: 't1', header: 'T+1 (1d)', align: 'right', render: (r) => (r.t1 ? inr(r.t1) : 'N/A') },
          ]}
        />
      )}
    >
      {() => (
        <LineChart
          series={series}
          format={(v) => `₹${v.toLocaleString('en-IN')}`}
          ariaLabel="Yield curve showing fare inflation from T+45 to T+1"
        />
      )}
    </ChartFrame>
  );
};
