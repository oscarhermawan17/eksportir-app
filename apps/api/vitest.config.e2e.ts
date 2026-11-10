import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // These tests drive a real HTTP server and a real database, and some walk an order through a dozen
    // requests. Vitest's 5s default is a performance assertion in disguise: it fails on a busy laptop or a
    // CI runner while the behaviour under test is perfectly correct. The timeout is a guard against a hang.
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
