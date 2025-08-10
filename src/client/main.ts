import { GalaxyRenderer } from './renderer'
import type { GraphJSON, GraphNode } from './types'
import * as THREE from 'three'
interface ImportMeta {
  hot?: {
    on: (event: string, callback: () => void) => void
  }
}

// 自定义颜色映射函数
function customColorMapper(node: GraphNode) {
  // 根据修改时间着色 (最近修改的为绿色， oldest的为红色)
  const now = Date.now()
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000
  const relativeTime = Math.max(0, Math.min(1, (node.mtime - weekAgo) / (now - weekAgo)))
  const r = Math.floor(255 * (1 - relativeTime))
  const g = Math.floor(255 * relativeTime)
  return `rgb(${r}, ${g}, 0)`
}

// 自定义形状映射
const customShapeMapper = {
  util: new THREE.BoxGeometry(1, 1, 1),
  ui: new THREE.CylinderGeometry(0.5, 0.5, 1, 6),
  lib: new THREE.TorusGeometry(0.5, 0.2, 8, 16),
  other: new THREE.SphereGeometry(0.7, 16, 16)
}

async function fetchGraph() {
  return fetch('/__deps3d/api').then(r => r.json())
}

async function init() {
  const graphData: GraphJSON = await fetchGraph()

  // 创建渲染器
  const container = document.body
  const renderer = new GalaxyRenderer(container, {
    backgroundColor: '#0a0a1a',
    nodeColors: {
      default: '#00ffff',
      ghost: '#ff00ff',
      large: '#ffff00'
    },
    sensitivity: 1.2,
    enableVR: true,
    LODThreshold: 5000
  })

  // 设置自定义映射
  renderer.setColorMapper(customColorMapper)
  // renderer.setShapeMapper(customShapeMapper) // 可选：启用自定义形状

  // 渲染节点和边
  renderer.renderNodes(graphData.nodes)
  renderer.renderEdges(graphData.edges, graphData.nodes)

  // 启动动画循环
  renderer.startAnimationLoop()

  // HMR
  if (import.meta.hot) {
    import.meta.hot.on('galaxy:update', async () => {
      const newGraphData = await fetchGraph()
      renderer.renderNodes(newGraphData.nodes)
      renderer.renderEdges(newGraphData.edges, newGraphData.nodes)
    })
  }

  // 清理函数
  return () => {
    renderer.dispose()
  }
}

// 初始化并处理清理
let cleanup: () => void
init().then(c => { cleanup = c })

// 监听页面卸载
window.addEventListener('beforeunload', () => {
  if (cleanup) cleanup()
})