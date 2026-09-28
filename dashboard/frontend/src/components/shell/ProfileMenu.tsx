'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import {
  ChevronDown,
  KeyRound,
  LogOut,
  RefreshCw,
  ShieldCheck,
  CheckCircle2,
  Zap,
} from 'lucide-react';
import type { Role } from '@aerofarex/shared-types';
import { hasRole, useAuth } from '@/lib/auth/AuthProvider';
import { NAV } from '@/lib/nav';

const ROLE_CAPABILITIES: Record<Role, { title: string; desc: string; perks: string[] }> = {
  VIEWER: {
    title: 'Public Visitor',
    desc: 'Public viewer privileges only.',
    perks: ['Public Fare Search'],
  },
  ANALYST: {
    title: 'Analyst Workspace',
    desc: 'Full access to pricing indices, route decomposition, and audit records.',
    perks: ['Indices & Attribution', 'Quality Audit & Health', 'Raw Data Export'],
  },
  ADMIN: {
    title: 'System Administrator',
    desc: 'Full analyst capability plus administrative controls and specs publishing.',
    perks: ['Full Index & Quality Access', 'Admin Controls', 'Spec Revision Publishing'],
  },
};

/** Profile panel: who you are, what your role lets you see, and sign out. */
export const ProfileMenu: React.FC = () => {
  const { user, role, isDevPreview, signOut, refreshRole } = useAuth();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!user || !role) return null;

  const initials = user.name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const accessibleNav = NAV.filter((n) => hasRole(role, n.minRole));
  const roleCap = ROLE_CAPABILITIES[role] || ROLE_CAPABILITIES.ANALYST;

  const renderAvatar = (sizeClass: string, isHeader = false) => {
    if (user.photoURL) {
      return (
        <img
          src={user.photoURL}
          alt={user.name}
          className={clsx(sizeClass, 'rounded-full object-cover ring-2 ring-white/80 shadow-xs')}
        />
      );
    }
    return (
      <div
        className={clsx(
          sizeClass,
          'grid place-items-center rounded-full font-bold shadow-md transition-transform',
          isHeader
            ? 'bg-gradient-to-br from-sky-600 via-sky-500 to-indigo-600 text-white ring-2 ring-white/90'
            : 'bg-sky-300 text-black',
        )}
        aria-hidden
      >
        {initials}
      </div>
    );
  };

  return (
    <div ref={box} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={clsx(
          'flex items-center gap-2.5 rounded-full p-1.5 transition-all duration-200 select-none cursor-pointer',
          open ? 'bg-surface-alt ring-2 ring-sky-400/40' : 'hover:bg-surface-alt',
        )}
      >
        <div className="relative">
          {renderAvatar('size-9')}
          <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full bg-emerald-500 ring-2 ring-white" />
        </div>
        <span className="hidden whitespace-nowrap text-left leading-tight xl:block pr-1 select-none">
          <span className="block text-[14px] font-bold text-text-1 select-none">{user.name}</span>
          <span className="block text-[11px] font-semibold tracking-wider text-text-3 uppercase select-none">
            {role.toLowerCase()}
          </span>
        </span>
        <ChevronDown
          size={15}
          className={clsx('hidden text-text-3 transition-transform duration-200 xl:block', open && 'rotate-180')}
          aria-hidden
        />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Your profile"
          className="absolute right-0 top-13 z-50 w-[350px] overflow-hidden rounded-3xl border border-line bg-surface p-0 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200 select-none"
        >
          {/* Header Banner */}
          <div className="relative border-b border-line/60 bg-gradient-to-br from-sky-400/30 via-sky-200/40 to-sky-100/20 p-5 backdrop-blur-md">
            <div className="flex items-center gap-3.5">
              <div className="relative shrink-0">
                {renderAvatar('size-12', true)}
                <span className="absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full bg-emerald-500 ring-2 ring-white shadow-xs">
                  <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75" />
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <h3 className="font-display truncate text-[17px] font-bold text-text-1">{user.name}</h3>
                  <span className="inline-flex items-center gap-1 rounded-md bg-white/80 px-1.5 py-0.5 text-[10px] font-bold text-sky-900 shadow-2xs">
                    <Zap size={10} className="text-sky-600 fill-sky-600" /> Active
                  </span>
                </div>
                <p className="truncate text-xs font-medium text-text-2">{user.email}</p>
              </div>
            </div>
          </div>

          {/* Body Content */}
          <div className="flex flex-col gap-4 p-5 text-sm">
            {/* Role & Permissions Box */}
            <div className="rounded-2xl border border-line/80 bg-surface-alt/50 p-3.5">
              <div className="flex items-center justify-between">
                <span className="eyebrow text-[10px] tracking-widest text-text-3">Role & Access</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-sky-900 px-2.5 py-0.5 text-[11px] font-bold text-white shadow-xs">
                  <ShieldCheck size={12} className="text-sky-300" aria-hidden /> {role}
                </span>
              </div>
              <p className="mt-2 text-xs font-medium text-text-2 leading-relaxed">{roleCap.desc}</p>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {roleCap.perks.map((perk, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 rounded-lg bg-surface px-2 py-0.5 text-[11px] font-semibold text-text-1 border border-line/50"
                  >
                    <CheckCircle2 size={11} className="text-emerald-500" /> {perk}
                  </span>
                ))}
              </div>
            </div>

            {/* Interactive Page Shortcuts */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="eyebrow text-[10px] tracking-widest text-text-3">Pages You Can Open</span>
                <span className="text-[11px] font-bold text-sky-800">
                  <span className="num">{accessibleNav.length}</span> Pages
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {accessibleNav.map((n) => {
                  const Icon = n.icon;
                  return (
                    <Link
                      key={n.href}
                      href={n.href}
                      onClick={() => setOpen(false)}
                      className="group flex items-center gap-2 rounded-xl border border-line/60 bg-surface px-2.5 py-2 text-xs font-semibold text-text-1 hover:border-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/40 hover:text-sky-900 transition-all duration-150 shadow-2xs"
                    >
                      <span className="grid size-6 place-items-center rounded-lg bg-sky-100 text-sky-800 group-hover:bg-sky-500 group-hover:text-white transition-colors">
                        <Icon size={13} />
                      </span>
                      <span className="truncate">{n.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Authentication Details */}
            <div className="rounded-xl border border-line/50 bg-surface p-3 text-xs">
              <div className="flex items-center justify-between text-text-3 font-semibold mb-1">
                <span className="flex items-center gap-1 text-[11px]">
                  <KeyRound size={12} className="text-sky-600" aria-hidden /> Session Method
                </span>
                <span className="font-bold text-text-1">{user.method}</span>
              </div>
              {user.lastSignIn && (
                <p className="text-[11px] text-text-3 mt-1">
                  Last login:{' '}
                  <span className="font-medium text-text-2">
                    {new Date(user.lastSignIn).toLocaleString('en-IN', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </span>
                </p>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 border-t border-line/80 bg-surface-alt/30 p-4">
            {!isDevPreview && (
              <button
                onClick={() => void refreshRole()}
                className="btn btn-outline h-10 flex-1 justify-center rounded-2xl text-xs font-bold"
                title="Reload your role credentials"
              >
                <RefreshCw size={14} aria-hidden /> Refresh Role
              </button>
            )}
            <button
              onClick={() => {
                setOpen(false);
                void signOut();
              }}
              className="btn btn-dark h-10 w-full justify-center rounded-2xl text-xs font-bold shadow-md hover:bg-black/90 transition-all"
            >
              <LogOut size={14} aria-hidden /> Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

