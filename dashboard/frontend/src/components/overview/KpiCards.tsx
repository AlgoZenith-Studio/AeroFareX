'use client';

import React from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { ArrowUpRight, TrendingDown, TrendingUp } from 'lucide-react';
import type { IndexLatest, QualityMetadata } from '@aerofarex/shared-types';
import { useIndexFamily } from '@/lib/api/hooks';
import { points, signed } from '@/lib/format';
import { QualityBadge } from '@/components/ui/QualityBadge';
import { ErrorState, Skeleton } from '@/components/ui/States';
import { hasRole, useAuth } from '@/lib/auth/AuthProvider';

interface Kpi {
  title: string;
  value: string;
  change: string;
  direction: number;
  note: string;
  href: string;
  quality: QualityMetadata;
  hero?: boolean;
}

const KpiCard: React.FC<Kpi> = ({ title, value, change, direction, note, href, quality, hero }) => {
  const Trend = direction >= 0 ? TrendingUp : TrendingDown;
  return (
    <article className={clsx('flex min-h-[164px] flex-col p-[clamp(16px,1.4vw,20px)]', hero ? 'card-hero' : 'card')}>
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-[17px] leading-tight">{title}</h2>
        <Link
          href={href}
          aria-label={`Open ${title}`}
          className={clsx('icon-btn', hero ? 'border-black bg-black text-white hover:opacity-85' : 'text-text-1 hover:bg-surface-alt')}
        >
          <ArrowUpRight size={17} aria-hidden />
        </Link>
      </div>
      <p className="font-display num mt-3 text-[clamp(32px,2.8vw,44px)] leading-none">{value}</p>
      <p className={clsx('mt-3 flex items-center gap-1.5 text-xs', hero ? 'text-text-1' : 'text-text-2')}>
        <span className={clsx('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-bold', hero ? 'bg-white/60 text-black' : 'bg-surface-tint text-sky-900')}>
          <Trend size={12} aria-hidden />{change}
        </span>
        {note}
      </p>
      <QualityBadge quality={quality} onBand={hero} className="mt-auto pt-3" />
    </article>
  );
};

const fromLatest = (m: IndexLatest) => ({
  value: points(m.value),
  change: signed(m.change, 2),
  direction: m.change,
  quality: m.quality,
});

/** Hero row: AFI (highlighted), TCT-AFI, the drip-pricing gap at equal weight, ANC-AFI. */
export const KpiCards: React.FC = () => {
  const { role } = useAuth();
  const family = useIndexFamily();
  if (family.isPending) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" role="status" aria-label="Loading headline indices">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[172px] rounded-[22px]" />)}
      </div>
    );
  }
  if (family.isError) return <div className="card p-5"><ErrorState error={family.error} onRetry={() => void family.refetch()} /></div>;

  const { members, drip_gap_pct, drip_gap_points } = family.data.data;
  const [afi, tct, anc] = members;
  const kpis: Kpi[] = [
    { title: 'Air Fare Index', ...fromLatest(afi), note: 'pts vs yesterday · base fare', href: hasRole(role, 'ANALYST') ? '/attribution/' : '/routes/', hero: true },
    { title: 'Total cost index', ...fromLatest(tct), note: 'TCT-AFI · everything you pay', href: '/routes/' },
    {
      title: 'Hidden-fee gap',
      value: `${signed(drip_gap_pct, 1)}%`,
      change: `${points(drip_gap_points)} pts`,
      direction: drip_gap_pct,
      note: 'TCT-AFI above AFI',
      href: '/routes/',
      quality: tct.quality,
    },
    { title: 'Ancillary index', ...fromLatest(anc), note: 'ANC-AFI · seat, bag, meal', href: '/methodology/' },
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {kpis.map((k) => <KpiCard key={k.title} {...k} />)}
    </div>
  );
};
