'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Plane } from 'lucide-react';
import type { RouteSummary } from '@aerofarex/shared-types';
import { inr, pct, signed } from '@/lib/format';
import { QualityBadge } from '@/components/ui/QualityBadge';

export const RouteDetailHeader: React.FC<{
  route?: RouteSummary;
}> = ({ route }) => {
  if (!route) return null;

  const hiddenFee = route.total_fare_paise - route.base_fare_paise;
  const hiddenFeePct = ((hiddenFee / route.base_fare_paise) * 100).toFixed(1);

  return (
    <div className="card p-6 bg-surface mb-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4 mb-4">
        <div className="flex items-center gap-3">
          <Link
            href="/routes/"
            className="grid size-10 place-items-center rounded-full border border-line-control bg-surface hover:bg-surface-alt transition-colors text-text-1"
            aria-label="Back to routes list"
          >
            <ArrowLeft size={18} />
          </Link>
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-sky-200 text-sky-900 font-bold">
              <Plane size={22} />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-[clamp(22px,2vw,30px)] font-bold leading-tight">
                  {route.origin} → {route.destination}
                </h1>
                <span className="rounded-full bg-surface-alt px-3 py-1 text-xs font-bold text-text-2">
                  {route.label}
                </span>
              </div>
              <p className="text-xs text-text-3 mt-0.5">
                DGCA Passenger Weight: <strong className="text-text-1">{pct(route.pax_share, 1)}</strong> ·
                Route ID: <code className="font-mono text-text-2">{route.route_id}</code>
              </p>
            </div>
          </div>
        </div>

        <QualityBadge quality={route.quality} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl bg-surface-alt p-4">
          <span className="text-xs text-text-3 font-semibold">ADVERTISED BASE FARE</span>
          <p className="font-display num text-2xl font-bold mt-1 text-text-1">
            {inr(route.base_fare_paise)}
          </p>
          <span className="text-[11px] text-text-3">Base fare (excluding taxes & fees)</span>
        </div>

        <div className="rounded-2xl bg-surface-alt p-4">
          <span className="text-xs text-text-3 font-semibold">TOTAL PAYABLE FARE</span>
          <p className="font-display num text-2xl font-bold mt-1 text-text-1">
            {inr(route.total_fare_paise)}
          </p>
          <span className="text-[11px] text-text-3">Final checkout price</span>
        </div>

        <div className="rounded-2xl bg-status-warning/10 border border-status-warning/30 p-4">
          <span className="text-xs text-status-warning font-bold">HIDDEN-FEE GAP</span>
          <p className="font-display num text-2xl font-bold mt-1 text-status-warning">
            +{inr(hiddenFee)}
          </p>
          <span className="text-[11px] text-status-warning font-semibold">
            +{hiddenFeePct}% above base fare
          </span>
        </div>

        <div className="rounded-2xl bg-surface-alt p-4">
          <span className="text-xs text-text-3 font-semibold">24H PRICE MOVEMENT</span>
          <p
            className={`font-display num text-2xl font-bold mt-1 ${
              route.change_24h_pct > 0
                ? 'text-status-warning'
                : route.change_24h_pct < 0
                ? 'text-sky-900'
                : 'text-text-1'
            }`}
          >
            {signed(route.change_24h_pct, 1, '%')}
          </p>
          <span className="text-[11px] text-text-3">24-hour aggregate change</span>
        </div>
      </div>
    </div>
  );
};
