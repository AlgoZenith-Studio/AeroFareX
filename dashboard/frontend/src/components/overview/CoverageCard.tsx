'use client';

import React from 'react';
import { useCoverage, useIndexFamily } from '@/lib/api/hooks';
import { pct } from '@/lib/format';
import { ChartFrame } from '@/components/ui/ChartFrame';
import { CoverageGauge } from '@/components/charts/CoverageGauge';

/** Today's expected observations as observed / imputed / excluded (flagged, kept). */
export const CoverageCard: React.FC<{ className?: string }> = ({ className }) => {
  const family = useIndexFamily();
  const date = family.data?.data.date;
  const coverage = useCoverage(date, date);
  const day = coverage.data?.data[0];
  const imputed = day ? day.by_rule.CROSS_SOURCE + day.by_rule.CELL_MEAN + day.by_rule.CARRY_FORWARD : 0;

  return (
    <ChartFrame
      className={className}
      title="Data coverage"
      subtitle="Today’s scheduled fare checks"
      status={coverage.status === 'pending' || family.isPending ? 'pending' : coverage.status}
      error={coverage.error}
      onRetry={() => void coverage.refetch()}
      isEmpty={!day}
      emptyReason="No collection runs for this day yet."
      generatedAt={coverage.data?.meta.generated_at}
    >
      {() => day && (
        <CoverageGauge
          centerValue={pct(day.coverage)}
          centerLabel={`of ${day.expected} checks usable`}
          parts={[
            { key: 'observed', label: 'Observed', value: day.observed, tone: 'solid' },
            { key: 'imputed', label: 'Imputed', value: imputed, tone: 'mid' },
            { key: 'excluded', label: 'Excluded', value: day.by_rule.EXCLUDED, tone: 'hatched' },
          ]}
        />
      )}
    </ChartFrame>
  );
};
