import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { Canvas, createCanvas } from 'canvas'
import { graphCache } from './core/collect'
import type { GraphNode, GraphEdge } from './client/types'

// 渲染4K海报
export async function renderPoster(outputDir: string) {
  // 确保输出目录存在
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true })
  }

  // 创建Canvas
  const width = 3840
  const height = 2160
  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')

  // 绘制背景
  ctx.fillStyle = '#0a0a1a'
  ctx.fillRect(0, 0, width, height)

  // 简化的星系图绘制
  if (graphCache.nodes && graphCache.edges) {
    // 绘制边
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
    ctx.lineWidth = 1
    graphCache.edges.forEach(edge => {
      const source = graphCache.nodes.find(n => n.id === edge.source)
      const target = graphCache.nodes.find(n => n.id === edge.target)
      if (source && target) {
        // 简化：将节点ID映射到画布坐标
        const sourceX = (Math.sin(source.id.length) * 1000) + width / 2
        const sourceY = (Math.cos(source.id.length) * 1000) + height / 2
        const targetX = (Math.sin(target.id.length) * 1000) + width / 2
        const targetY = (Math.cos(target.id.length) * 1000) + height / 2

        ctx.beginPath()
        ctx.moveTo(sourceX, sourceY)
        ctx.lineTo(targetX, targetY)
        ctx.stroke()
      }
    })

    // 绘制节点
    graphCache.nodes.forEach(node => {
      // 根据节点大小确定半径
      const radius = Math.max(2, Math.cbrt(node.size) / 10)

      // 根据节点类型确定颜色
      let color
      if (graphCache.ghosts.includes(node.id)) {
        color = '#ff00ff'
      } else if (node.size > 10000) {
        color = '#ffff00'
      } else {
        color = '#00ffff'
      }

      // 简化：将节点ID映射到画布坐标
      const x = (Math.sin(node.id.length) * 1000) + width / 2
      const y = (Math.cos(node.id.length) * 1000) + height / 2

      // 绘制节点
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, Math.PI * 2)
      ctx.fillStyle = color
      ctx.fill()
    })
  }

  // 添加图例
  ctx.fillStyle = '#ffffff'
  ctx.font = '30px Arial'
  ctx.fillText('Vite Plugin Galaxy - Dependency Visualization', 50, 50)

  // 保存图像
  const outputPath = join(outputDir, 'galaxy-poster.png')
  const buffer = canvas.toBuffer('image/png')
  writeFileSync(outputPath, buffer)
  console.log(`Galaxy poster saved to ${outputPath}`)
}

// 写入JSON数据
export function writeJSON(outputDir: string) {
  // 确保输出目录存在
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true })
  }

  const outputPath = join(outputDir, 'deps.json')
  writeFileSync(outputPath, JSON.stringify(graphCache, null, 2))
  console.log(`Dependency JSON saved to ${outputPath}`)
}