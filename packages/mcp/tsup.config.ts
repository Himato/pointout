import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/cli.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node20',
  banner: { js: '#!/usr/bin/env node' },
  dts: false,
  sourcemap: true,
  clean: true,
  external: ['@modelcontextprotocol/sdk', 'zod', '@point-out/core'],
});
