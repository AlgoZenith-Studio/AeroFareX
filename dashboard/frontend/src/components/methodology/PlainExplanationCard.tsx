'use client';

import React from 'react';
import clsx from 'clsx';
import { Network, Calculator, GitMerge, FileSearch } from 'lucide-react';

interface MethodologyStepProps {
  step: string;
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  description: string;
  details: string[];
}

const MethodologyStep: React.FC<MethodologyStepProps> = ({
  step,
  title,
  icon: Icon,
  description,
  details,
}) => {
  return (
    <div className="flex flex-col justify-between rounded-xl border border-line bg-surface p-4 transition-colors hover:border-sky-300/40">
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="inline-flex items-center rounded-md bg-surface-tint px-2 py-0.5 text-[11px] font-bold text-sky-900">
            {step}
          </span>
          <div className="rounded-full bg-surface-alt p-1.5 text-text-2">
            <Icon size={16} />
          </div>
        </div>
        <h3 className="text-base font-bold text-text-1 mb-1.5">{title}</h3>
        <p className="text-xs text-text-2 leading-relaxed mb-3">{description}</p>
      </div>

      <ul className="space-y-1.5 border-t border-line/60 pt-3 text-[11px] text-text-3">
        {details.map((item, idx) => (
          <li key={idx} className="flex items-start gap-1.5">
            <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-sky-500" />
            <span className="leading-snug">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export const PlainExplanationCard: React.FC<{ className?: string }> = ({ className }) => {
  const steps: MethodologyStepProps[] = [
    {
      step: 'STEP 1',
      title: 'Sampling & Data Intake',
      icon: Network,
      description: 'Continuous web-scraping & API sampling of lowest non-stop round-trip and one-way airfares across 5 major Indian trunk corridors.',
      details: [
        '5 DGCA Corridors: DEL-BOM, BOM-BLR, DEL-BLR, DEL-CCU, BOM-MAA.',
        '5 Booking Windows: 0-3d, 4-7d, 8-14d, 15-30d, and 31-60d.',
        '24 collection runs daily to filter out dynamic pricing spikes.',
      ],
    },
    {
      step: 'STEP 2',
      title: 'Elementary Cell Aggregation',
      icon: Calculator,
      description: 'Raw price quotes within each route × booking window cell are aggregated into a single unweighted geometric mean (Jevons Index).',
      details: [
        'Geometric mean handles relative price changes without scale bias.',
        'Filters out flash sales or surge pricing extreme outliers.',
        'Produces 25 elementary price ratios per published daily vintage.',
      ],
    },
    {
      step: 'STEP 3',
      title: 'Chained Laspeyres Index',
      icon: GitMerge,
      description: 'Elementary cell indices are aggregated across routes using DGCA passenger volume weights and daily chain-linking.',
      details: [
        'Passenger weights (Wr) derived from DGCA annual traffic stats.',
        'Daily chain-linking prevents base-year formula drift over time.',
        'Produces the headline Air Fare Index (AFI) initialized at 100.0.',
      ],
    },
    {
      step: 'STEP 4',
      title: 'Quality & Drip Decomposition',
      icon: FileSearch,
      description: 'Separates pure base airfares from mandatory seat selection and checked baggage add-on costs to track hidden drip pricing.',
      details: [
        'Hedonic regression estimates missing baggage/seat fee values.',
        'Tracks 3 sub-indices: AFI (Base), TCT (Total Cost), ANC (Ancillaries).',
        'Computes the Hidden-Fee Gap (TCT − AFI) in points & percentage.',
      ],
    },
  ];

  return (
    <section className={clsx('card flex flex-col p-5', className)} aria-label="Plain Language Explanation">
      <header className="mb-4">
        <h2 className="text-[17px] leading-tight font-bold">Plain-Language Methodology Overview</h2>
        <p className="mt-1 text-xs text-text-3">
          A step-by-step breakdown of how AeroFareX collects raw flight quotes, aggregates cell means, chains index points, and isolates hidden fees.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {steps.map((s) => (
          <MethodologyStep key={s.step} {...s} />
        ))}
      </div>
    </section>
  );
};
