import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    testTimeout: 180_000,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    hookTimeout: 180_000,
    include: ['integration/**/*.test.ts', 'broker-contracts/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
    },
  },
});
