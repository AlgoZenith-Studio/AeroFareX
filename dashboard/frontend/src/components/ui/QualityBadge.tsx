import React from 'react';
import clsx from 'clsx';
import { CircleCheck, TriangleAlert, OctagonAlert } from 'lucide-react';
import type { QualityMetadata } from '@aerofarex/shared-types';
import { pct } from '@/lib/format';

/**
 * Rule 5: every published number carries its quality metadata. Status by
 * coverage: >= 90% good, 80-90% serious, < 80% critical. Icon + text, never
 * colour alone. Reads real metadata; never pass hand-written numbers.
 */
const STATUS = {
  GOOD: { icon: CircleCheck, tone: 'text-status-good', label: 'Good' },
  SERIOUS: { icon: TriangleAlert, tone: 'text-status-serious', label: 'Low coverage' },
  CRITICAL: { icon: OctagonAlert, tone: 'text-status-critical', label: 'Critical coverage' },
} as const;

export const QualityBadge: React.FC<{ quality: QualityMetadata; onBand?: boolean; className?: string }> = ({
  quality, onBand, className,
}) => {
  const s = STATUS[quality.quality_status];
  const Icon = s.icon;
  return (
    <span
      className={clsx('inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs', onBand ? 'text-text-1' : 'text-text-3', className)}
      title={`Coverage ${pct(quality.coverage, 1)} · imputed ${pct(quality.imputation_rate, 1)} · ${quality.provenance} · vintage ${quality.vintage} · methodology ${quality.methodology_version}`}
    >
      <span className={clsx('inline-flex items-center gap-1 font-medium', onBand ? 'text-text-1' : s.tone)}>
        <Icon size={13} aria-hidden />
        <span className="num">{pct(quality.coverage)}</span> coverage
        <span className="sr-only">({s.label})</span>
      </span>
      <span aria-hidden>·</span>
      <span>{quality.provenance === 'REAL' ? 'Real' : 'Simulated'}</span>
      <span aria-hidden>·</span>
      <span>{quality.is_provisional ? 'Provisional' : `Vintage ${quality.vintage}`}</span>
    </span>
  );
};
