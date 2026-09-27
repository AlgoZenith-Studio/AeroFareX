'use client';

import React from 'react';
import Link from 'next/link';
import { Hourglass, Lock } from 'lucide-react';
import { useAuth } from '@/lib/auth/AuthProvider';

export const FullPageLoading: React.FC = () => (
  <div className="grid min-h-screen place-items-center" role="status" aria-live="polite">
    <div className="flex items-center gap-3 text-text-2">
      <img src="/logo-mark.png" alt="" width={36} height={36} className="animate-pulse rounded-[10px]" />
      Loading the portal…
    </div>
  </div>
);

export const AccessPending: React.FC = () => {
  const { user, signOut, refreshRole } = useAuth();
  return (
    <div className="grid min-h-screen place-items-center p-6">
      <div className="card max-w-md p-8 text-center">
        <Hourglass className="mx-auto text-sky-800" size={32} aria-hidden />
        <h1 className="mt-4 text-2xl">Access request pending</h1>
        <p className="mt-2 text-text-2">
          You’re signed in as <b>{user?.email}</b>. The analyst dashboard holds official statistics, so every
          account is approved by an AeroFareX admin before it can open. You’ll get access as soon as it’s approved.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <button className="btn btn-primary" onClick={() => void refreshRole()}>I’ve been approved</button>
          <button className="btn btn-outline" onClick={() => void signOut()}>Sign out</button>
        </div>
      </div>
    </div>
  );
};

export const NotAvailable: React.FC<{ page: string }> = ({ page }) => (
  <div className="grid min-h-[60vh] place-items-center text-center">
    <div className="max-w-sm">
      <Lock className="mx-auto text-text-3" size={30} aria-hidden />
      <h1 className="mt-4 text-2xl font-medium">{page} isn’t available for your role</h1>
      <p className="mt-2 text-text-2">This page needs analyst access. Ask an admin if you need it.</p>
      <Link href="/" className="btn btn-outline mt-6">Back to overview</Link>
    </div>
  </div>
);
