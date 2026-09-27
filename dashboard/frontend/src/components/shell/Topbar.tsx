'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Search } from 'lucide-react';
import { hasRole, useAuth } from '@/lib/auth/AuthProvider';
import { NAV } from '@/lib/nav';
import { useHealth } from '@/lib/api/hooks';
import { USE_MOCK } from '@/lib/config';
import { MockControlsPanel } from './MockControlsPanel';
import { ProfileMenu } from './ProfileMenu';

const ROUTE_LINKS = [
  { id: 'DEL-BOM', label: 'Delhi → Mumbai' },
  { id: 'DEL-BLR', label: 'Delhi → Bengaluru' },
  { id: 'BOM-BLR', label: 'Mumbai → Bengaluru' },
  { id: 'DEL-CCU', label: 'Delhi → Kolkata' },
  { id: 'BLR-HYD', label: 'Bengaluru → Hyderabad' },
];

/** ⌘K / Ctrl+K jumps to any page or route the user is allowed to see. */
const SearchBox: React.FC = () => {
  const { role } = useAuth();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); input.current?.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    const pages = NAV.filter((n) => hasRole(role, n.minRole)).map((n) => ({ href: n.href, label: n.label, kind: 'Page' }));
    const routes = ROUTE_LINKS.map((r) => ({ href: `/routes/${r.id}/`, label: `${r.id} · ${r.label}`, kind: 'Route' }));
    return [...pages, ...routes].filter((r) => r.label.toLowerCase().includes(term)).slice(0, 6);
  }, [q, role]);

  const go = (href: string) => { router.push(href); setQ(''); setOpen(false); input.current?.blur(); };

  return (
    <div className="relative w-full max-w-[340px]">
      <label className="flex h-11 items-center gap-2.5 rounded-full bg-surface-alt px-4">
        <Search size={18} className="text-text-3" aria-hidden />
        <span className="sr-only">Search pages and routes</span>
        <input
          ref={input}
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={(e) => { if (e.key === 'Enter' && results[0]) go(results[0].href); }}
          placeholder="Search routes or pages"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-text-3"
        />
        <kbd className="rounded-md border border-line bg-surface px-1.5 py-0.5 text-[11px] font-medium text-text-3">Ctrl K</kbd>
      </label>
      {open && results.length > 0 && (
        <ul className="card absolute inset-x-0 top-12 z-30 p-1.5 shadow-e2">
          {results.map((r) => (
            <li key={r.href}>
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => go(r.href)}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-alt"
              >
                {r.label}<span className="text-xs text-text-3">{r.kind}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export const Topbar: React.FC = () => {
  const { role, isDevPreview } = useAuth();
  const health = useHealth();
  const alerts = health.data?.data.sources.filter((s) => s.state !== 'HEALTHY').length ?? 0;

  return (
    <header className="card flex items-center gap-3 rounded-[26px] px-4 py-3 sm:px-5">
      <SearchBox />
      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        {USE_MOCK && <MockControlsPanel />}
        {isDevPreview && (
          <span className="hidden whitespace-nowrap rounded-full border border-line px-3 py-1 text-xs font-medium text-text-2 xl:inline" title="NEXT_PUBLIC_AUTH_DEV_ROLE (next dev only)">
            Dev preview
          </span>
        )}
        <a
          href={hasRole(role, 'ANALYST') ? '/health/' : undefined}
          className="relative grid size-11 place-items-center rounded-full bg-surface-alt text-text-2"
          aria-label={alerts ? `${alerts} source alert${alerts > 1 ? 's' : ''}` : 'No alerts'}
        >
          <Bell size={19} aria-hidden />
          {alerts > 0 && (
            <span className="absolute right-2 top-2 grid size-4 place-items-center rounded-full bg-status-warning text-[10px] font-bold text-black">
              {alerts}
            </span>
          )}
        </a>
        <ProfileMenu />
      </div>
    </header>
  );
};
