'use client';

import Link from 'next/link';
import { BookOpen, Download } from 'lucide-react';
import { hasRole, useAuth } from '@/lib/auth/AuthProvider';
import { useCoverage, useIndexFamily } from '@/lib/api/hooks';
import { downloadIndexCsv } from '@/lib/export';
import { longDate } from '@/lib/format';
import { PageHeader } from '@/components/ui/PageHeader';
import { QualityKpiCards } from '@/components/quality/QualityKpiCards';
import { QualityCoverageTrendCard } from '@/components/quality/QualityCoverageTrendCard';
import { QualityImputationCard } from '@/components/quality/QualityImputationCard';
import { QualityMissingReasonsCard } from '@/components/quality/QualityMissingReasonsCard';

export default function QualityPage() {
  const { role } = useAuth();
  const analyst = hasRole(role, 'ANALYST');

  const family = useIndexFamily();
  const date = family.data?.data.date;
  const provisional = family.data?.data.members[0].quality.is_provisional;

  const coverageQuery = useCoverage();
  const coverageDays = coverageQuery.data?.data ?? [];
  const latestDay = coverageDays[coverageDays.length - 1];

  return (
    <>
      <PageHeader
        title="Data quality"
        subtitle={
          date
            ? `Coverage, imputation and missing data, in the open · ${longDate(date)}${provisional ? ' · provisional' : ''}`
            : 'Coverage, imputation and missing data, in the open'
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
        <QualityKpiCards coverageDays={coverageDays} isPending={coverageQuery.isPending} />

        {/* 2. 30-Day Coverage Trend Card with 90% Threshold Line */}
        <QualityCoverageTrendCard
          coverageDays={coverageDays}
          status={coverageQuery.status}
          error={coverageQuery.error}
          onRetry={() => void coverageQuery.refetch()}
        />

        {/* 3. Imputation by Rule Breakdown Card */}
        <QualityImputationCard coverageDay={latestDay} />

        {/* 4. Missing Reasons and Flagged Outliers Audit Card */}
        <QualityMissingReasonsCard coverageDay={latestDay} />
      </div>
    </>
  );
}
