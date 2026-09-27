'use client';

import React from 'react';
import { useQueries } from '@tanstack/react-query';
import type { RouteFareDay } from '@aerofarex/shared-types';
import { apiGet } from '@/lib/api/client';
import { useRoutes } from '@/lib/api/hooks';
import { inr, shortDate } from '@/lib/format';
import { ChartFrame } from '@/components/ui/ChartFrame';
import { DataTable } from '@/components/ui/DataTable';
import { PillBars } from '@/components/charts/PillBars';

const DAYS = 14;
const WEEKDAY = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/**
 * Hidden fees per ticket: everything paid above the base fare (fuel, airport
 * fees, GST, platform fee), passenger-weighted across the five routes.
 */
export const HiddenFeesCard: React.FC<{ className?: string }> = ({ className }) => {
  const routes = useRoutes();
  const list = routes.data?.data ?? [];
  const fares = useQueries({
    queries: list.map((r) => ({
      queryKey: [`routes/${r.route_id}/fares`, undefined],
      queryFn: () => apiGet<RouteFareDay[]>(`routes/${r.route_id}/fares`),
    })),
  });

  const pending = routes.isPending || fares.some((f) => f.isPending);
  const failed = routes.error ?? fares.find((f) => f.error)?.error;
  const ready = !pending && !failed && fares.length > 0;

  const days = ready
    ? fares[0].data!.data.slice(-DAYS).map((day, i, arr) => {
        const offset = fares[0].data!.data.length - arr.length + i;
        let weighted = 0;
        let weight = 0;
        fares.forEach((f, r) => {
          const c = f.data!.data[offset].components;
          weighted += list[r].pax_share * (c.total_payable_paise - c.base_fare_paise);
          weight += list[r].pax_share;
        });
        return { date: day.date, provenance: day.provenance, hidden: Math.round(weighted / weight) };
      })
    : [];

  return (
    <ChartFrame
      className={className}
      title="Hidden fees"
      subtitle="Per ticket, above the base fare · 14 days"
      status={failed ? 'error' : pending ? 'pending' : 'success'}
      error={failed}
      onRetry={() => { void routes.refetch(); fares.forEach((f) => void f.refetch()); }}
      isEmpty={ready && !days.length}
      emptyReason="No route fares for this period."
      generatedAt={routes.data?.meta.generated_at}
      footer={(
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-sky-500" aria-hidden />Real</span>
          <span className="flex items-center gap-1.5"><span className="hatch size-2.5 rounded-full border border-sky-600/40 text-sky-600" aria-hidden />Simulated</span>
        </span>
      )}
      table={() => (
        <DataTable
          caption="Weighted hidden fees per ticket, by day"
          rowKey={(r) => r.date}
          rows={days}
          initialSort={{ key: 'date', dir: 'desc' }}
          columns={[
            { key: 'date', header: 'Date', sortValue: (r) => r.date, render: (r) => shortDate(r.date) },
            { key: 'hidden', header: 'Hidden fees', align: 'right', sortValue: (r) => r.hidden, render: (r) => inr(r.hidden) },
            { key: 'prov', header: 'Provenance', render: (r) => (r.provenance === 'REAL' ? 'Real' : 'Simulated') },
          ]}
        />
      )}
    >
      {() => (
        <PillBars
          ariaLabel="Hidden fees per ticket over the last 14 days"
          format={(v) => inr(v)}
          bars={days.map((d) => ({
            key: d.date,
            label: WEEKDAY[new Date(`${d.date}T00:00:00Z`).getUTCDay()],
            title: `${shortDate(d.date)} · ${inr(d.hidden)}`,
            value: d.hidden,
            hatched: d.provenance === 'SIMULATED',
          }))}
        />
      )}
    </ChartFrame>
  );
};
