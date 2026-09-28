'use client';

import { use } from 'react';
import Link from 'next/link';
import { BookOpen, Download } from 'lucide-react';
import { hasRole, useAuth } from '@/lib/auth/AuthProvider';
import { useRouteFares, useRoutes, useObservations } from '@/lib/api/hooks';
import { downloadIndexCsv } from '@/lib/export';
import { PageHeader } from '@/components/ui/PageHeader';
import { RouteDetailHeader } from '@/components/routes/RouteDetailHeader';
import { RouteFareHistoryCard } from '@/components/routes/RouteFareHistoryCard';
import { RouteCarrierComparisonCard } from '@/components/routes/RouteCarrierComparisonCard';
import { RouteObservationsCard } from '@/components/routes/RouteObservationsCard';

export default function RouteDetailPage({ params }: { params: Promise<{ routeId: string }> }) {
  const { routeId } = use(params);
  const { role } = useAuth();
  const analyst = hasRole(role, 'ANALYST');

  const routesQuery = useRoutes();
  const route = routesQuery.data?.data.find((r) => r.route_id === routeId);

  const faresQuery = useRouteFares(routeId);
  const fares = faresQuery.data?.data ?? [];

  const obsQuery = useObservations(undefined, routeId);
  const observations = obsQuery.data?.data ?? [];

  return (
    <>
      <PageHeader
        title={`Route ${routeId}`}
        subtitle={`Advertised base fare vs total payable fare for ${route?.label ?? routeId}`}
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

      {/* 1. Header Summary Card */}
      <RouteDetailHeader route={route} />

      <div className="flex flex-col gap-5">
        {/* 2. Base vs Total Fare 30-Day History Chart Card */}
        <RouteFareHistoryCard
          fares={fares}
          status={faresQuery.status}
          error={faresQuery.error}
          onRetry={() => void faresQuery.refetch()}
        />

        {/* 3. Airline / Carrier Pricing & Availability Comparison */}
        <RouteCarrierComparisonCard observations={observations} />

        {/* 4. Raw Observations & Audit Drawer (Analyst+) */}
        {analyst && <RouteObservationsCard observations={observations} />}
      </div>
    </>
  );
}
