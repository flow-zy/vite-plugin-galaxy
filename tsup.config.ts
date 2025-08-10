import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'client/main': 'src/client/main.ts',
    'client/renderer': 'src/client/renderer.ts',
    'core/collect': 'src/core/collect.ts',
    'core/graph': 'src/core/graph.ts',
    'core/ghost': 'src/core/ghost.ts',
    'server/index': 'src/server/index.ts',
    'prod-report': 'src/prod-report.ts'
  },
  format: ['esm', 'cjs'],
  dts: true,
  splitting: true,
  sourcemap: true,
  clean: true,
  minify: process.env.CI === 'true',
  external: ['vite', 'three', 'canvas'] // 让宿主项目复用
})