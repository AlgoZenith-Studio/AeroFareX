'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { BookOpen, Download, LogOut } from 'lucide-react';
import { hasRole, useAuth } from '@/lib/auth/AuthProvider';
import { NAV, navItemFor, type NavItem } from '@/lib/nav';
import { downloadIndexCsv } from '@/lib/export';

const promoAction = 'mt-4 flex h-10 w-full items-center justify-center rounded-full bg-black text-sm font-bold text-white hover:opacity-85';

const NavLink: React.FC<{ item: NavItem; active: boolean }> = ({ item, active }) => {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={clsx(
        'relative flex items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2.5 text-[15px] transition-colors duration-base',
        active ? 'bg-surface-tint font-bold text-text-1' : 'text-text-2 hover:bg-surface-alt hover:text-text-1',
      )}
    >
      {active && <span className="absolute -left-5 top-1/2 h-8 w-1.5 -translate-y-1/2 rounded-r-full bg-sky-500" aria-hidden />}
      <Icon size={20} strokeWidth={active ? 2.4 : 1.8} className={active ? 'text-sky-900' : undefined} aria-hidden />
      {item.label}
    </Link>
  );
};

export const Sidebar: React.FC = () => {
  const pathname = usePathname();
  const { role, signOut } = useAuth();
  const current = navItemFor(pathname);
  const visible = NAV.filter((item) => hasRole(role, item.minRole));
  const group = (g: NavItem['group']) => visible.filter((item) => item.group === g);
  const analyst = hasRole(role, 'ANALYST');

  return (
    <aside className="card flex w-full shrink-0 flex-col rounded-[26px] px-5 py-6 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)] lg:min-h-[calc(100dvh-2rem)] lg:w-[250px] lg:overflow-y-auto">
      <Link href="/" className="block px-1" aria-label="AeroFareX overview">
        <img src="/logo-long.png" alt="AeroFareX: Real-Time Airfare Price Index for India" width={210} height={45} className="h-auto w-[210px]" />
      </Link>

      <nav aria-label="Portal" className="mt-8 mb-6 flex flex-col gap-6 max-lg:mt-5 max-lg:mb-0 max-lg:flex-row max-lg:gap-2 max-lg:overflow-x-auto">
        {(['menu', 'general'] as const).map((g) => (
          <div key={g}>
            <p className="eyebrow mb-3 px-1 max-lg:hidden">
              {g === 'menu' ? 'MENU' : 'GENERAL'}
            </p>
            <div className="flex flex-col gap-0.5 max-lg:flex-row">
              {group(g).map((item) => <NavLink key={item.href} item={item} active={current?.href === item.href} />)}
              {g === 'general' && (
                <button
                  onClick={signOut}
                  className="flex items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2.5 text-left text-[15px] text-text-3 hover:bg-surface-alt hover:text-text-1"
                >
                  <LogOut size={20} strokeWidth={1.8} aria-hidden /> Sign out
                </button>
              )}
            </div>
          </div>
        ))}
      </nav>

      {/* Promo slot from the reference layout: the one action each role needs most */}
      <div className="card-hero relative mt-auto shrink-0 overflow-hidden p-5 max-lg:hidden [@media(max-height:800px)]:hidden">
        <span className="grid size-9 place-items-center rounded-full bg-white/60" aria-hidden>
          {analyst ? <Download size={17} /> : <BookOpen size={17} />}
        </span>
        <p className="font-display mt-4 text-[17px] leading-snug">
          {analyst ? 'Export today’s index' : 'How the index works'}
        </p>
        <p className="mt-1 text-xs text-text-2">
          {analyst ? 'All three series, with provenance' : 'Formulas, weights and data rules'}
        </p>
        {analyst ? (
          <button onClick={() => void downloadIndexCsv()} className={promoAction}>Download CSV</button>
        ) : (
          <Link href="/methodology/" className={promoAction}>Read methodology</Link>
        )}
      </div>
    </aside>
  );
};
