import * as THREE from 'three'

// 自定义类型规则
interface TypeRule {
  pattern: RegExp
  type: string
}

// 服务器配置
interface ServerConfig {
  apiPath?: string
  viewPath?: string
}

// HMR配置
interface HmrConfig {
  fullReload?: boolean
}

// 图表配置
interface GraphConfig {
  maxDepth?: number
}

// 分类配置
interface ClassificationConfig {
  customTypeRules?: TypeRule[]
}

// 输出配置
interface OutputConfig {
  json?: string
  image?: string
  resolution?: {
    width: number
    height: number
  }
}

// 性能配置
interface PerformanceConfig {
  enableFrustumCulling?: boolean
  LODThreshold?: number
}

// 可视化配置
interface VisualConfig {
  backgroundColor: string
  nodeColors: {
    default: string
    ghost: string
    large: string
  }
  sensitivity: number
  enableVR: boolean
}

// 插件选项
export interface GalaxyOptions {
  exclude?: RegExp[]
  alias?: Record<string, string>
  output?: OutputConfig
  visual?: VisualConfig
  performance?: PerformanceConfig
  server?: ServerConfig
  classification?: ClassificationConfig
  graph?: GraphConfig
  hmr?: HmrConfig
  onNodeClick?: (node: GraphNode) => void
}

// 依赖图类型
export interface GraphNode {
  id: string
  size: number
  depth: number
  mtime: number
  type?: 'util' | 'ui' | 'lib' | 'other'
  team?: string
}

export interface GraphEdge {
  source: string
  target: string
}

export interface GraphJSON {
  nodes: GraphNode[]
  edges: GraphEdge[]
  ghosts: string[]
}

// 渲染器配置
export interface RendererConfig {
  backgroundColor: string
  nodeColors: {
    default: string
    ghost: string
    large: string
  }
  sensitivity: number
  enableVR: boolean
  LODThreshold: number
}

// 自定义钩子
export type ColorMapper = (node: GraphNode) => string

export interface ShapeMapper {
  [key: string]: THREE.BufferGeometry
}