'use client';

import React, { useState } from 'react';
import clsx from 'clsx';
import type { SeriesName } from '@aerofarex/shared-types';
import { useIndexFamily, useIndexHistory } from '@/lib/api/hooks';
import { SERIES_COLOR } from '@/lib/entities';
import { points, shortDate } from '@/lib/format';
import { ChartFrame } from '@/components/ui/ChartFrame';
import { DataTable } from '@/components/ui/DataTable';
import { LineChart } from '@/components/charts/LineChart';

const SERIES: SeriesName[] = ['AFI', 'TCT-AFI', 'ANC-AFI'];
const RANGES = [{ days: 14, label: '14 days' }, { days: 30, label: '30 days' }] as const;

export const IndexHistoryCard: React.FC<{ className?: string }> = ({ className }) => {
  const [days, setDays] = useState<14 | 30>(30);
  const history = useIndexHistory(SERIES);
  const family = useIndexFamily();

  const all = history.data?.data ?? [];
  const series = all.map((s) => ({
    key: s.series,
    label: s.series,
    color: SERIES_COLOR[s.series],
    points: s.points.slice(-days),
  }));
  const boundary = all[0]?.provenance_boundary ?? null;

  const rangeToggle = (
    <div className="flex rounded-full bg-surface-alt p-0.5 text-xs" role="group" aria-label="Date range">
      {RANGES.map((r) => (
        <button
          key={r.days}
          aria-pressed={days === r.days}
          onClick={() => setDays(r.days)}
          className={clsx('rounded-full px-3 py-1 font-medium', days === r.days ? 'bg-surface text-text-1 shadow-e1' : 'text-text-3')}
        >
          {r.label}
        </button>
      ))}
    </div>
  );

  return (
    <ChartFrame
      className={className}
      title="Index history"
      subtitle={`Base ${all[0]?.base_period ? shortDate(all[0].base_period) : ''} = 100 · one shared scale`}
      action={rangeToggle}
      status={history.status}
      error={history.error}
      onRetry={() => void history.refetch()}
      isEmpty={!series.length || !series[0].points.length}
      emptyReason="No published index days in this range."
      generatedAt={history.data?.meta.generated_at}
      quality={family.data?.data.members[0].quality}
      table={() => (
        <DataTable
          caption="Daily index values (base = 100)"
          rowKey={(r) => r.date}
          rows={series[0].points.map((p, i) => ({
            date: p.date,
            values: series.map((s) => s.points[i].value),
            provenance: all[0].points.slice(-days)[i].provenance,
          }))}
          initialSort={{ key: 'date', dir: 'desc' }}
          columns={[
            { key: 'date', header: 'Date', sortValue: (r) => r.date, render: (r) => shortDate(r.date) },
            ...series.map((s, i) => ({
              key: s.key, header: s.label, align: 'right' as const,
              sortValue: (r: { values: number[] }) => r.values[i],
              render: (r: { values: number[] }) => points(r.values[i], 2),
            })),
            { key: 'prov', header: 'Provenance', render: (r) => (r.provenance === 'REAL' ? 'Real' : 'Simulated') },
          ]}
        />
      )}
    >
      {() => (
        <LineChart
          series={series}
          provenanceBoundary={boundary}
          format={(v) => points(v)}
          ariaLabel={`AFI, TCT-AFI and ANC-AFI over the last ${days} days`}
        />
      )}
    </ChartFrame>
  );
};
