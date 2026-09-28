'use client';

import React, { useState } from 'react';
import clsx from 'clsx';
import { AlertTriangle, ShieldCheck, ChevronDown, ChevronUp } from 'lucide-react';
import type { Attribution } from '@aerofarex/shared-types';
import { signed, points } from '@/lib/format';

export const ReconciliationBanner: React.FC<{
  attribution?: Attribution;
}> = ({ attribution }) => {
  const [expanded, setExpanded] = useState(false);

  if (!attribution) return null;

  const { delta, reconciled, axes, quality } = attribution;

  // Calculate sum per axis to verify exact mathematical equality
  const axisSums = Object.entries(axes).map(([axis, items]) => {
    const sum = items.reduce((acc, item) => acc + item.contribution, 0);
    const diff = Math.abs(sum - delta);
    return {
      axis: axis.toUpperCase(),
      sum,
      diff,
      passed: diff < 1e-4,
    };
  });

  const allPassed = reconciled && axisSums.every((a) => a.passed);

  return (
    <div className={clsx('card p-5 transition-all', allPassed ? 'bg-surface' : 'bg-status-warning/10 border-status-warning/40')}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div
            className={clsx(
              'grid size-10 shrink-0 place-items-center rounded-2xl text-white font-bold',
              allPassed ? 'bg-sky-500 text-sky-950' : 'bg-status-warning text-black',
            )}
            aria-hidden
          >
            {allPassed ? <ShieldCheck size={20} /> : <AlertTriangle size={20} />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-[16px] leading-tight font-bold">
                {allPassed ? 'Reconciliation Audit Passed' : 'Reconciliation Discrepancy Warning'}
              </h3>
              <span
                className={clsx(
                  'rounded-full px-2.5 py-0.5 text-xs font-bold',
                  allPassed ? 'bg-surface-tint text-sky-900' : 'bg-status-warning/30 text-status-warning',
                )}
              >
                {allPassed ? '✓ 100% Additive' : '⚠️ Residual Detected'}
              </span>
            </div>
            <p className="mt-1 text-xs text-text-2">
              {allPassed
                ? `All 5 decomposition axes (Route, Airline, Window, Component, Driver) sum exactly to the Net Index Delta (${signed(delta, 2)} pts). No residual error.`
                : `Parts do not add up cleanly to the published index delta (${signed(delta, 2)} pts). Audit verification warning.`}
            </p>
          </div>
        </div>

        <button
          onClick={() => setExpanded((v) => !v)}
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line-control bg-surface px-3 text-xs font-bold text-text-1 hover:border-black"
        >
          {expanded ? 'Hide Audit Detail' : 'Inspect Audit Detail'}
          {expanded ? <ChevronUp size={14} aria-hidden /> : <ChevronDown size={14} aria-hidden />}
        </button>
      </div>

      {expanded && (
        <div className="mt-4 border-t border-line pt-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5 text-xs">
            {axisSums.map((a) => (
              <div key={a.axis} className="rounded-xl bg-surface-alt p-3">
                <div className="flex items-center justify-between text-text-3 font-semibold mb-1">
                  <span>{a.axis} AXIS</span>
                  <span>{a.passed ? '✓' : '⚠️'}</span>
                </div>
                <div className="text-sm font-bold text-text-1">
                  Sum: <span className="num font-bold">{signed(a.sum, 2)}</span> pts
                </div>
                <div className="text-[11px] text-text-3 mt-1">
                  Delta: <span className="num font-bold">{signed(delta, 2)}</span> · Gap: <span className="num font-bold">{points(a.diff, 4)}</span> pts
                </div>
              </div>
            ))}
          </div>

          <p className="mt-3 text-[11px] text-text-3">
            Methodology Version: <strong className="text-text-1">{quality.methodology_version}</strong> ·
            Imputation Rate: <strong className="text-text-1">{(quality.imputation_rate * 100).toFixed(1)}%</strong> ·
            Quality Status: <strong className="text-text-1">{quality.quality_status}</strong>
          </p>
        </div>
      )}
    </div>
  );
};
