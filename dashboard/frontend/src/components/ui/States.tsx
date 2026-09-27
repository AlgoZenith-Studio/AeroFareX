'use client';

import React from 'react';
import clsx from 'clsx';
import { CloudOff, Inbox, RotateCw, TriangleAlert, Clock } from 'lucide-react';
import { ApiRequestError } from '@/lib/api/client';
import { relativeTime } from '@/lib/format';

/**
 * The five data states every data-bearing component implements:
 * Loading (skeleton), Empty (states why), Error (retry, no made-up values),
 * Partial (coverage < 90% band), Stale (data older than one publication cycle).
 */
export const Skeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div className={clsx('skeleton', className)} aria-hidden />
);

export const LoadingBlock: React.FC<{ className?: string; label?: string }> = ({ className, label = 'Loading' }) => (
  <div className={clsx('flex flex-col gap-3', className)} role="status" aria-live="polite">
    <span className="sr-only">{label}…</span>
    <Skeleton className="h-4 w-1/3" />
    <Skeleton className="flex-1 min-h-16" />
  </div>
);

export const ErrorState: React.FC<{ error: unknown; onRetry?: () => void; compact?: boolean }> = ({ error, onRetry, compact }) => {
  const e = error instanceof ApiRequestError ? error : null;
  return (
    <div className={clsx('flex flex-col items-start gap-2 text-sm', compact ? 'py-1' : 'py-6')} role="alert">
      <span className="inline-flex items-center gap-2 font-medium text-status-critical">
        <CloudOff size={16} aria-hidden /> Couldn’t load this data
      </span>
      <span className="text-text-2">{e ? `${e.body.message} (ref ${e.body.correlation_id})` : 'Something went wrong.'}</span>
      {onRetry && (
        <button onClick={onRetry} className="inline-flex items-center gap-1.5 font-medium text-sky-800 hover:underline">
          <RotateCw size={14} aria-hidden /> Try again
        </button>
      )}
    </div>
  );
};

export const EmptyState: React.FC<{ reason: string }> = ({ reason }) => (
  <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-text-2">
    <Inbox size={22} className="text-text-3" aria-hidden />
    {reason}
  </div>
);

export const PartialBand: React.FC<{ coverage: number }> = ({ coverage }) => (
  <p className="flex items-center gap-2 rounded-xl bg-status-serious/15 px-3 py-2 text-xs text-text-1" role="note">
    <TriangleAlert size={14} className="text-status-serious" aria-hidden />
    Partial data: coverage is {(coverage * 100).toFixed(1)}%, below the 90% publication threshold. Treat with care.
  </p>
);

const STALE_AFTER_MS = 26 * 3600_000;
export const isStale = (generatedAt: string) => Date.now() - new Date(generatedAt).getTime() > STALE_AFTER_MS;

export const StaleBand: React.FC<{ generatedAt: string }> = ({ generatedAt }) => (
  <p className="flex items-center gap-2 rounded-xl bg-status-warning/20 px-3 py-2 text-xs text-text-1" role="note">
    <Clock size={14} aria-hidden />
    Stale: this data was generated {relativeTime(generatedAt)}, longer ago than one publication cycle.
  </p>
);
