import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/providers.ts', 'src/always.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'es2022',
  minify: false,
  treeshake: true,
  splitting: true,
  external: ['@point-out/core', '@angular/core', '@angular/router'],
  tsconfig: 'tsconfig.build.json',
});
