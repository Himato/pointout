import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    restoreMocks: true,
    env: { POINTOUT_LOG: 'silent' },
  },
});
