import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  external: ['vite', 'rollup'],
  target: 'es2020',
  platform: 'node',
  outExtension({ format }) {
    return {
      js: `${format === 'esm' ? '.mjs' : '.cjs'}`,
    };
  },
  esbuildOptions(options) {
    // 添加 banner 信息
    options.banner = {
      js: `/*! My Vite Plugin v0.0.0 | MIT License */`,
    };
  },
});
