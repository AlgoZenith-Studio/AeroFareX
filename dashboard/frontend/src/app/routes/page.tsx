'use client';

import Link from 'next/link';
import { BookOpen, Download } from 'lucide-react';
import { hasRole, useAuth } from '@/lib/auth/AuthProvider';
import { useRoutes, useIndexFamily } from '@/lib/api/hooks';
import { downloadIndexCsv } from '@/lib/export';
import { longDate } from '@/lib/format';
import { PageHeader } from '@/components/ui/PageHeader';
import { RoutesKpiCards } from '@/components/routes/RoutesKpiCards';
import { RoutesTableCard } from '@/components/routes/RoutesTableCard';

export default function RoutesPage() {
  const { role } = useAuth();
  const analyst = hasRole(role, 'ANALYST');

  const family = useIndexFamily();
  const date = family.data?.data.date;
  const provisional = family.data?.data.members[0].quality.is_provisional;

  const routesQuery = useRoutes();
  const routes = routesQuery.data?.data ?? [];

  return (
    <>
      <PageHeader
        title="Routes"
        subtitle={
          date
            ? `The five DGCA trunk routes, advertised against total fare · ${longDate(date)}${provisional ? ' · provisional' : ''}`
            : 'The five DGCA trunk routes, advertised against total fare'
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
        <RoutesKpiCards routes={routes} isPending={routesQuery.isPending} />

        {/* 2. Main Route Table Card (Passenger weights, fares, hidden extra, sparklines, links) */}
        <RoutesTableCard routes={routes} />
      </div>
    </>
  );
}
