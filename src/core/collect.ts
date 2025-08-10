import { generateGraph } from './graph.js'
import type { GraphJSON, GalaxyOptions } from '../client/types'

export let graphCache: GraphJSON = { nodes: [], edges: [], ghosts: [] }

export async function collectGraph(ctx: PluginContext, options: GalaxyOptions = {}) {
  graphCache = await generateGraph(ctx, options)
}

// 导出旧接口以保持向后兼容性
export interface GraphNode {
  id: string
  size: number
  depth: number
  mtime: number
  type?: string
  team?: string
}

export interface GraphEdge {
  source: string
  target: string
}