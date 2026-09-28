'use client';

import Link from 'next/link';
import { ArrowLeft, Download } from 'lucide-react';
import { hasRole, useAuth } from '@/lib/auth/AuthProvider';
import { useIndexFamily } from '@/lib/api/hooks';
import { downloadIndexCsv } from '@/lib/export';
import { longDate } from '@/lib/format';
import { PageHeader } from '@/components/ui/PageHeader';
import { MethodologyKpiCards } from '@/components/methodology/MethodologyKpiCards';
import { PlainExplanationCard } from '@/components/methodology/PlainExplanationCard';
import { FormulasCard } from '@/components/methodology/FormulasCard';
import { VintageHistoryCard } from '@/components/methodology/VintageHistoryCard';

export default function MethodologyPage() {
  const { role } = useAuth();
  const analyst = hasRole(role, 'ANALYST');
  const family = useIndexFamily();
  const date = family.data?.data.date;

  return (
    <>
      <PageHeader
        title="Methodology"
        subtitle={
          date
            ? `How AeroFareX turns fares into an index · ${longDate(date)}`
            : 'How AeroFareX turns fares into an index'
        }
        actions={
          <>
            {analyst && (
              <button className="btn btn-primary" onClick={() => void downloadIndexCsv()}>
                <Download size={17} aria-hidden /> Export CSV
              </button>
            )}
            <Link href="/" className="btn btn-outline">
              <ArrowLeft size={17} aria-hidden /> Back to overview
            </Link>
          </>
        }
      />

      <div className="flex flex-col gap-5">
        {/* 1. Summary KPI Cards (4 Cards matching Overview page) */}
        <MethodologyKpiCards />

        {/* 2. Plain-language explanation breakdown */}
        <PlainExplanationCard />

        {/* 3. Formulations & Equations Card */}
        <FormulasCard />

        {/* 4. Methodology version and vintage history audit */}
        <VintageHistoryCard />
      </div>
    </>
  );
}
