'use client';

import React from 'react';
import clsx from 'clsx';
import type { CoverageDay, MissingReason } from '@aerofarex/shared-types';
import { pct } from '@/lib/format';
import { DataTable } from '@/components/ui/DataTable';

const REASON_DESCRIPTIONS: Record<MissingReason, { label: string; desc: string; severity: 'LOW' | 'MED' | 'HIGH' }> = {
  BLOCKED: {
    label: 'Blocked / Rate Limited',
    desc: 'Aggregator OTA blocked or throttled collector IP.',
    severity: 'HIGH',
  },
  SOURCE_ERROR: {
    label: 'Source Fetch Error',
    desc: 'Airline API / browser automation timeout or error.',
    severity: 'HIGH',
  },
  MISSING_SOURCE: {
    label: 'Missing Source',
    desc: 'Source unavailable during scheduled fetch slot.',
    severity: 'MED',
  },
  PARSER_ERROR: {
    label: 'Parser Payload Error',
    desc: 'Unrecognized response payload format.',
    severity: 'MED',
  },
  SOLD_OUT: {
    label: 'Flight Sold Out',
    desc: 'No available seats remaining for flight.',
    severity: 'LOW',
  },
  NO_FLIGHT: {
    label: 'No Scheduled Flight',
    desc: 'No flight operated by carrier for advance window.',
    severity: 'LOW',
  },
  UNKNOWN: {
    label: 'Unknown Reason',
    desc: 'Unclassified missing observation.',
    severity: 'LOW',
  },
};

export const QualityMissingReasonsCard: React.FC<{
  coverageDay?: CoverageDay;
  className?: string;
}> = ({ coverageDay, className }) => {
  if (!coverageDay) return null;

  const reasons = Object.keys(REASON_DESCRIPTIONS) as MissingReason[];
  const total = coverageDay.expected || 1;

  const reasonStats = reasons.map((r) => {
    const count = coverageDay.missing_by_reason[r] || 0;
    return {
      reason: r,
      label: REASON_DESCRIPTIONS[r].label,
      desc: REASON_DESCRIPTIONS[r].desc,
      severity: REASON_DESCRIPTIONS[r].severity,
      count,
      rate: count / total,
    };
  });

  return (
    <section className={clsx('card flex flex-col p-5', className)} aria-label="Missing Reasons and Flagged Outliers">
      <header className="mb-4">
        <h2 className="text-[17px] leading-tight font-bold">Missing Reasons & Outlier Audit</h2>
        <p className="mt-1 text-xs text-text-3">
          Detailed taxonomy of missing observations, scraper blocking incidents, and flagged outliers.
        </p>
      </header>

      <DataTable
        caption="Audit breakdown of missing reasons and severity"
        rowKey={(r) => r.reason}
        rows={reasonStats}
        initialSort={{ key: 'count', dir: 'desc' }}
        columns={[
          {
            key: 'label',
            header: 'Missing Reason / Root Cause',
            sortValue: (r) => r.label,
            render: (r) => (
              <div>
                <span className="block font-bold text-text-1">{r.label}</span>
                <span className="block text-[11px] text-text-3">{r.desc}</span>
              </div>
            ),
          },
          {
            key: 'severity',
            header: 'Severity Tier',
            sortValue: (r) => r.severity,
            render: (r) => (
              <span
                className={clsx(
                  'rounded-full px-2.5 py-0.5 text-xs font-bold',
                  r.severity === 'HIGH'
                    ? 'bg-status-critical/20 text-status-critical'
                    : r.severity === 'MED'
                    ? 'bg-status-warning/20 text-status-warning'
                    : 'bg-surface-tint text-sky-900',
                )}
              >
                {r.severity}
              </span>
            ),
          },
          {
            key: 'count',
            header: 'Missing Count',
            align: 'right',
            sortValue: (r) => r.count,
            render: (r) => (
              <span className={clsx('num font-bold', r.count > 0 ? 'text-text-1' : 'text-text-3')}>
                {r.count}
              </span>
            ),
          },
          {
            key: 'rate',
            header: 'Impact Rate (%)',
            align: 'right',
            sortValue: (r) => r.rate,
            render: (r) => (
              <span className="num font-bold text-text-2">{pct(r.rate, 1)}</span>
            ),
          },
        ]}
      />
    </section>
  );
};
