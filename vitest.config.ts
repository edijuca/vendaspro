import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['server/tests/**/*.test.ts'],
    fileParallelism: false,
    env: {
      JWT_SECRET: 'vendaspro-test-secret',
      VP_SEED_PASSWORD: 'TestAdmin123!',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      linesThreshold: 50,
      functionsThreshold: 40,
      branchesThreshold: 30,
      exclude: [
        'server/index.ts',
        'server/db.ts',
        'server/middleware.ts',
        'server/utils/**',
        'server/tests/**',
      ],
    },
  },
});
