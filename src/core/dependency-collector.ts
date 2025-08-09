import type { PluginContext } from 'rollup';
import type { ModuleNode } from 'vite';
import fs from 'fs';
import path from 'path';
import { DependencyGraph, DependencyNode, GalaxyOptions } from '../types';

/**
 * 依赖采集器实现
 */
export class DependencyCollectorImpl {
  /**
   * 收集依赖信息并生成依赖图
   * @param context Vite 插件上下文
   * @param options 插件配置选项
   * @returns 依赖图对象
   */
  async collect(context: PluginContext, options: GalaxyOptions): Promise<DependencyGraph> {
    const nodes: DependencyNode[] = [];
    const edges: { source: string; target: string }[] = [];

    // 读取 package.json
    const packageJsonPath = path.resolve(context.root, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

    // 获取 Vite moduleGraph
    const moduleGraph = (context as any).getModuleGraph();
    const modules = Array.from(moduleGraph.getModules());

    // 收集模块信息
    for (const module of modules) {
      if (this.shouldExclude(module, options.exclude)) continue;

      const node = await this.createDependencyNode(module, context, options);
      if (node) {
        nodes.push(node);

        // 收集依赖关系
        for (const importee of module.importers) {
          if (this.shouldExclude(importee, options.exclude)) continue;

          const importeeNode = await this.createDependencyNode(importee, context, options);
          if (importeeNode) {
            edges.push({ source: node.id, target: importeeNode.id });
          }
        }
      }
    }

    // 检测幽灵依赖
    const ghostNodes = this.detectGhostDependencies({ nodes, edges }, packageJson);
    ghostNodes.forEach(node => {
      node.isGhost = true;
    });

    // 检测大型依赖 (体积超过 1MB)
    nodes.forEach(node => {
      if (node.size > 1024 * 1024) {
        node.isLarge = true;
      }
    });

    return { nodes, edges };
  }

  /**
   * 创建依赖节点
   * @param module Vite 模块节点
   * @param context 插件上下文
   * @param options 配置选项
   * @returns 依赖节点对象
   */
  private async createDependencyNode(
    module: ModuleNode,
    context: PluginContext,
    options: GalaxyOptions
  ): Promise<DependencyNode | null> {
    // 跳过虚拟模块和外部模块
    if (module.isVirtual || module.isExternal) return null;

    // 解析模块路径
    const resolvedId = module.id;
    if (!resolvedId) return null;

    // 获取模块信息
    const size = module.code?.length || 0;
    const depth = this.calculateDepth(resolvedId);
    const name = this.extractModuleName(resolvedId);
    const version = this.getModuleVersion(name, context.root);
    const lastUpdated = this.getLastUpdated(resolvedId);
    const type = this.determineModuleType(resolvedId);

    return {
      id: resolvedId,
      name,
      version,
      size,
      depth,
      isGhost: false,
      isLarge: false,
      lastUpdated,
      dependencies: module.importedIds.filter(id => !this.shouldExcludeById(id, options.exclude)),
      type,
    };
  }

  /**
   * 检测幽灵依赖
   * @param graph 依赖图
   * @param packageJson package.json 内容
   * @returns 幽灵依赖节点数组
   */
  detectGhostDependencies(graph: DependencyGraph, packageJson: Record<string, any>): DependencyNode[] {
    const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
    return graph.nodes.filter(node => {
      // 检查是否是 node_modules 中的依赖但未在 package.json 中声明
      return (
        node.id.includes('node_modules') &&
        !dependencies[node.name] &&
        !node.name.startsWith('.') &&
        !node.name.startsWith('/')
      );
    });
  }

  /**
   * 计算模块深度
   * @param id 模块 ID
   * @returns 模块深度
   */
  private calculateDepth(id: string): number {
    // 简单实现：根据路径中的斜杠数量计算深度
    return id.split('/').filter(segment => segment).length;
  }

  /**
   * 提取模块名称
   * @param id 模块 ID
   * @returns 模块名称
   */
  private extractModuleName(id: string): string {
    // 从路径中提取模块名称
    const match = id.match(/node_modules\/([^\/]+)/);
    if (match) return match[1];

    // 对于项目内模块，使用文件名
    return path.basename(id, path.extname(id));
  }

  /**
   * 获取模块版本
   * @param name 模块名称
   * @param root 项目根目录
   * @returns 模块版本
   */
  private getModuleVersion(name: string, root: string): string {
    try {
      const packageJsonPath = path.resolve(root, 'node_modules', name, 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      return packageJson.version || 'unknown';
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * 获取模块最后更新时间
   * @param id 模块 ID
   * @returns 最后更新时间戳
   */
  private getLastUpdated(id: string): number {
    try {
      const stats = fs.statSync(id);
      return stats.mtimeMs;
    } catch (error) {
      return Date.now();
    }
  }

  /**
   * 确定模块类型
   * @param id 模块 ID
   * @returns 模块类型
   */
  private determineModuleType(id: string): 'util' | 'ui' | 'lib' | 'other' {
    if (id.includes('ui') || id.includes('component')) return 'ui';
    if (id.includes('util') || id.includes('helper')) return 'util';
    if (id.includes('lib') || id.includes('library')) return 'lib';
    return 'other';
  }

  /**
   * 检查模块是否应该被排除
   * @param module 模块节点
   * @param excludePatterns 排除模式
   * @returns 是否应该排除
   */
  private shouldExclude(module: ModuleNode, excludePatterns: RegExp[]): boolean {
    return excludePatterns.some(pattern => pattern.test(module.id || ''));
  }

  /**
   * 根据 ID 检查是否应该排除
   * @param id 模块 ID
   * @param excludePatterns 排除模式
   * @returns 是否应该排除
   */
  private shouldExcludeById(id: string, excludePatterns: RegExp[]): boolean {
    return excludePatterns.some(pattern => pattern.test(id));
  }
}

/**
 * 创建依赖采集器实例
 * @returns 依赖采集器实例
 */
export function createDependencyCollector(): DependencyCollectorImpl {
  return new DependencyCollectorImpl();
}

/**
 * 收集依赖信息的便捷函数
 * @param context 插件上下文
 * @param options 配置选项
 * @returns 依赖图
 */
export async function collectDependencies(
  context: PluginContext,
  options: GalaxyOptions
): Promise<DependencyGraph> {
  const collector = createDependencyCollector();
  return collector.collect(context, options);
}