'use client';

import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { hasRole, useAuth } from '@/lib/auth/AuthProvider';
import { navItemFor } from '@/lib/nav';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { AccessPending, FullPageLoading, NotAvailable } from './Gates';

/**
 * Auth gate + layout. Signed-out users go to /login; users without a role see
 * "access pending"; pages above the user's role render "not available" (they are
 * also left out of the navigation).
 */
export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { status, role } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const onLogin = pathname.startsWith('/login');

  useEffect(() => {
    if ((status === 'signed-out' || status === 'unconfigured') && !onLogin) router.replace('/login/');
    if ((status === 'ready' || status === 'no-role') && onLogin) router.replace('/');
  }, [status, onLogin, router]);

  if (onLogin) return <>{children}</>;
  if (status === 'loading' || status === 'signed-out' || status === 'unconfigured') return <FullPageLoading />;
  if (status === 'no-role') return <AccessPending />;

  const page = navItemFor(pathname);
  const allowed = !page || hasRole(role, page.minRole);

  return (
    <div className="flex min-h-screen gap-4 p-4 max-lg:flex-col">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <Topbar />
        <main className="card flex-1 rounded-[26px] p-5 sm:p-7" id="main">
          {allowed ? children : <NotAvailable page={page!.label} />}
        </main>
      </div>
    </div>
  );
};
