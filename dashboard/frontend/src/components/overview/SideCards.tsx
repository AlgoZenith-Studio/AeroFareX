'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { ArrowRight, CalendarCheck, Plane, Radar } from 'lucide-react';
import { hasRole, useAuth } from '@/lib/auth/AuthProvider';
import { useAttribution, useHealth, useIndexFamily, useRoutes } from '@/lib/api/hooks';
import { SOURCE_COLOR } from '@/lib/entities';
import { inr, istTime, longDate, pct, relativeTime, signed } from '@/lib/format';
import { ChartFrame } from '@/components/ui/ChartFrame';
import { ErrorState, Skeleton } from '@/components/ui/States';
import { StatusPill } from '@/components/ui/StatusPill';
import { ContributionBars } from '@/components/charts/ContributionBars';

const CardTitle: React.FC<{ children: React.ReactNode; action?: React.ReactNode }> = ({ children, action }) => (
  <div className="flex items-center justify-between gap-3">
    <h2 className="text-[17px] leading-tight">{children}</h2>
    {action}
  </div>
);

const PillLink: React.FC<{ href: string; children: React.ReactNode }> = ({ href, children }) => (
  <Link href={href} className="inline-flex h-8 items-center gap-1 rounded-full border border-line-control bg-surface px-3 text-xs font-bold text-text-1 hover:border-black">
    {children}
  </Link>
);

// ------------------------------------------------------------ publication ("Reminders" slot)
export const PublicationCard: React.FC<{ className?: string }> = ({ className }) => {
  const { role } = useAuth();
  const family = useIndexFamily();
  const health = useHealth();
  const date = family.data?.data.date;
  const provisional = family.data?.data.members[0].quality.is_provisional;
  const publishAt = health.data?.data.next_publication_at;

  return (
    <section className={clsx('card flex flex-col p-5', className)} aria-label="Today’s publication">
      <CardTitle>Today’s publication</CardTitle>
      {family.isPending || health.isPending ? (
        <div className="mt-4 flex flex-col gap-2"><Skeleton className="h-7 w-3/4" /><Skeleton className="h-4 w-1/2" /></div>
      ) : family.isError ? (
        <ErrorState error={family.error} onRetry={() => void family.refetch()} compact />
      ) : (
        <>
          <p className="font-display mt-4 text-[clamp(18px,1.4vw,21px)] leading-snug">
            {provisional ? 'Provisional index' : 'Final index'} for {date && longDate(date)}
          </p>
          <p className="mt-2 flex items-center gap-1.5 text-sm text-text-2">
            <CalendarCheck size={15} aria-hidden />
            {provisional && publishAt ? `Publishes at ${istTime(publishAt)} IST` : 'Published'}
          </p>
          <dl className="mt-4 mb-5 grid grid-cols-2 gap-2 text-xs">
            {[
              ['Coverage', pct(family.data.data.members[0].quality.coverage)],
              ['Sources healthy', health.data ? `${health.data.data.sources.filter((x) => x.state === 'HEALTHY').length} of ${health.data.data.sources.length}` : '–'],
              ['Vintage', String(family.data.data.members[0].quality.vintage)],
              ['Methodology', family.data.data.members[0].quality.methodology_version],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl bg-surface-alt px-3 py-2">
                <dt className="text-text-3">{k}</dt>
                <dd className="num font-bold mt-0.5 text-[15px] text-text-1">{v}</dd>
              </div>
            ))}
          </dl>
          <Link
            href={hasRole(role, 'ANALYST') ? '/attribution/' : '/routes/'}
            className="btn btn-primary mt-auto justify-center self-stretch"
          >
            {hasRole(role, 'ANALYST') ? 'See what moved today' : 'Explore routes'} <ArrowRight size={17} aria-hidden />
          </Link>
        </>
      )}
    </section>
  );
};

// ------------------------------------------------------------ routes ("Project" list slot)
export const RoutesListCard: React.FC<{ className?: string }> = ({ className }) => {
  const routes = useRoutes();
  return (
    <section className={clsx('card flex flex-col p-5', className)} aria-label="Routes">
      <CardTitle action={<PillLink href="/routes/">View all</PillLink>}>Routes</CardTitle>
      {routes.isPending ? (
        <div className="mt-4 flex flex-col gap-3">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-11" />)}</div>
      ) : routes.isError ? (
        <ErrorState error={routes.error} onRetry={() => void routes.refetch()} compact />
      ) : (
        <ul className="mt-3 flex flex-col">
          {routes.data.data.map((r) => (
            <li key={r.route_id}>
              <Link href={`/routes/${r.route_id}/`} className="flex items-center gap-3 rounded-xl px-1 py-2.5 hover:bg-surface-alt">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-sky-200 text-sky-900" aria-hidden>
                  <Plane size={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{r.origin} → {r.destination}</span>
                  <span className="block truncate text-xs text-text-3">
                    <span className="num font-bold">{inr(r.total_fare_paise)}</span> · <span className="num font-bold">{pct(r.pax_share)}</span> weight
                  </span>
                </span>
                <span className="num text-xs font-medium text-text-2">{signed(r.change_24h_pct, 1, '%')}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-auto border-t border-line pt-3 text-xs text-text-3">
        Weights are each route’s share of passengers across the five-route basket (DGCA).
      </p>
    </section>
  );
};

// ------------------------------------------------------------ next run ("Time tracker" slot)
const pad = (n: number) => String(n).padStart(2, '0');
const SLOTS = ['02:30', '05:30', '13:00', '19:00'] as const;
/** Calendar date in India for a UTC timestamp (slots are scheduled in IST). */
const istDate = (iso: string) => new Date(new Date(iso).getTime() + 330 * 60_000).toISOString().slice(0, 10);

export const NextRunCard: React.FC<{ className?: string }> = ({ className }) => {
  const health = useHealth();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const next = health.data?.data.next_run_at;
  const left = next ? Math.max(0, Math.floor((new Date(next).getTime() - now) / 1000)) : 0;
  const lastRun = health.data?.data.runs[0];

  return (
    <section className={clsx('card-sky flex flex-col p-5', className)} aria-label="Next collection run">
      <div className="flex items-center justify-between">
        <h2 className="text-[17px] leading-tight">Next collection run</h2>
        <Radar size={18} className="text-sky-800" aria-hidden />
      </div>
      {health.isPending ? (
        <Skeleton className="mt-6 h-12 w-3/4" />
      ) : health.isError ? (
        <p className="mt-6 text-sm text-text-2">Schedule unavailable.</p>
      ) : (
        <>
          <p className="num font-bold mt-5 text-center text-[clamp(32px,2.6vw,42px)] leading-none" aria-live="off">
            {pad(Math.floor(left / 3600))}:{pad(Math.floor((left % 3600) / 60))}:{pad(left % 60)}
          </p>
          <p className="mt-2 text-center text-xs text-text-2">
            {next && `${istTime(next)} IST slot`} · all 5 sources · 3.5 s spacing
          </p>
          <ol className="mt-6 grid grid-cols-4 gap-2" aria-label="Today’s collection slots">
            {SLOTS.map((slot) => {
              const today = lastRun && istDate(lastRun.started_at);
              const done = health.data.data.runs.find((r) => r.slot === slot && istDate(r.started_at) === today);
              return (
                <li key={slot} className="flex flex-col items-center gap-1.5 text-[11px]">
                  <span
                    className={clsx(
                      'h-1.5 w-full rounded-full',
                      done ? (done.status === 'SUCCESS' ? 'bg-sky-500' : 'bg-status-warning') : 'bg-white/70',
                    )}
                    aria-hidden
                  />
                  <span className={clsx('num font-bold', done ? 'text-text-1' : 'text-text-3')}>{slot}</span>
                  <span className="sr-only">{done ? done.status.toLowerCase() : 'scheduled'}</span>
                </li>
              );
            })}
          </ol>
          {lastRun && (
            <p className="mt-auto pt-4 text-center text-xs text-text-2">
              Last run {relativeTime(lastRun.started_at, now)} ·{' '}
              <span className="font-bold text-text-1">
                {lastRun.status === 'SUCCESS' ? 'complete' : lastRun.status.toLowerCase()}
              </span>{' '}
              · <span className="num font-bold">{lastRun.observations}</span> fares
            </p>
          )}
        </>
      )}
    </section>
  );
};

// ------------------------------------------------------------ sources ("Team" slot)
export const SourcesCard: React.FC<{ className?: string }> = ({ className }) => {
  const { role } = useAuth();
  const health = useHealth();
  return (
    <section className={clsx('card flex flex-col p-5', className)} aria-label="Data sources">
      <CardTitle action={hasRole(role, 'ANALYST') ? <PillLink href="/health/">Source health</PillLink> : undefined}>
        Data sources
      </CardTitle>
      {health.isPending ? (
        <div className="mt-4 flex flex-col gap-3">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-10" />)}</div>
      ) : health.isError ? (
        <ErrorState error={health.error} onRetry={() => void health.refetch()} compact />
      ) : (
        <ul className="mt-3 flex flex-col">
          {health.data.data.sources.map((s) => (
            <li key={s.source} className="flex items-center gap-3 py-2.5">
              <span
                className="grid size-9 shrink-0 place-items-center rounded-full text-xs font-bold text-white"
                style={{ background: SOURCE_COLOR[s.source] }}
                aria-hidden
              >
                {s.label.split(/\s+/).map((w) => w[0]).join('').slice(0, 2)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{s.label}</span>
                <span className="block truncate text-xs text-text-3">
                  {s.type === 'OTA' ? 'Aggregator' : 'Airline'} · {s.fetch_tier.toLowerCase()} fetch ·{' '}
                  {s.last_success_at ? `last success ${relativeTime(s.last_success_at)}` : 'no success yet'}
                </span>
              </span>
              <StatusPill state={s.state} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

// ------------------------------------------------------------ what moved (ANALYST+)
export const MovedTodayCard: React.FC<{ className?: string }> = ({ className }) => {
  const family = useIndexFamily();
  const date = family.data?.data.date;
  const attribution = useAttribution(date, 'AFI');
  const a = attribution.data?.data;
  const items = a ? [...a.axes.route].sort((x, y) => Math.abs(y.contribution) - Math.abs(x.contribution)) : [];

  return (
    <ChartFrame
      className={className}
      title="What moved the AFI today"
      subtitle={a ? `${signed(a.delta, 2)} pts by route · ${a.reconciled ? 'reconciled ✓' : 'NOT reconciled'}` : 'Contribution by route'}
      action={<PillLink href="/attribution/">Full attribution</PillLink>}
      status={attribution.status === 'pending' || family.isPending ? 'pending' : attribution.status}
      error={attribution.error}
      onRetry={() => void attribution.refetch()}
      isEmpty={!items.length}
      emptyReason="No previous day to compare against."
      quality={a?.quality}
      generatedAt={attribution.data?.meta.generated_at}
    >
      {() => <ContributionBars items={items} ariaLabel="AFI change by route, in index points" />}
    </ChartFrame>
  );
};
