'use client';

import React, { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { FlaskConical, X } from 'lucide-react';
import { DEFAULT_CONTROLS, readControls, writeControls, type MockControls } from '@/lib/mock/controls';

/** Mock mode only: force slow, failing, empty or stale responses to test every UI state. */
export const MockControlsPanel: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [controls, setControls] = useState<MockControls>(DEFAULT_CONTROLS);
  const client = useQueryClient();

  useEffect(() => setControls(readControls()), []);

  const update = (patch: Partial<MockControls>) => {
    const next = { ...controls, ...patch };
    setControls(next);
    writeControls(next);
    void client.resetQueries();
  };

  const trigger = (
    <button
      onClick={() => setOpen((v) => !v)}
      aria-expanded={open}
      title="Data comes from the seeded mock API. Click to simulate slow, failing, empty or stale responses."
      className="hidden items-center gap-1.5 whitespace-nowrap rounded-full bg-surface-tint px-3 py-1 text-xs font-medium text-sky-900 hover:bg-sky-300 sm:inline-flex"
    >
      <FlaskConical size={13} aria-hidden /> Mock data
    </button>
  );
  if (!open) return trigger;

  return (
    <div className="relative">
      {trigger}
    <div role="dialog" aria-label="Mock controls" className="card absolute right-0 top-9 z-40 w-72 p-4 shadow-e3">
      <div className="flex items-center justify-between">
        <p className="font-medium">Mock controls</p>
        <button onClick={() => setOpen(false)} aria-label="Close" className="text-text-3 hover:text-text-1"><X size={18} /></button>
      </div>
      <label className="mt-4 block text-sm text-text-2">
        Latency: <b className="text-text-1"><span className="num font-bold">{controls.latencyMs}</span> ms</b>
        <input type="range" min={0} max={4000} step={50} value={controls.latencyMs}
          onChange={(e) => update({ latencyMs: Number(e.target.value) })} className="mt-1 w-full accent-[var(--sky-800)]" />
      </label>
      <label className="mt-3 block text-sm text-text-2">
        Failure rate: <b className="text-text-1"><span className="num font-bold">{Math.round(controls.failRate * 100)}%</span></b>
        <input type="range" min={0} max={1} step={0.05} value={controls.failRate}
          onChange={(e) => update({ failRate: Number(e.target.value) })} className="mt-1 w-full accent-[var(--sky-800)]" />
      </label>
      {(['empty', 'stale'] as const).map((key) => (
        <label key={key} className="mt-3 flex items-center justify-between text-sm text-text-2">
          {key === 'empty' ? 'Return empty lists' : 'Mark data stale'}
          <input type="checkbox" checked={controls[key]} onChange={(e) => update({ [key]: e.target.checked })} className="size-4 accent-[var(--sky-800)]" />
        </label>
      ))}
      <button onClick={() => update(DEFAULT_CONTROLS)} className="mt-4 text-sm font-medium text-sky-800 hover:underline">Reset</button>
    </div>
    </div>
  );
};
