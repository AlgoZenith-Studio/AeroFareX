import React from 'react';
import clsx from 'clsx';
import { CircleCheck, OctagonX, RotateCcw, TriangleAlert } from 'lucide-react';
import type { CircuitState } from '@aerofarex/shared-types';
import { CIRCUIT } from '@/lib/entities';

const ICON = { HEALTHY: CircleCheck, DEGRADED: TriangleAlert, OPEN: OctagonX, RECOVERING: RotateCcw } as const;

/** Circuit state: a distinct icon per state plus a label, never colour alone. */
export const StatusPill: React.FC<{ state: CircuitState }> = ({ state }) => {
  const Icon = ICON[state];
  const s = CIRCUIT[state];
  return (
    <span className={clsx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium', s.bg)}>
      <Icon size={12} className={s.tone} aria-hidden />
      <span className="text-text-1">{s.label}</span>
    </span>
  );
};
