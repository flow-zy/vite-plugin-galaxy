import type { Plugin } from 'vite'
import { collectGraph } from './core/collect.js'
import { createServer, hotUpdate } from './server/index.js'
import { renderPoster, writeJSON } from './prod-report.js'
import type { GalaxyOptions } from './client/types'

export default function galaxy(opts: GalaxyOptions = {}): Plugin {
  // 合并默认选项
  const mergedOptions = {
    exclude: [],
    alias: {},
    output: {
      json: 'deps.json',
      image: 'galaxy-poster.png',
      resolution: { width: 3840, height: 2160 }
    },
    visual: {
      backgroundColor: '#0a0a1a',
      nodeColors: {
        default: '#00ffff',
        ghost: '#ff00ff',
        large: '#ffff00'
      },
      sensitivity: 1.0,
      enableVR: false
    },
    performance: {
      enableFrustumCulling: true,
      LODThreshold: 10000
    },
    ...opts
  }

  return {
    name: 'vite:galaxy',
    buildStart() {
      collectGraph(this, mergedOptions)
    },
    configureServer(server) {
      createServer(server, mergedOptions)
    },
    handleHotUpdate(ctx) {
      return hotUpdate(ctx, mergedOptions)
    },
    async writeBundle({ dir }, _bundle) {
      const outputDir = dir || process.cwd()
      await renderPoster(outputDir, mergedOptions)
      writeJSON(outputDir, mergedOptions)
    }
  }
}