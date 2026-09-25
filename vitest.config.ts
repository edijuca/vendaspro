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
  },
});
