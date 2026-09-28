'use client';

import Link from 'next/link';
import { BookOpen, Download } from 'lucide-react';
import { hasRole, useAuth } from '@/lib/auth/AuthProvider';
import { useHealth, useIndexFamily } from '@/lib/api/hooks';
import { downloadIndexCsv } from '@/lib/export';
import { longDate } from '@/lib/format';
import { PageHeader } from '@/components/ui/PageHeader';
import { HealthKpiCards } from '@/components/health/HealthKpiCards';
import { SourceCircuitStateCard } from '@/components/health/SourceCircuitStateCard';
import { CollectionRunsLogCard } from '@/components/health/CollectionRunsLogCard';
import { RecentFailuresCard } from '@/components/health/RecentFailuresCard';

export default function HealthPage() {
  const { role } = useAuth();
  const analyst = hasRole(role, 'ANALYST');

  const family = useIndexFamily();
  const date = family.data?.data.date;
  const provisional = family.data?.data.members[0].quality.is_provisional;

  const healthQuery = useHealth();
  const health = healthQuery.data?.data;

  return (
    <>
      <PageHeader
        title="Source health"
        subtitle={
          date
            ? `Is the collector working right now? · ${longDate(date)}${provisional ? ' · provisional' : ''}`
            : 'Is the collector working right now?'
        }
        actions={
          <>
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
        {/* 1. Summary KPI Cards (4 Cards matching Overview page) */}
        <HealthKpiCards health={health} isPending={healthQuery.isPending} />

        {/* 2. Live Circuit State Per Source Card */}
        <SourceCircuitStateCard sources={health?.sources} />

        {/* 3. Collection Slot Run Log Card */}
        <CollectionRunsLogCard runs={health?.runs} />

        {/* 4. Recent Failures and Incident Log Card */}
        <RecentFailuresCard sources={health?.sources} />
      </div>
    </>
  );
}
