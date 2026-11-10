import path from 'node:path';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

// Basic hardening headers for every page. No Content-Security-Policy yet: it needs per-request nonces for Next's inline scripts.
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const nextConfig: NextConfig = {
  // A self-contained server (.next/standalone) so the Docker image carries only what it runs, not the whole
  // node_modules of the monorepo. `outputFileTracingRoot` points at the repo root: without it Next traces from
  // apps/web and misses files that live in packages/shared or the hoisted pnpm store.
  output: 'standalone',
  outputFileTracingRoot: path.join(process.cwd(), '..', '..'),
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  cacheComponents: true,
  experimental: {
    // Root layout lives under [locale], so unmatched URLs need an explicit app-level 404 page.
    globalNotFound: true,
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
};

export default withNextIntl(nextConfig);
