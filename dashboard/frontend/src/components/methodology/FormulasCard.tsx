'use client';

import React, { useState } from 'react';
import clsx from 'clsx';
import { FunctionSquare, HelpCircle, CheckCircle2, ChevronRight } from 'lucide-react';

interface FormulaDef {
  id: string;
  name: string;
  badge: string;
  subtitle: string;
  mathFormula: string;
  plainFormula: string;
  purpose: string;
  variables: { symbol: string; desc: string }[];
  notes: string[];
}

const FORMULAS: FormulaDef[] = [
  {
    id: 'jevons',
    name: 'Jevons Elementary Cell Aggregate',
    badge: 'Elementary Aggregate',
    subtitle: 'Unweighted geometric mean of observed prices within each route × booking window cell',
    mathFormula: 'P_{c,t} = \\exp\\left( \\frac{1}{N_{c,t}} \\sum_{i=1}^{N_{c,t}} \\ln p_{i,c,t} \\right) = \\left( \\prod_{i=1}^{N_{c,t}} p_{i,c,t} \\right)^{\\frac{1}{N_{c,t}}}',
    plainFormula: 'P(cell, date) = Geometric Mean of all valid fare quotes in cell c on date t',
    purpose: 'Aggregates individual raw flight fare quotes within a single route and booking window without bias towards extreme high-fare outliers.',
    variables: [
      { symbol: 'P_{c,t}', desc: 'Elementary price aggregate for route-window cell c on date t' },
      { symbol: 'p_{i,c,t}', desc: 'Observed fare quote for flight sample i in cell c on date t' },
      { symbol: 'N_{c,t}', desc: 'Total number of valid non-outlier fare observations in cell c' },
    ],
    notes: [
      'Satisfies time-reversal and transitivity axioms.',
      'Invariance to unit changes prevents scale distortions between low-cost and legacy carriers.',
      'Prevents high fare spikes (e.g. last-seat surge fares) from disproportionately distorting cell means.',
    ],
  },
  {
    id: 'laspeyres',
    name: 'Chained Laspeyres Index',
    badge: 'Higher-Level Index',
    subtitle: 'Daily chain-linked index compilation using DGCA annual passenger volume weights',
    mathFormula: 'I_t = I_{t-1} \\times \\left( \\frac{\\sum_{r=1}^{M} W_r \\cdot P_{r,t}}{\\sum_{r=1}^{M} W_r \\cdot P_{r,t-1}} \\right) \\quad \\text{with } I_0 = 100.0',
    plainFormula: 'Index(t) = Index(t-1) × [ Weighted Sum of Route Prices(t) / Weighted Sum of Route Prices(t-1) ]',
    purpose: 'Combines route price levels into a single, unified headline index (AFI) anchored to a base date value of 100.0 (1 Sep 2026).',
    variables: [
      { symbol: 'I_t', desc: 'Air Fare Index value on date t (headline points)' },
      { symbol: 'W_r', desc: 'Fixed DGCA annual passenger volume weight for trunk corridor r' },
      { symbol: 'P_{r,t}', desc: 'Aggregated price level for route r on date t (weighted across booking windows)' },
      { symbol: 'M', desc: 'Total trunk corridors in index basket (M = 5)' },
    ],
    notes: [
      'Daily chain-linking accommodates structural schedule changes without baseline drift.',
      'Route weights Wr are re-indexed annually following official DGCA city-pair passenger traffic publications.',
      'Guarantees backward compatibility with published historical vintages.',
    ],
  },
  {
    id: 'booking_curve',
    name: 'Booking Curve Weights (ωk)',
    badge: 'Window Weighting',
    subtitle: 'Weighted composition across 5 advance booking windows to form route price Pr,t',
    mathFormula: 'P_{r,t} = \\sum_{k=1}^{5} \\omega_k \\cdot P_{r,k,t} \\quad \\text{where } \\sum_{k=1}^{5} \\omega_k = 1.0',
    plainFormula: 'Route Price = (35% × 0-3d) + (25% × 4-7d) + (20% × 8-14d) + (12% × 15-30d) + (8% × 31-60d)',
    purpose: 'Reflects passenger purchasing behavior by weighting close-in business bookings heavier than long-horizon leisure bookings.',
    variables: [
      { symbol: '\\omega_1 = 0.35', desc: '0–3 Days Advance (Close-in / Urgent travel)' },
      { symbol: '\\omega_2 = 0.25', desc: '4–7 Days Advance (Short-horizon travel)' },
      { symbol: '\\omega_3 = 0.20', desc: '8–14 Days Advance (Standard advance window)' },
      { symbol: '\\omega_4 = 0.12', desc: '15–30 Days Advance (Early leisure planning)' },
      { symbol: '\\omega_5 = 0.08', desc: '31–60 Days Advance (Ultra-long horizon)' },
    ],
    notes: [
      'Weights are derived from DGCA ticketing date distributions across domestic trunk flights.',
      'Prevents close-in fare volatility from swamping early-bird price trends.',
    ],
  },
  {
    id: 'hedonic',
    name: 'Hedonic Imputation Model',
    badge: 'Quality Imputation',
    subtitle: 'Log-linear regression model for imputing missing ancillary fees & option values',
    mathFormula: '\\ln p_{i,c} = \\beta_0 + \\sum_{a} \\gamma_a \\text{Carrier}_{i,a} + \\sum_{h} \\delta_h \\text{Hour}_{i,h} + \\beta_{\\text{bag}} \\text{BagAllowed}_i + \\varepsilon_i',
    plainFormula: 'log(Price) = Base + Carrier Effect + Departure Hour Effect + Baggage Included Effect + Error',
    purpose: 'Imputes unobserved baggage fees, seat selection add-ons, or missing flight slots using quality attributes.',
    variables: [
      { symbol: '\\text{Carrier}_{i,a}', desc: 'Indicator variable for operating airline carrier a' },
      { symbol: '\\text{Hour}_{i,h}', desc: 'Time-of-day departure window indicator (e.g. Morning Peak vs Red-eye)' },
      { symbol: '\\text{BagAllowed}_i', desc: 'Dummy variable for included 15kg checked baggage option' },
      { symbol: '\\beta_{\\text{bag}}', desc: 'Hedonic shadow price coefficient of checked baggage' },
    ],
    notes: [
      'Replaces simple mean imputation with attribute-adjusted parameter estimates.',
      'Ensures Total Cost Index (TCT) accurately reflects true out-of-pocket costs.',
      'Statistically validated daily against observed cross-source carrier quotes.',
    ],
  },
  {
    id: 'attribution',
    name: 'Additive Attribution Decomposition',
    badge: 'Point Contribution',
    subtitle: 'Decomposing daily index point movement into exact additive components',
    mathFormula: '\\Delta I_t = I_t - I_{t-1} = \\sum_{r=1}^{M} \\Delta P_{r,t} \\cdot W_r \\cdot \\left( \\frac{I_{t-1}}{\\sum W_j P_{j,t-1}} \\right) = \\sum_{r=1}^{M} C_{r,t}',
    plainFormula: 'Change in Index Points = Sum of (Route Price Change × Route Weight × Index Multiplier)',
    purpose: 'Explains exactly how many index points were contributed by each route, carrier, or booking window.',
    variables: [
      { symbol: '\\Delta I_t', desc: 'Total change in headline Air Fare Index on day t (e.g. +3.4 pts)' },
      { symbol: 'C_{r,t}', desc: 'Additive point contribution of trunk route r to total index change' },
      { symbol: '\\Delta P_{r,t}', desc: 'Absolute fare change in rupees for route r on date t' },
    ],
    notes: [
      'Exact zero-residual identity: the sum of route contributions strictly equals total index change.',
      'Powers the interactive waterfall chart on the Attribution page.',
    ],
  },
];

export const FormulasCard: React.FC<{ className?: string }> = ({ className }) => {
  const [activeId, setActiveId] = useState<string>('jevons');
  const activeFormula = FORMULAS.find((f) => f.id === activeId) || FORMULAS[0];

  return (
    <section className={clsx('card flex flex-col p-5', className)} aria-label="Methodology Formulas">
      <header className="mb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-[17px] leading-tight font-bold">Mathematical Formulations & Equations</h2>
            <p className="mt-1 text-xs text-text-3">
              Official mathematical specifications for elementary aggregation, index chaining, booking curves, and hedonic imputation.
            </p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-md bg-surface-alt px-2.5 py-1 text-xs font-mono text-text-2">
            <FunctionSquare size={14} className="text-sky-600" /> Math Engine v2.4
          </span>
        </div>
      </header>

      {/* Formula Selector Tabs */}
      <div className="mb-5 flex flex-wrap gap-2 border-b border-line pb-3">
        {FORMULAS.map((f) => {
          const isActive = f.id === activeId;
          return (
            <button
              key={f.id}
              onClick={() => setActiveId(f.id)}
              className={clsx(
                'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all',
                isActive
                  ? 'bg-black text-white font-bold shadow-sm'
                  : 'bg-surface-alt text-text-2 hover:bg-surface-tint hover:text-text-1',
              )}
            >
              {f.name}
              {isActive && <ChevronRight size={13} className="text-sky-300" />}
            </button>
          );
        })}
      </div>

      {/* Active Formula Details Display */}
      <div className="rounded-xl border border-line bg-surface-alt/40 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-md bg-sky-100 dark:bg-sky-950 px-2 py-0.5 text-xs font-bold text-sky-800 dark:text-sky-200">
              {activeFormula.badge}
            </span>
            <h3 className="text-lg font-bold text-text-1">{activeFormula.name}</h3>
          </div>
        </div>

        <p className="text-xs text-text-2 mb-4 leading-relaxed">{activeFormula.subtitle}</p>

        {/* Formula Math Display Box */}
        <div className="mb-5 rounded-lg border border-line bg-white dark:bg-zinc-900 p-4 text-text-1 shadow-inner overflow-x-auto">
          <div className="text-xs text-text-3 mb-1 uppercase tracking-wider font-semibold">Mathematical Notation</div>
          <div className="py-2 text-sm sm:text-base font-medium tracking-wide text-sky-900 dark:text-sky-300 font-mono whitespace-nowrap overflow-x-auto">
            {activeFormula.mathFormula}
          </div>
          <div className="mt-2 border-t border-line/60 pt-2 text-xs text-text-2">
            <span className="font-bold text-text-1">Plain Text: </span>
            {activeFormula.plainFormula}
          </div>
        </div>

        {/* Grid of Variables & Purpose */}
        <div className="grid gap-4 md:grid-cols-2 mb-4">
          <div className="rounded-lg border border-line bg-surface p-3.5">
            <h4 className="text-xs font-bold text-text-1 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <HelpCircle size={14} className="text-sky-600" /> Variable Definitions
            </h4>
            <ul className="space-y-2 text-xs">
              {activeFormula.variables.map((v, i) => (
                <li key={i} className="flex items-start gap-2 border-b border-line/40 pb-1.5 last:border-0 last:pb-0">
                  <span className="font-mono font-bold text-sky-800 dark:text-sky-300 shrink-0 bg-surface-alt px-1.5 py-0.5 rounded text-[11px]">
                    {v.symbol}
                  </span>
                  <span className="text-text-2 text-[11px] leading-snug">{v.desc}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-lg border border-line bg-surface p-3.5 flex flex-col justify-between">
            <div>
              <h4 className="text-xs font-bold text-text-1 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-emerald-600" /> Key Methodological Properties
              </h4>
              <p className="text-xs text-text-2 mb-3 leading-relaxed">{activeFormula.purpose}</p>
              <ul className="space-y-1.5 text-[11px] text-text-3">
                {activeFormula.notes.map((note, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-emerald-500" />
                    <span className="leading-snug">{note}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
