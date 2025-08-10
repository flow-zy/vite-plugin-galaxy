import type { ViteDevServer, HmrContext } from 'vite'
import { readFileSync } from 'node:fs'
import { graphCache, collectGraph } from '../core/collect'
import type { GalaxyOptions } from '../client/types'

export function createServer(server: ViteDevServer, options: GalaxyOptions) {
  const { apiPath = '/__deps3d/api', viewPath = '/__deps3d' } = options.server || {}

  // 1. 静态 HTML
  server.middlewares.use(viewPath, (req, res) => {
    try {
      const html = readFileSync(new URL('../client/index.html', import.meta.url), 'utf8')
      res.setHeader('Content-Type', 'text/html')
      res.end(html)
    } catch (error) {
      console.error('Failed to read index.html:', error)
      res.statusCode = 500
      res.end('Failed to load galaxy visualization')
    }
  })

  // 2. JSON API
  server.middlewares.use(apiPath, (req, res) => {
    try {
      res.setHeader('Content-Type', 'application/json')
      // 发送完整的图数据和选项
      res.end(JSON.stringify({
        graph: graphCache,
        options: { ...options, server: undefined } // 不发送服务器配置
      }))
    } catch (error) {
      console.error('Failed to send graph data:', error)
      res.statusCode = 500
      res.end(JSON.stringify({ error: 'Failed to generate dependency graph' }))
    }
  })

  // 3. 添加服务器启动完成后的日志
  server.httpServer?.once('listening', () => {
    const address = server.httpServer?.address()
    const url = typeof address === 'string'
      ? address
      : address && `http://localhost:${address.port}`

    if (url) {
      console.log(`\n🚀 Vite Plugin Galaxy running at:\n- Visualization: ${url}${viewPath}\n- API: ${url}${apiPath}\n`)
    }
  })
}

export function hotUpdate(ctx: HmrContext, options: GalaxyOptions) {
  // 根据配置决定热更新策略
  if (options.hmr?.fullReload) {
    // 简单暴力：刷新全图
    ctx.server.ws.send({ type: 'custom', event: 'galaxy:update', data: { fullReload: true } })
  } else {
    // 增量更新：只更新变化的模块
    const updatedModule = ctx.file
    collectGraph(ctx.server.pluginContainer, options)
    ctx.server.ws.send({
      type: 'custom',
      event: 'galaxy:update',
      data: { updatedModule, graph: graphCache }
    })
  }
}