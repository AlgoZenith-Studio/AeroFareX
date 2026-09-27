'use client';

import Link from 'next/link';
import { BookOpen, Download } from 'lucide-react';
import { hasRole, useAuth } from '@/lib/auth/AuthProvider';
import { useIndexFamily } from '@/lib/api/hooks';
import { downloadIndexCsv } from '@/lib/export';
import { longDate } from '@/lib/format';
import { PageHeader } from '@/components/ui/PageHeader';
import { KpiCards } from '@/components/overview/KpiCards';
import { IndexHistoryCard } from '@/components/overview/IndexHistoryCard';
import { HiddenFeesCard } from '@/components/overview/HiddenFeesCard';
import { CoverageCard } from '@/components/overview/CoverageCard';
import {
  MovedTodayCard, NextRunCard, PublicationCard, RoutesListCard, SourcesCard,
} from '@/components/overview/SideCards';

export default function OverviewPage() {
  const { role } = useAuth();
  const analyst = hasRole(role, 'ANALYST');
  const family = useIndexFamily();
  const date = family.data?.data.date;
  const provisional = family.data?.data.members[0].quality.is_provisional;

  return (
    <>
      <PageHeader
        title="Overview"
        subtitle={date ? `India’s daily airfare index · ${longDate(date)}${provisional ? ' · provisional' : ''}` : 'India’s daily airfare index'}
        actions={(
          <>
            {analyst && (
              <button className="btn btn-primary" onClick={() => void downloadIndexCsv()}>
                <Download size={17} aria-hidden /> Export CSV
              </button>
            )}
            <Link href="/methodology/" className="btn btn-outline"><BookOpen size={17} aria-hidden /> Methodology</Link>
          </>
        )}
      />

      <div className="flex flex-col gap-4">
        <KpiCards />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <IndexHistoryCard className="md:col-span-2" />
          <PublicationCard />
          <RoutesListCard className="xl:row-span-2" />
          <HiddenFeesCard className="md:col-span-2 xl:col-span-1" />
          <CoverageCard />
          <NextRunCard />
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <SourcesCard className={analyst ? undefined : 'xl:col-span-2'} />
          {analyst && <MovedTodayCard />}
        </div>
      </div>
    </>
  );
}
