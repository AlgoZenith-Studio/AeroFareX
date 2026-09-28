'use client';

import React from 'react';
import clsx from 'clsx';
import { BookOpenCheck, ShieldCheck, Clock, Layers } from 'lucide-react';
import { renderValueWithNum } from '@/lib/format';

interface MetricCardProps {
  title: string;
  value: string;
  change: string;
  direction?: number;
  note: string;
  hero?: boolean;
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  change,
  note,
  hero,
}) => {
  return (
    <article className={clsx('flex min-h-[164px] flex-col p-[clamp(16px,1.4vw,20px)]', hero ? 'card-hero' : 'card')}>
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-display text-[17px] leading-tight font-medium">{title}</h2>
        {hero ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-black/10 px-2.5 py-0.5 text-xs font-bold text-black">
            <ShieldCheck size={13} aria-hidden /> ACTIVE SPEC
          </span>
        ) : (
          <div className="rounded-md bg-surface-alt p-1.5 text-text-2">
            {title.includes('Base') ? (
              <Clock size={16} aria-hidden />
            ) : title.includes('Basket') ? (
              <Layers size={16} aria-hidden />
            ) : (
              <BookOpenCheck size={16} aria-hidden />
            )}
          </div>
        )}
      </div>
      <p
        className={clsx(
          'font-display mt-3 leading-tight truncate max-w-full overflow-hidden whitespace-nowrap',
          value.length > 10
            ? 'text-[clamp(18px,1.6vw,24px)] tracking-tight'
            : value.length > 6
            ? 'text-[clamp(22px,2.1vw,30px)]'
            : 'text-[clamp(32px,2.8vw,44px)]',
        )}
        title={value}
      >
        {renderValueWithNum(value)}
      </p>
      <p className={clsx('mt-3 flex items-center gap-1.5 text-xs', hero ? 'text-text-1' : 'text-text-2')}>
        <span
          className={clsx(
            'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-bold',
            hero ? 'bg-white/60 text-black' : 'bg-surface-tint text-sky-900',
          )}
        >
          {renderValueWithNum(change)}
        </span>
        {renderValueWithNum(note)}
      </p>
    </article>
  );
};

export const MethodologyKpiCards: React.FC = () => {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        hero
        title="Active Methodology"
        value="Version h-1.2"
        change="Sep 1, 2026"
        note="Hedonic baggage + 5 windows"
      />
      <MetricCard
        title="Index Base Date"
        value="100.0 pts"
        change="1 Sep 2026 = 100"
        note="Daily chain-linked Laspeyres"
      />
      <MetricCard
        title="Basket Structure"
        value="25 Cells"
        change="5 Routes × 5 Windows"
        note="Sampled 24x daily across carriers"
      />
      <MetricCard
        title="Revision Governance"
        value="DGCA Aligned"
        change="Q3 2027"
        note="Next scheduled vintage audit"
      />
    </div>
  );
};
