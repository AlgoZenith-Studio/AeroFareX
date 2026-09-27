import type { NextConfig } from 'next';

/**
 * Static export: the portal is a client-rendered app (Firebase Auth runs in the
 * browser, data comes from the API or the mock layer), so it deploys to Firebase
 * Hosting as plain files.
 */
const config: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  transpilePackages: ['@aerofarex/shared-types'],
  reactStrictMode: true,
  // Don't write AGENTS.md / CLAUDE.md into the project on `next dev`.
  agentRules: false,
  // No floating Next.js dev badge over the sidebar.
  devIndicators: false,
};

export default config;
