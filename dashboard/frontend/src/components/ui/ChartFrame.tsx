'use client';

import React, { useState } from 'react';
import clsx from 'clsx';
import { Table2, LineChart } from 'lucide-react';
import type { QualityMetadata } from '@aerofarex/shared-types';
import { QualityBadge } from './QualityBadge';
import { EmptyState, ErrorState, LoadingBlock, PartialBand, StaleBand, isStale } from './States';

/**
 * Mandatory wrapper for every chart: title, QualityBadge, chart/table toggle,
 * footer, and the five states. The toggle is a real <button aria-pressed>.
 */
export const ChartFrame: React.FC<{
  title: string;
  subtitle?: string;
  quality?: QualityMetadata;
  generatedAt?: string;
  footer?: React.ReactNode;
  action?: React.ReactNode;
  status: 'pending' | 'error' | 'success';
  error?: unknown;
  onRetry?: () => void;
  isEmpty?: boolean;
  emptyReason?: string;
  table?: () => React.ReactNode;
  className?: string;
  children: () => React.ReactNode;
}> = ({
  title, subtitle, quality, generatedAt, footer, action, status, error, onRetry, isEmpty, emptyReason, table, className, children,
}) => {
  const [showTable, setShowTable] = useState(false);
  return (
    <section className={clsx('card flex flex-col p-5', className)} aria-label={title}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 basis-40">
          <h2 className="text-[17px] leading-tight">{title}</h2>
          {subtitle && <p className="mt-1 text-xs text-text-3">{subtitle}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {action}
          {table && status === 'success' && !isEmpty && (
            <button
              aria-pressed={showTable}
              onClick={() => setShowTable((v) => !v)}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line px-3 text-xs font-medium text-text-2 hover:bg-surface-alt"
            >
              {showTable ? <LineChart size={14} aria-hidden /> : <Table2 size={14} aria-hidden />}
              {showTable ? 'Chart' : 'Table'}
            </button>
          )}
        </div>
      </header>

      <div className="mt-4 flex min-h-0 flex-1 flex-col gap-3">
        {status === 'pending' && <LoadingBlock className="flex-1" label={`Loading ${title}`} />}
        {status === 'error' && <ErrorState error={error} onRetry={onRetry} />}
        {status === 'success' && isEmpty && <EmptyState reason={emptyReason ?? 'No data for this selection.'} />}
        {status === 'success' && !isEmpty && (
          <>
            {generatedAt && isStale(generatedAt) && <StaleBand generatedAt={generatedAt} />}
            {quality && quality.coverage < 0.9 && <PartialBand coverage={quality.coverage} />}
            {showTable && table ? table() : children()}
          </>
        )}
      </div>

      {status === 'success' && !isEmpty && (quality || footer) && (
        <footer className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
          {quality && <QualityBadge quality={quality} />}
          {footer && <span className="text-xs text-text-3">{footer}</span>}
        </footer>
      )}
    </section>
  );
};
