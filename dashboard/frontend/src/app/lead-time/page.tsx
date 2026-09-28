'use client';

import Link from 'next/link';
import { BookOpen, Download } from 'lucide-react';
import { hasRole, useAuth } from '@/lib/auth/AuthProvider';
import { useLeadTime, useIndexFamily } from '@/lib/api/hooks';
import { downloadIndexCsv } from '@/lib/export';
import { longDate } from '@/lib/format';
import { PageHeader } from '@/components/ui/PageHeader';
import { LeadTimeKpiCards } from '@/components/lead-time/LeadTimeKpiCards';
import { LeadTimeHeatmapCard } from '@/components/lead-time/LeadTimeHeatmapCard';
import { LeadTimeFareCurveCard } from '@/components/lead-time/LeadTimeFareCurveCard';
import { BookingWeightsCard } from '@/components/lead-time/BookingWeightsCard';

export default function LeadTimePage() {
  const { role } = useAuth();
  const analyst = hasRole(role, 'ANALYST');

  const family = useIndexFamily();
  const date = family.data?.data.date;
  const provisional = family.data?.data.members[0].quality.is_provisional;

  const leadTimeQuery = useLeadTime(date);
  const matrix = leadTimeQuery.data?.data;

  return (
    <>
      <PageHeader
        title="Lead time"
        subtitle={
          date
            ? `How fares change with how early you book · ${longDate(date)}${provisional ? ' · provisional' : ''}`
            : 'How fares change with how early you book'
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
        <LeadTimeKpiCards matrix={matrix} isPending={leadTimeQuery.isPending} />

        {/* 2. Route × Booking-Window Heatmap Card (Missing cells hatched) */}
        <LeadTimeHeatmapCard
          matrix={matrix}
          status={leadTimeQuery.status}
          error={leadTimeQuery.error}
          onRetry={() => void leadTimeQuery.refetch()}
        />

        {/* 3. Fare Curve by Days Before Departure Card */}
        <LeadTimeFareCurveCard
          matrix={matrix}
          status={leadTimeQuery.status}
          error={leadTimeQuery.error}
          onRetry={() => void leadTimeQuery.refetch()}
        />

        {/* 4. Booking-Curve Weights Breakdown Card */}
        <BookingWeightsCard matrix={matrix} />
      </div>
    </>
  );
}
