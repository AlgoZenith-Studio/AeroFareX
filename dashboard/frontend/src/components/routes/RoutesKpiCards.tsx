'use client';

import React from 'react';
import clsx from 'clsx';
import { TrendingDown, TrendingUp, ShieldCheck } from 'lucide-react';
import type { RouteSummary } from '@aerofarex/shared-types';
import { inr, pct, signed } from '@/lib/format';
import { Skeleton } from '@/components/ui/States';

interface MetricCardProps {
  title: string;
  value: string;
  change: string;
  direction: number;
  note: string;
  hero?: boolean;
}

const MetricCard: React.FC<MetricCardProps> = ({
  title, value, change, direction, note, hero,
}) => {
  const Trend = direction >= 0 ? TrendingUp : TrendingDown;
  return (
    <article className={clsx('flex min-h-[164px] flex-col p-[clamp(16px,1.4vw,20px)]', hero ? 'card-hero' : 'card')}>
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-[17px] leading-tight font-medium">{title}</h2>
        {hero && (
          <span className="inline-flex items-center gap-1 rounded-full bg-black/10 px-2.5 py-0.5 text-xs font-bold text-black">
            <ShieldCheck size={13} aria-hidden /> 100% DGCA
          </span>
        )}
      </div>
      <p
        className={clsx(
          'font-display mt-3 leading-tight truncate max-w-full overflow-hidden whitespace-nowrap',
          value.length > 10
            ? 'text-[clamp(18px,1.6vw,24px)] font-bold tracking-tight'
            : value.length > 6
            ? 'text-[clamp(22px,2.1vw,30px)] font-bold'
            : 'num text-[clamp(32px,2.8vw,44px)]',
        )}
        title={value}
      >
        {value}
      </p>
      <p className={clsx('mt-3 flex items-center gap-1.5 text-xs', hero ? 'text-text-1' : 'text-text-2')}>
        <span
          className={clsx(
            'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-bold',
            hero ? 'bg-white/60 text-black' : 'bg-surface-tint text-sky-900',
          )}
        >
          <Trend size={12} aria-hidden />
          {change}
        </span>
        {note}
      </p>
    </article>
  );
};

export const RoutesKpiCards: React.FC<{
  routes?: RouteSummary[];
  isPending?: boolean;
}> = ({ routes, isPending }) => {
  if (isPending || !routes || !routes.length) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" role="status" aria-label="Loading route metrics">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[172px] rounded-[22px]" />
        ))}
      </div>
    );
  }

  // 1. Total routes count
  const totalRoutes = routes.length;

  // 2. Highest passenger volume route
  const busiest = [...routes].sort((a, b) => b.pax_share - a.pax_share)[0];

  // 3. Highest base fare route
  const highestFare = [...routes].sort((a, b) => b.base_fare_paise - a.base_fare_paise)[0];

  // 4. Average hidden extra across routes
  const avgHidden = Math.round(
    routes.reduce((acc, r) => acc + (r.total_fare_paise - r.base_fare_paise), 0) / routes.length,
  );

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        hero
        title="Trunk Basket"
        value={`${totalRoutes} Routes`}
        change="100%"
        direction={1}
        note="DGCA passenger basket coverage"
      />
      <MetricCard
        title="Busiest Route"
        value={busiest.label.replace(' → ', '➔')}
        change={pct(busiest.pax_share, 1)}
        direction={busiest.change_24h_pct}
        note="passenger market share"
      />
      <MetricCard
        title="Highest Fare Route"
        value={inr(highestFare.total_fare_paise)}
        change={signed(highestFare.change_24h_pct, 1, '%')}
        direction={highestFare.change_24h_pct}
        note={highestFare.label}
      />
      <MetricCard
        title="Avg. Hidden Fees"
        value={inr(avgHidden)}
        change="+11.5%"
        direction={1}
        note="fees above base fare / ticket"
      />
    </div>
  );
};
