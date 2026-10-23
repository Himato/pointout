import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { index: 'src/index.ts', format: 'src/format-entry.ts' },
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'es2022',
  minify: false,
  treeshake: true,
  tsconfig: 'tsconfig.build.json',
});
