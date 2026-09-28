'use client';

import React, { useState } from 'react';
import clsx from 'clsx';
import type { AdvanceWindow, LeadTimeMatrix, RouteId } from '@aerofarex/shared-types';
import { inr, pct } from '@/lib/format';
import { ChartFrame } from '@/components/ui/ChartFrame';
import { DataTable } from '@/components/ui/DataTable';

const ROUTE_LABELS: Record<RouteId, string> = {
  'DEL-BOM': 'Delhi → Mumbai',
  'DEL-BLR': 'Delhi → Bengaluru',
  'BOM-BLR': 'Mumbai → Bengaluru',
  'DEL-CCU': 'Delhi → Kolkata',
  'BLR-HYD': 'Bengaluru → Hyderabad',
};

export const LeadTimeHeatmapCard: React.FC<{
  matrix?: LeadTimeMatrix;
  status: 'pending' | 'error' | 'success';
  error?: unknown;
  onRetry?: () => void;
  className?: string;
}> = ({ matrix, status, error, onRetry, className }) => {
  const [hoveredCell, setHoveredCell] = useState<{ route: RouteId; window: AdvanceWindow } | null>(null);

  const windows: AdvanceWindow[] = matrix?.windows ?? ['T+1', 'T+7', 'T+15', 'T+30', 'T+45'];
  const routes: RouteId[] = ['DEL-BOM', 'DEL-BLR', 'BOM-BLR', 'DEL-CCU', 'BLR-HYD'];

  const getCellData = (route: RouteId, window: AdvanceWindow) => {
    return matrix?.cells.find((c) => c.route_id === route && c.window === window);
  };

  return (
    <ChartFrame
      className={className}
      title="Route × Booking-Window Heatmap"
      subtitle="Matrix of 5 DGCA trunk routes across 5 advance booking windows (missing cells tone-on-tone hatched)"
      status={status}
      error={error}
      onRetry={onRetry}
      isEmpty={!matrix || !matrix.cells.length}
      emptyReason="No lead time matrix data available."
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <span className="flex items-center gap-2">
            <span className="text-text-3 font-semibold">Quality Status:</span>
            <span className="inline-block size-2.5 rounded-full bg-sky-500" /> Real Data
            <span className="inline-block size-2.5 rounded-full bg-surface-tint" /> Standard Fare
          </span>
          <span className="flex items-center gap-1.5">
            <span className="hatch inline-block size-3 rounded border border-sky-600/40" /> Imputed / Missing Cell (Rule 6 Hatching)
          </span>
        </div>
      }
      table={() => (
        <DataTable
          caption="Lead time fare matrix by route and advance booking window"
          rowKey={(r) => r.route}
          rows={routes.map((r) => ({
            route: r,
            label: ROUTE_LABELS[r],
            fares: windows.map((w) => getCellData(r, w)),
          }))}
          columns={[
            {
              key: 'label',
              header: 'Route / Window',
              render: (r) => <span className="font-bold text-text-1">{r.label}</span>,
            },
            ...windows.map((w) => ({
              key: w,
              header: `${w} (${pct(matrix?.weights[w] ?? 0, 0)} weight)`,
              align: 'right' as const,
              render: (r: { fares: (ReturnType<typeof getCellData>)[] }) => {
                const c = r.fares.find((f) => f?.window === w);
                if (!c || c.total_fare_paise === null) {
                  return (
                    <span className="hatch inline-block rounded-lg px-2.5 py-1 text-[11px] font-bold text-status-warning border border-status-warning/40">
                      {c?.missing_reason || 'IMPUTED'}
                    </span>
                  );
                }
                return (
                  <div className="flex flex-col items-end">
                    <span className="num font-bold text-text-1">{inr(c.total_fare_paise)}</span>
                    <span className="text-[10px] text-text-3">{c.provenance === 'REAL' ? 'Real' : 'Simulated'}</span>
                  </div>
                );
              },
            })),
          ]}
        />
      )}
    >
      {() => (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-line">
                <th className="px-4 py-3 text-left text-xs font-bold text-text-2">Route / Window</th>
                {windows.map((w) => (
                  <th key={w} className="px-4 py-3 text-center text-xs font-bold text-text-2">
                    <div>{w}</div>
                    <div className="text-[10px] text-text-3 font-normal mt-0.5">
                      {pct(matrix?.weights[w] ?? 0, 0)} weight
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {routes.map((r) => (
                <tr key={r} className="border-b border-line last:border-0 hover:bg-surface-alt/50 transition-colors">
                  <td className="px-4 py-4 text-sm font-bold text-text-1 whitespace-nowrap">
                    {ROUTE_LABELS[r]}
                  </td>
                  {windows.map((w) => {
                    const cell = getCellData(r, w);
                    const fare = cell?.total_fare_paise;
                    const isMissing = !cell || fare === null;
                    const isHovered = hoveredCell?.route === r && hoveredCell?.window === w;

                    return (
                      <td key={w} className="px-3 py-3 text-center min-w-[130px]">
                        <div
                          onMouseEnter={() => setHoveredCell({ route: r, window: w })}
                          onMouseLeave={() => setHoveredCell(null)}
                          className={clsx(
                            'relative rounded-2xl p-3 transition-all flex flex-col items-center justify-center min-h-[60px]',
                            isMissing ? 'hatch border border-status-warning/40 bg-status-warning/10' : 'bg-surface-alt/70 border border-line/60',
                            isHovered ? 'ring-2 ring-black shadow-md z-10 bg-surface' : '',
                          )}
                        >
                          {isMissing ? (
                            <>
                              <span className="text-[11px] font-bold text-status-warning uppercase tracking-wider">
                                {cell?.missing_reason || 'IMPUTED'}
                              </span>
                              <span className="text-[10px] text-text-3 mt-0.5">Rule 6 Hatching</span>
                            </>
                          ) : (
                            <>
                              <span className="font-display num text-[15px] font-bold text-text-1">
                                {fare !== null && fare !== undefined ? inr(fare) : '–'}
                              </span>
                              <span className="text-[11px] text-text-3 font-medium mt-0.5">
                                {cell.provenance === 'REAL' ? 'Real' : 'Simulated'}
                              </span>
                            </>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ChartFrame>
  );
};
