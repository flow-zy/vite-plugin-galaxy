/// <reference types="rollup" />
import type { ViteDevServer } from 'vite';
// 使用rollup内置类型
import type { PluginContext } from 'rollup';

/**
 * 依赖节点接口
 */
export interface DependencyNode {
  id: string;
  name: string;
  version: string;
  size: number;
  depth: number;
  isGhost: boolean;
  isLarge: boolean;
  lastUpdated: number;
  dependencies: string[];
  type: 'util' | 'ui' | 'lib' | 'other';
}

/**
 * 依赖图接口
 */
export interface DependencyGraph {
  nodes: DependencyNode[];
  edges: { source: string; target: string }[];
}

/**
 * 性能优化配置选项
 */
export interface PerformanceOptions {
  /**
   * 视锥剔除启用状态
   */
  enableFrustumCulling: boolean;
  /**
   * LOD (Level of Detail) 启用状态
   */
  enableLOD: boolean;
  /**
   * LOD 距离阈值，从小到大对应高、中、低细节
   */
  lodLevels: [number, number, number];
  /**
   * 内存清理间隔（毫秒）
   */
  cleanupInterval: number;
  /**
   * 节点细节简化级别
   */
  detailLevels: {
    high: number;
    medium: number;
    low: number;
  };
}

/**
 * 可视化配置选项
 */
export interface VisualOptions {
  backgroundColor: string;
  nodeColors: {
    default: string;
    ghost: string;
    large: string;
  };
  sensitivity: number;
  enableVR: boolean;
  // 更多可视化选项可以在这里添加
}

/**
 * 输出配置选项
 */
export interface OutputOptions {
  json: string;
  image: string;
  resolution: {
    width: number;
    height: number;
  };
}

/**
 * 插件配置选项
 */
export interface GalaxyOptions {
  exclude: RegExp[];
  alias: Record<string, string>;
  output: OutputOptions;
  visual: VisualOptions;
  /**
   * 性能优化配置
   */
  performance: Partial<PerformanceOptions>;
  // 扩展钩子
  colorMapper?: (node: DependencyNode) => string;
  shapeMapper?: (node: DependencyNode) => 'sphere' | 'cube' | 'torus' | 'custom';
}

/**
 * 依赖采集器接口
 */
export interface DependencyCollector {
  collect(context: PluginContext, options: GalaxyOptions): Promise<DependencyGraph>;
  detectGhostDependencies(graph: DependencyGraph, packageJson: Record<string, any>): DependencyNode[];
}

/**
 * 开发服务器接口
 */
export interface DevServerSetup {
  setup(server: ViteDevServer, options: GalaxyOptions): void;
}

/**
 * 报告生成器接口
 */
export interface ReportGenerator {
  generate(graph: DependencyGraph, options: GalaxyOptions): Promise<void>;
  generateImage(graph: DependencyGraph, options: GalaxyOptions): Promise<string>;
  generateJson(graph: DependencyGraph, options: GalaxyOptions): Promise<string>;
}