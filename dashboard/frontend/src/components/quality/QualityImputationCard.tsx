'use client';

import React from 'react';
import clsx from 'clsx';
import type { CoverageDay, ImputationRule } from '@aerofarex/shared-types';
import { pct } from '@/lib/format';
import { PillBars } from '@/components/charts/PillBars';
import { DataTable } from '@/components/ui/DataTable';

const RULE_DESCRIPTIONS: Record<ImputationRule, { label: string; desc: string }> = {
  CROSS_SOURCE: {
    label: 'Cross-Source Mean',
    desc: 'Imputed using valid observations from other sources for the same route and window.',
  },
  CELL_MEAN: {
    label: 'Cell Mean Imputation',
    desc: 'Imputed using historical cell mean values across adjacent time slots.',
  },
  CARRY_FORWARD: {
    label: 'Previous Day Carry-Forward',
    desc: 'Imputed by carrying forward previous day published cell value when all sources are missing.',
  },
  EXCLUDED: {
    label: 'Excluded (Outlier Flagged)',
    desc: 'Excluded from index aggregation due to statistical outlier validation flag.',
  },
};

export const QualityImputationCard: React.FC<{
  coverageDay?: CoverageDay;
  className?: string;
}> = ({ coverageDay, className }) => {
  if (!coverageDay) return null;

  const rules: ImputationRule[] = ['CROSS_SOURCE', 'CELL_MEAN', 'CARRY_FORWARD', 'EXCLUDED'];
  const total = coverageDay.expected || 1;

  const ruleStats = rules.map((r) => {
    const count = coverageDay.by_rule[r] || 0;
    return {
      rule: r,
      label: RULE_DESCRIPTIONS[r].label,
      desc: RULE_DESCRIPTIONS[r].desc,
      count,
      rate: count / total,
    };
  });

  return (
    <section className={clsx('card flex flex-col p-5', className)} aria-label="Imputation by Rule">
      <header className="mb-4">
        <h2 className="text-[17px] leading-tight font-bold">Imputation by Rule</h2>
        <p className="mt-1 text-xs text-text-3">
          Breakdown of deterministic mathematical fallback rules triggered for missing observations.
        </p>
      </header>

      <div className="mb-6">
        <PillBars
          ariaLabel="Imputation rules distribution"
          format={(v) => `${v.toFixed(0)} checks`}
          bars={ruleStats.map((r) => ({
            key: r.rule,
            label: r.label,
            title: `${r.label} · ${r.count} checks (${pct(r.rate, 1)})`,
            value: r.count,
            hatched: r.rule === 'CARRY_FORWARD',
          }))}
        />
      </div>

      <DataTable
        caption="Imputation rule breakdown and descriptions"
        rowKey={(r) => r.rule}
        rows={ruleStats}
        columns={[
          {
            key: 'label',
            header: 'Imputation Rule',
            render: (r) => (
              <div>
                <span className="block font-bold text-text-1">{r.label}</span>
                <span className="block text-[11px] text-text-3">{r.desc}</span>
              </div>
            ),
          },
          {
            key: 'count',
            header: 'Checks Count',
            align: 'right',
            sortValue: (r) => r.count,
            render: (r) => <span className="num font-bold text-text-1">{r.count}</span>,
          },
          {
            key: 'rate',
            header: 'Share of Expected (%)',
            align: 'right',
            sortValue: (r) => r.rate,
            render: (r) => (
              <div className="flex items-center justify-end gap-2">
                <div className="w-16 bg-surface-alt h-1.5 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-sky-600"
                    style={{ width: `${Math.min(100, r.rate * 100 * 5)}%` }}
                  />
                </div>
                <span className="num font-bold text-xs text-text-2">{pct(r.rate, 1)}</span>
              </div>
            ),
          },
        ]}
      />
    </section>
  );
};
