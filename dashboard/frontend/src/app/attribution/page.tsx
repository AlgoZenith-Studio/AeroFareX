'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BookOpen, Download, Layers } from 'lucide-react';
import type { SeriesName } from '@aerofarex/shared-types';
import { hasRole, useAuth } from '@/lib/auth/AuthProvider';
import { useAttribution, useIndexFamily } from '@/lib/api/hooks';
import { downloadIndexCsv } from '@/lib/export';
import { longDate } from '@/lib/format';
import { PageHeader } from '@/components/ui/PageHeader';
import { AttributionKpiCards } from '@/components/attribution/AttributionKpiCards';
import { ReconciliationBanner } from '@/components/attribution/ReconciliationBanner';
import { WaterfallCard } from '@/components/attribution/WaterfallCard';
import { ContributionTableCard } from '@/components/attribution/ContributionTableCard';

export default function AttributionPage() {
  const { role } = useAuth();
  const analyst = hasRole(role, 'ANALYST');
  const [series, setSeries] = useState<SeriesName>('AFI');

  const family = useIndexFamily();
  const date = family.data?.data.date;
  const provisional = family.data?.data.members[0].quality.is_provisional;

  const attributionQuery = useAttribution(date, series);
  const attribution = attributionQuery.data?.data;

  return (
    <>
      <PageHeader
        title="Attribution"
        subtitle={
          date
            ? `Why the index moved, broken down so every part adds up · ${longDate(date)}${provisional ? ' · provisional' : ''}`
            : 'Why the index moved, broken down so every part adds up'
        }
        actions={
          <>
            {/* Series Switcher */}
            <div className="flex rounded-full bg-surface-alt p-0.5 text-xs font-bold" role="group" aria-label="Index Series">
              {(['AFI', 'TCT-AFI'] as const).map((s) => (
                <button
                  key={s}
                  aria-pressed={series === s}
                  onClick={() => setSeries(s)}
                  className={`rounded-full px-3.5 py-1.5 transition-colors ${
                    series === s ? 'bg-black text-white shadow-e1' : 'text-text-2 hover:text-text-1'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <Layers size={13} aria-hidden />
                    {s === 'AFI' ? 'AFI (Base Fare)' : 'TCT-AFI (Total Payable)'}
                  </span>
                </button>
              ))}
            </div>

            {analyst && (
              <button className="btn btn-primary" onClick={() => void downloadIndexCsv()}>
                <Download size={17} aria-hidden /> Export CSV
              </button>
            )}
            <Link href="/methodology/" className="btn btn-outline">
              <BookOpen size={17} aria-hidden /> Methodology
            </Link>
          </>
        }
      />

      <div className="flex flex-col gap-5">
        {/* 1. Hero KPI Grid (4 Cards matching Overview page) */}
        <AttributionKpiCards
          attribution={attribution}
          isPending={family.isPending || attributionQuery.isPending}
        />

        {/* 2. Reconciliation Audit Check Banner */}
        <ReconciliationBanner attribution={attribution} />

        {/* 3. Interactive Waterfall Chart Card */}
        <WaterfallCard
          attribution={attribution}
          series={series}
          status={attributionQuery.status}
          error={attributionQuery.error}
          onRetry={() => void attributionQuery.refetch()}
        />

        {/* 4. Granular Contribution Table Card */}
        <ContributionTableCard attribution={attribution} />
      </div>
    </>
  );
}
