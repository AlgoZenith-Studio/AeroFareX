import React from 'react';

export const PageHeader: React.FC<{ title: string; subtitle?: React.ReactNode; actions?: React.ReactNode }> = ({
  title, subtitle, actions,
}) => (
  <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
    <div>
      <h1 className="text-[clamp(28px,2.6vw,42px)] leading-tight">{title}</h1>
      {subtitle && <p className="mt-1 text-[15px] text-text-3">{subtitle}</p>}
    </div>
    {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
  </div>
);
