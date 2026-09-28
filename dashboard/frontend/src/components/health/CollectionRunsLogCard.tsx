'use client';

import React, { useState } from 'react';
import clsx from 'clsx';
import { Copy, Check, Radar } from 'lucide-react';
import type { CollectionRun } from '@aerofarex/shared-types';
import { istTime, relativeTime } from '@/lib/format';
import { DataTable } from '@/components/ui/DataTable';

const IST_SLOTS = ['02:30', '05:30', '13:00', '19:00'] as const;

export const CollectionRunsLogCard: React.FC<{
  runs?: CollectionRun[];
  className?: string;
}> = ({ runs = [], className }) => {
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const handleCopy = (hash: string) => {
    void navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  return (
    <section className={clsx('card flex flex-col p-5', className)} aria-label="Run Log for Each Collection Slot">
      <header className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-[17px] leading-tight font-bold">Collection Slot Run Log</h2>
          <p className="mt-1 text-xs text-text-3">
            Scheduled IST slot execution logs, observation counts, duration, and Merkle batch hashes.
          </p>
        </div>

        {/* Slot pills */}
        <div className="flex items-center gap-2">
          {IST_SLOTS.map((slot) => {
            const hasRun = runs.find((r) => r.slot === slot);
            return (
              <span
                key={slot}
                className={clsx(
                  'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold',
                  hasRun
                    ? hasRun.status === 'SUCCESS'
                      ? 'bg-surface-tint text-sky-900'
                      : 'bg-status-warning/20 text-status-warning'
                    : 'bg-surface-alt text-text-3',
                )}
              >
                <Radar size={11} aria-hidden /> {slot} IST
              </span>
            );
          })}
        </div>
      </header>

      <DataTable
        caption="Recent collection run executions and cryptographic batch hashes"
        rowKey={(r) => r.run_id}
        rows={runs}
        initialSort={{ key: 'started_at', dir: 'desc' }}
        columns={[
          {
            key: 'run_id',
            header: 'Run ID & Slot',
            sortValue: (r) => r.run_id,
            render: (r) => (
              <div>
                <span className="block font-bold text-text-1">{r.run_id}</span>
                <span className="block text-[11px] text-text-3">
                  {r.slot} IST slot · {relativeTime(r.started_at)}
                </span>
              </div>
            ),
          },
          {
            key: 'started_at',
            header: 'Started At (IST)',
            sortValue: (r) => r.started_at,
            render: (r) => istTime(r.started_at),
          },
          {
            key: 'duration_s',
            header: 'Duration',
            align: 'right',
            sortValue: (r) => r.duration_s,
            render: (r) => `${r.duration_s}s (${(r.duration_s / 60).toFixed(1)}m)`,
          },
          {
            key: 'observations',
            header: 'Fares Sampled',
            align: 'right',
            sortValue: (r) => r.observations,
            render: (r) => <span className="num font-bold text-text-1">{r.observations}</span>,
          },
          {
            key: 'status',
            header: 'Execution Status',
            sortValue: (r) => r.status,
            render: (r) => (
              <span
                className={clsx(
                  'rounded-full px-2.5 py-0.5 text-xs font-bold',
                  r.status === 'SUCCESS'
                    ? 'bg-surface-tint text-sky-900'
                    : r.status === 'PARTIAL'
                    ? 'bg-status-warning/20 text-status-warning'
                    : 'bg-status-critical/20 text-status-critical',
                )}
              >
                {r.status}
              </span>
            ),
          },
          {
            key: 'batch_hash',
            header: 'Merkle Batch Hash',
            align: 'right',
            render: (r) => (
              <div className="flex items-center justify-end gap-1.5">
                <code className="font-mono text-[11px] text-text-3 max-w-[120px] truncate">
                  {r.batch_hash}
                </code>
                <button
                  onClick={() => handleCopy(r.batch_hash)}
                  className="grid size-6 place-items-center rounded bg-surface-alt hover:bg-surface-tint text-text-2"
                  title="Copy Batch Hash"
                >
                  {copiedHash === r.batch_hash ? <Check size={12} className="text-sky-900" /> : <Copy size={12} />}
                </button>
              </div>
            ),
          },
        ]}
      />
    </section>
  );
};
