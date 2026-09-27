'use client';

import React, { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { ChevronDown, KeyRound, LogOut, RefreshCw, ShieldCheck } from 'lucide-react';
import type { Role } from '@aerofarex/shared-types';
import { hasRole, useAuth } from '@/lib/auth/AuthProvider';
import { NAV } from '@/lib/nav';

const ROLE_INFO: Record<Role, string> = {
  VIEWER: 'Not a dashboard role. Public users use the AeroFareX website.',
  ANALYST: 'Full analyst access: indices, attribution, routes, quality, source health, audit records and exports.',
  ADMIN: 'Full analyst access. Admin tools (user approvals, revision publishing) are coming later.',
};

/** Profile panel: who you are, what your role lets you see, and sign out. */
export const ProfileMenu: React.FC = () => {
  const { user, role, isDevPreview, signOut, refreshRole } = useAuth();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  if (!user || !role) return null;
  const initials = user.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const pages = NAV.filter((n) => hasRole(role, n.minRole)).map((n) => n.label);
  const avatar = (size: string) => user.photoURL ? (
    <img src={user.photoURL} alt="" className={clsx(size, 'rounded-full object-cover')} />
  ) : (
    <span className={clsx(size, 'grid place-items-center rounded-full bg-sky-300 text-sm font-bold text-black')} aria-hidden>{initials}</span>
  );

  return (
    <div ref={box} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="flex items-center gap-3 rounded-full py-1 pl-1 pr-2 hover:bg-surface-alt"
      >
        {avatar('size-11')}
        <span className="hidden whitespace-nowrap text-left leading-tight xl:block">
          <span className="block text-[15px] font-medium">{user.name}</span>
          <span className="block text-xs text-text-3">{role.toLowerCase()}</span>
        </span>
        <ChevronDown size={16} className={clsx('hidden text-text-3 transition-transform xl:block', open && 'rotate-180')} aria-hidden />
      </button>

      {open && (
        <div role="dialog" aria-label="Your profile" className="card absolute right-0 top-14 z-40 w-80 overflow-hidden p-0 shadow-e3">
          <div className="flex items-center gap-3 p-5" style={{ background: 'var(--bg-sky-200)' }}>
            {avatar('size-12')}
            <div className="min-w-0">
              <p className="font-display truncate text-[17px]">{user.name}</p>
              <p className="truncate text-xs text-text-2">{user.email}</p>
            </div>
          </div>

          <dl className="flex flex-col gap-3 p-5 text-sm">
            <div>
              <dt className="eyebrow">Role</dt>
              <dd className="mt-1.5 flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-sky-200 px-2.5 py-0.5 text-xs font-bold text-black">
                  <ShieldCheck size={13} aria-hidden /> {role}
                </span>
              </dd>
              <dd className="mt-1.5 text-xs text-text-2">{ROLE_INFO[role]}</dd>
            </div>
            <div>
              <dt className="eyebrow">Pages you can open</dt>
              <dd className="mt-1.5 text-xs text-text-2">{pages.join(' · ')}</dd>
            </div>
            <div>
              <dt className="eyebrow">Sign-in</dt>
              <dd className="mt-1.5 flex items-center gap-1.5 text-xs text-text-2">
                <KeyRound size={13} aria-hidden /> {user.method}
                {user.lastSignIn && <> · last signed in {new Date(user.lastSignIn).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</>}
              </dd>
            </div>
          </dl>

          <div className="flex gap-2 border-t border-line p-4">
            {!isDevPreview && (
              <button onClick={() => void refreshRole()} className="btn btn-outline h-10 flex-1 justify-center px-3 text-sm" title="Reload your role after an admin changes it">
                <RefreshCw size={15} aria-hidden /> Refresh role
              </button>
            )}
            <button onClick={() => { setOpen(false); void signOut(); }} className="btn btn-dark h-10 flex-1 justify-center px-3 text-sm">
              <LogOut size={15} aria-hidden /> Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
