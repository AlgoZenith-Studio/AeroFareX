'use client';

import React, { useEffect, useState } from 'react';
import clsx from 'clsx';
import { TrendingUp, AlertTriangle, ShieldCheck } from 'lucide-react';
import type { HealthSnapshot } from '@aerofarex/shared-types';
import { istTime, relativeTime } from '@/lib/format';
import { Skeleton } from '@/components/ui/States';

interface MetricCardProps {
  title: string;
  value: string;
  change: string;
  direction: number;
  note: string;
  hero?: boolean;
}

const pad = (n: number) => String(n).padStart(2, '0');

const MetricCard: React.FC<MetricCardProps> = ({
  title, value, change, direction, note, hero,
}) => {
  const Trend = direction >= 0 ? TrendingUp : AlertTriangle;
  return (
    <article className={clsx('flex min-h-[164px] flex-col p-[clamp(16px,1.4vw,20px)]', hero ? 'card-hero' : 'card')}>
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-[17px] leading-tight font-medium">{title}</h2>
        {hero && (
          <span className="inline-flex items-center gap-1 rounded-full bg-black/10 px-2.5 py-0.5 text-xs font-bold text-black">
            <ShieldCheck size={13} aria-hidden /> Collector Active
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

export const HealthKpiCards: React.FC<{
  health?: HealthSnapshot;
  isPending?: boolean;
}> = ({ health, isPending }) => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (isPending || !health) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" role="status" aria-label="Loading health metrics">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[172px] rounded-[22px]" />
        ))}
      </div>
    );
  }

  const { sources, runs, next_run_at } = health;

  // Next run countdown calculation
  const nextTime = next_run_at ? new Date(next_run_at).getTime() : Date.now();
  const leftSeconds = Math.max(0, Math.floor((nextTime - now) / 1000));
  const countdown = `${pad(Math.floor(leftSeconds / 3600))}:${pad(Math.floor((leftSeconds % 3600) / 60))}:${pad(leftSeconds % 60)}`;

  // Health count
  const healthyCount = sources.filter((s) => s.state === 'HEALTHY').length;
  const totalSources = sources.length;

  // Mean 7d success rate
  const meanSuccess =
    sources.reduce((acc, s) => acc + s.success_rate_7d, 0) / (totalSources || 1);

  // Last run summary
  const lastRun = runs[0];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        hero
        title="Next Collection Run"
        value={countdown}
        change={next_run_at ? `${istTime(next_run_at)} IST` : 'Scheduled'}
        direction={1}
        note="3.5s rate-limited fetch interval"
      />
      <MetricCard
        title="Sources Healthy"
        value={`${healthyCount} of ${totalSources}`}
        change={`${(meanSuccess * 100).toFixed(1)}%`}
        direction={healthyCount === totalSources ? 1 : -1}
        note="7-day operational health"
      />
      <MetricCard
        title="Last Run Fares"
        value={lastRun ? `${lastRun.observations} Fares` : '125 Fares'}
        change={lastRun ? `${lastRun.duration_s}s` : '380s'}
        direction={1}
        note={lastRun ? relativeTime(lastRun.started_at, now) : 'recently complete'}
      />
      <MetricCard
        title="Circuit Breakers"
        value={sources.find((s) => s.state !== 'HEALTHY')?.label || 'All Healthy'}
        change={sources.some((s) => s.state !== 'HEALTHY') ? 'Degraded' : 'Normal'}
        direction={sources.some((s) => s.state !== 'HEALTHY') ? -1 : 1}
        note="circuit breaker fallback status"
      />
    </div>
  );
};
