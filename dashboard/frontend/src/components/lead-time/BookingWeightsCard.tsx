'use client';

import React from 'react';
import clsx from 'clsx';
import type { AdvanceWindow, LeadTimeMatrix } from '@aerofarex/shared-types';
import { pct } from '@/lib/format';
import { PillBars } from '@/components/charts/PillBars';

const DEFAULT_WEIGHTS: Record<AdvanceWindow, number> = {
  'T+1': 0.1,
  'T+7': 0.22,
  'T+15': 0.35,
  'T+30': 0.23,
  'T+45': 0.1,
};

const WINDOW_DESCRIPTIONS: Record<AdvanceWindow, string> = {
  'T+1': 'Emergency / Last-minute distress booking (10% weight)',
  'T+7': 'Short-horizon business trip booking (22% weight)',
  'T+15': 'Core corporate & business travel window (35% weight)',
  'T+30': 'Standard planned travel window (23% weight)',
  'T+45': 'Early bird / Vacation advance purchase (10% weight)',
};

export const BookingWeightsCard: React.FC<{
  matrix?: LeadTimeMatrix;
  className?: string;
}> = ({ matrix, className }) => {
  const weights = matrix?.weights ?? DEFAULT_WEIGHTS;
  const windows: AdvanceWindow[] = ['T+1', 'T+7', 'T+15', 'T+30', 'T+45'];

  return (
    <section className={clsx('card flex flex-col p-5', className)} aria-label="Booking Curve Weights">
      <header className="mb-4">
        <h2 className="text-[17px] leading-tight font-bold">Booking-Curve Weights (ω_k)</h2>
        <p className="mt-1 text-xs text-text-3">
          Passenger booking curve weights assigned to advance windows under DGCA index methodology (sum = 100%).
        </p>
      </header>

      <div className="mb-6">
        <PillBars
          ariaLabel="Booking window weights distribution"
          format={(v) => `${(v * 100).toFixed(0)}%`}
          bars={windows.map((w) => ({
            key: w,
            label: w,
            title: `${w} · ${pct(weights[w], 0)} weight`,
            value: weights[w] * 100,
          }))}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5 text-xs border-t border-line pt-4">
        {windows.map((w) => (
          <div key={w} className="rounded-xl bg-surface-alt p-3 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between font-bold text-text-1 mb-1">
                <span>{w}</span>
                <span className="num text-sky-900 bg-sky-200 px-2 py-0.5 rounded-full text-[11px]">
                  {pct(weights[w], 0)}
                </span>
              </div>
              <p className="text-[11px] text-text-3 leading-relaxed">
                {WINDOW_DESCRIPTIONS[w]}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
