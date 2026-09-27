'use client';

import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/lib/auth/AuthProvider';
import { AppShell } from '@/components/shell/AppShell';

export const Providers: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [client] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 5 * 60_000, retry: 1, refetchOnWindowFocus: false } },
  }));
  return (
    <QueryClientProvider client={client}>
      <AuthProvider>
        <AppShell>{children}</AppShell>
      </AuthProvider>
    </QueryClientProvider>
  );
};
