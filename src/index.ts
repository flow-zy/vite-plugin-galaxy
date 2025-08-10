import { Plugin } from 'vite'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { parse } from 'es-module-lexer'
import glob from 'fast-glob'
import pc from 'picocolors'

export default function galaxy(): Plugin {
  let nodes: any[] = []
  let links: any[] = []

  return {
    name: 'galaxy',
    async buildStart() {
      // 1. 收集所有 .js/.ts/.vue
      const files = await glob(['src/**/*.{js,ts,vue}'], { cwd: process.cwd() })
      const idMap = new Map<string, number>()

      files.forEach((f, idx) => idMap.set(f, idx))

      nodes = files.map((f, idx) => ({
        id: idx,
        name: f,
        val: 1,
      }))

      // 2. 简易依赖解析
      for (const f of files) {
        const code = readFileSync(resolve(process.cwd(), f), 'utf-8')
        try {
          const [, exports] = parse(code)
          exports.forEach((e) => {
            const dep = e.n
            if (dep && idMap.has(dep)) {
              links.push({
                source: idMap.get(f),
                target: idMap.get(dep),
              })
            }
          })
        } catch {}
      }

      console.log(pc.green(`📦 已扫描 ${nodes.length} 个模块，${links.length} 条依赖`))
    },
    configureServer(server) {
      // 3. 把数据挂到 /__galaxy
      server.middlewares.use('/__galaxy', (_req, res) => {
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ nodes, links }))
      })
    },
  }
}