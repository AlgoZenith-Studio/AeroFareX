'use client';

import React, { useState } from 'react';
import clsx from 'clsx';
import { Search, Eye, X, ShieldCheck } from 'lucide-react';
import type { Observation } from '@aerofarex/shared-types';
import { useObservationAudit } from '@/lib/api/hooks';
import { inr, shortDate, istTime } from '@/lib/format';
import { DataTable } from '@/components/ui/DataTable';

export const RouteObservationsCard: React.FC<{
  observations?: Observation[];
  className?: string;
}> = ({ observations = [], className }) => {
  const [search, setSearch] = useState('');
  const [selectedObsId, setSelectedObsId] = useState<string | null>(null);

  const auditQuery = useObservationAudit(selectedObsId);
  const audit = auditQuery.data?.data;

  const filtered = observations.filter((o) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      (o.flight_number && o.flight_number.toLowerCase().includes(s)) ||
      o.carrier_code.toLowerCase().includes(s) ||
      o.source.toLowerCase().includes(s) ||
      o.advance_window.toLowerCase().includes(s)
    );
  });

  return (
    <>
      <section className={clsx('card flex flex-col p-5', className)} aria-label="Raw Observations Table">
        <header className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-[17px] leading-tight font-bold">Raw Fare Observations</h2>
            <p className="mt-1 text-xs text-text-3">
              Cryptographically auditable raw fare observations collected across sources and windows.
            </p>
          </div>

          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-3" />
            <input
              type="text"
              placeholder="Search observations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 rounded-full border border-line bg-surface-alt pl-8 pr-3 text-xs text-text-1 focus:border-black focus:outline-none"
            />
          </div>
        </header>

        <DataTable
          caption="Sampled observations and audit metadata"
          rowKey={(r) => r.observation_id}
          rows={filtered.slice(0, 50)}
          initialSort={{ key: 'departure_date', dir: 'asc' }}
          columns={[
            {
              key: 'flight_number',
              header: 'Flight / Carrier',
              sortValue: (r) => r.flight_number || '',
              render: (r) => (
                <div>
                  <span className="block font-bold text-text-1">{r.flight_number || 'N/A'}</span>
                  <span className="block text-[11px] text-text-3">{r.carrier_code} · {r.source}</span>
                </div>
              ),
            },
            {
              key: 'advance_window',
              header: 'Window',
              sortValue: (r) => r.advance_window,
              render: (r) => (
                <span className="rounded-md bg-surface-alt px-2 py-0.5 text-xs font-bold text-text-2">
                  {r.advance_window}
                </span>
              ),
            },
            {
              key: 'departure_date',
              header: 'Departure Date',
              sortValue: (r) => r.departure_date,
              render: (r) => <span className="num font-bold">{shortDate(r.departure_date)}</span>,
            },
            {
              key: 'fare_family',
              header: 'Fare Family',
              render: (r) => r.fare_family || 'Standard',
            },
            {
              key: 'base_fare',
              header: 'Base Fare',
              align: 'right',
              sortValue: (r) => r.components?.base_fare_paise || 0,
              render: (r) => (r.components ? inr(r.components.base_fare_paise) : 'N/A'),
            },
            {
              key: 'total_payable',
              header: 'Total Payable',
              align: 'right',
              sortValue: (r) => r.components?.total_payable_paise || 0,
              render: (r) => (r.components ? inr(r.components.total_payable_paise) : 'N/A'),
            },
            {
              key: 'status',
              header: 'Validation',
              render: (r) => (
                <span
                  className={clsx(
                    'rounded-full px-2.5 py-0.5 text-xs font-bold',
                    r.validation_status === 'VALID'
                      ? 'bg-surface-tint text-sky-900'
                      : 'bg-status-warning/20 text-status-warning',
                  )}
                >
                  {r.validation_status}
                </span>
              ),
            },
            {
              key: 'audit',
              header: 'Audit Trace',
              align: 'right',
              render: (r) => (
                <button
                  onClick={() => setSelectedObsId(r.observation_id)}
                  className="inline-flex h-7 items-center gap-1 rounded-full border border-line-control bg-surface px-2.5 text-xs font-bold text-text-1 hover:border-black hover:bg-surface-alt"
                >
                  <Eye size={12} aria-hidden /> Inspect
                </button>
              ),
            },
          ]}
        />
      </section>

      {/* Observation Audit Drawer / Modal */}
      {selectedObsId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="card max-w-xl w-full p-6 bg-surface shadow-2xl relative">
            <button
              onClick={() => setSelectedObsId(null)}
              className="absolute right-4 top-4 grid size-8 place-items-center rounded-full bg-surface-alt text-text-2 hover:bg-surface-tint"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <ShieldCheck size={20} className="text-sky-600" />
              <h3 className="text-lg font-bold">Cryptographic Audit Trace</h3>
            </div>

            {auditQuery.isPending ? (
              <p className="text-xs text-text-3 py-8 text-center">Loading audit metadata...</p>
            ) : audit ? (
              <div className="flex flex-col gap-4 text-xs">
                <div className="rounded-xl bg-surface-alt p-3">
                  <span className="text-text-3 font-semibold block mb-1">OBSERVATION ID</span>
                  <code className="font-mono text-text-1 font-bold break-all">{audit.observation_id}</code>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-surface-alt p-3">
                    <span className="text-text-3 font-semibold block mb-0.5">SOURCE ADAPTER</span>
                    <span className="font-bold text-text-1">{audit.adapter_version}</span>
                  </div>
                  <div className="rounded-xl bg-surface-alt p-3">
                    <span className="text-text-3 font-semibold block mb-0.5">FETCHED AT</span>
                    <span className="font-bold text-text-1"><span className="num font-bold">{istTime(audit.fetched_at)}</span> IST</span>
                  </div>
                </div>

                <div className="rounded-xl bg-surface-alt p-3">
                  <span className="text-text-3 font-semibold block mb-1">SHA-256 CONTENT HASH</span>
                  <code className="font-mono text-[11px] text-text-1 break-all block">{audit.sha256}</code>
                </div>

                <div className="rounded-xl bg-surface-alt p-3">
                  <span className="text-text-3 font-semibold block mb-1">BATCH MERKLE HASH</span>
                  <code className="font-mono text-[11px] text-text-1 break-all block">{audit.batch_hash}</code>
                </div>

                <div className="rounded-xl bg-surface-alt p-3">
                  <span className="text-text-3 font-semibold block mb-1">RAW STORAGE LOCATION</span>
                  <code className="font-mono text-[11px] text-sky-800 break-all block">{audit.object_key}</code>
                </div>
              </div>
            ) : (
              <p className="text-xs text-status-warning py-4">Failed to load audit metadata.</p>
            )}

            <button
              onClick={() => setSelectedObsId(null)}
              className="btn btn-primary mt-6 w-full justify-center"
            >
              Close Audit Drawer
            </button>
          </div>
        </div>
      )}
    </>
  );
};
