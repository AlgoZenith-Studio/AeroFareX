'use client';

import React from 'react';
import clsx from 'clsx';
import { History, ShieldCheck, FileCode, CheckCircle2 } from 'lucide-react';
import { DataTable } from '@/components/ui/DataTable';

interface VintageRow {
  version: string;
  releaseDate: string;
  effectivePeriod: string;
  status: 'ACTIVE' | 'SUPERSEDED';
  modifications: string;
  dgcaCompliance: string;
  baseIndex: string;
  hash: string;
}

const VINTAGE_HISTORY: VintageRow[] = [
  {
    version: 'h-1.2',
    releaseDate: '2026-09-01',
    effectivePeriod: '2026-09-01 — Present',
    status: 'ACTIVE',
    modifications: 'Added hedonic imputation model for missing checked-baggage options; expanded booking windows to include 31-60d horizon; updated DGCA 2026 route passenger weights.',
    dgcaCompliance: 'Fully aligned with DGCA Air Transport Circular 04/2026 on dynamic fare reporting.',
    baseIndex: '1 Sep 2026 = 100.0',
    hash: '0x8f4a...e12d',
  },
  {
    version: 'h-1.1',
    releaseDate: '2026-03-15',
    effectivePeriod: '2026-03-15 — 2026-08-31',
    status: 'SUPERSEDED',
    modifications: 'Introduced Jevons geometric mean for elementary cell aggregation to replace weighted arithmetic averages; tightened outlier exclusion bounds from 3.0σ to 2.5σ.',
    dgcaCompliance: 'Aligned with DGCA Q1 2026 passenger traffic distribution statistics.',
    baseIndex: '15 Mar 2026 = 100.0',
    hash: '0x3c12...b981',
  },
  {
    version: 'h-1.0',
    releaseDate: '2025-10-01',
    effectivePeriod: '2025-10-01 — 2026-03-14',
    status: 'SUPERSEDED',
    modifications: 'Initial release of AeroFareX Daily Index. Covered 5 DGCA trunk corridors (DEL-BOM, BOM-BLR, DEL-BLR, DEL-CCU, BOM-MAA) with 4 booking windows (0-3d, 4-7d, 8-14d, 15-30d).',
    dgcaCompliance: 'Compliant with DGCA 2025 baseline methodology draft guidelines.',
    baseIndex: '1 Oct 2025 = 100.0',
    hash: '0x1a90...f432',
  },
];

export const VintageHistoryCard: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <section className={clsx('card flex flex-col p-5', className)} aria-label="Vintage History and Version Audit Log">
      <header className="mb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-[17px] leading-tight font-bold">Methodology Version Log & Vintage History</h2>
            <p className="mt-1 text-xs text-text-3">
              Complete audit trail of index methodology releases, formula updates, base period revisions, and regulatory compliance notes.
            </p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 px-2.5 py-0.5 text-xs font-bold text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 size={13} aria-hidden /> Audit Compliance: VERIFIED
          </span>
        </div>
      </header>

      {/* Active Spec Summary Box */}
      <div className="mb-5 rounded-xl border border-line bg-surface-alt/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-black text-white px-2 py-0.5 text-xs font-mono font-bold">
              CURRENT ACTIVE: h-1.2
            </span>
            <span className="text-xs text-text-2">Effective since 1 September 2026</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-text-3 font-mono">
            <FileCode size={13} /> Engine Audit Hash: <span className="text-text-1 font-bold">0x8f4a...e12d</span>
          </div>
        </div>
        <p className="text-xs text-text-2 leading-relaxed">
          Under Version <strong className="text-text-1">h-1.2</strong>, all daily index values ($I_t$) published on the overview dashboard represent chain-linked price relatives computed strictly from 25 unweighted elementary cells. Any retroactive revisions due to delayed data quotes are logged with cryptographic Merkle root signatures.
        </p>
      </div>

      {/* Version Table */}
      <DataTable
        caption="Historical methodology versions, release dates, formula changes, and compliance alignment"
        rowKey={(r) => r.version}
        rows={VINTAGE_HISTORY}
        columns={[
          {
            key: 'version',
            header: 'Version',
            sortValue: (r) => r.version,
            render: (r) => (
              <div className="flex flex-col">
                <span className="font-mono font-bold text-text-1">{r.version}</span>
                <span className="text-[11px] text-text-3 font-mono">{r.hash}</span>
              </div>
            ),
          },
          {
            key: 'status',
            header: 'Status',
            sortValue: (r) => r.status,
            render: (r) => (
              <span
                className={clsx(
                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold',
                  r.status === 'ACTIVE'
                    ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200'
                    : 'bg-surface-alt text-text-3',
                )}
              >
                {r.status === 'ACTIVE' ? <ShieldCheck size={12} /> : <History size={12} />}
                {r.status}
              </span>
            ),
          },
          {
            key: 'releaseDate',
            header: 'Effective Period',
            sortValue: (r) => r.releaseDate,
            render: (r) => (
              <div>
                <span className="block font-bold text-text-1 text-xs">{r.effectivePeriod}</span>
                <span className="block text-[11px] text-text-3">Base: {r.baseIndex}</span>
              </div>
            ),
          },
          {
            key: 'modifications',
            header: 'Methodology & Formula Modifications',
            render: (r) => (
              <div className="max-w-md">
                <p className="text-xs text-text-1 leading-snug font-medium mb-0.5">{r.modifications}</p>
                <p className="text-[11px] text-text-3 italic">{r.dgcaCompliance}</p>
              </div>
            ),
          },
        ]}
      />
    </section>
  );
};
