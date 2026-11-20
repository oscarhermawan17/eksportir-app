import { existsSync, readFileSync } from 'node:fs';
import { parse } from 'dotenv';
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

/**
 * Which database the e2e tests may use. The tests create and delete users, orders and payments, so they must never
 * reach a database anyone cares about — and on a developer's laptop DATABASE_URL may well be a tunnel to the testing
 * server. Outside CI the tests therefore run only against E2E_DATABASE_URL, a local database whose name ends in
 * `_test` (created by `pnpm db:test:prepare`), and refuse to start otherwise. CI sets DATABASE_URL to its own
 * throwaway service container and is left alone.
 */
function e2eDatabaseUrl(): string | undefined {
  if (process.env.CI) return undefined;
  const fromFile = existsSync('.env') ? parse(readFileSync('.env')) : {};
  const url = process.env.E2E_DATABASE_URL ?? fromFile.E2E_DATABASE_URL;
  const problem = 'Set E2E_DATABASE_URL in apps/api/.env to the local test database (see .env.example, then run pnpm db:test:prepare).';
  if (!url) throw new Error(`E2E tests refused to start: E2E_DATABASE_URL is missing. ${problem}`);
  const parsed = new URL(url);
  const database = parsed.pathname.replace(/^\//, '');
  if (!['localhost', '127.0.0.1'].includes(parsed.hostname) || !database.endsWith('_test')) {
    throw new Error(`E2E tests refused to start: E2E_DATABASE_URL must be a local database named *_test. ${problem}`);
  }
  return url;
}

const databaseUrl = e2eDatabaseUrl();

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // Set in the test process before the app loads its .env; dotenv and ConfigModule never override an existing variable.
    env: databaseUrl ? { DATABASE_URL: databaseUrl } : {},
    // These tests drive a real HTTP server and a real database, and some walk an order through a dozen
    // requests. Vitest's 5s default is a performance assertion in disguise: it fails on a busy laptop or a
    // CI runner while the behaviour under test is perfectly correct. The timeout is a guard against a hang.
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
