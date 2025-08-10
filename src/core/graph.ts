import type { GraphNode, GraphEdge, GraphJSON, GalaxyOptions } from '../client/types'
import { relative, resolve } from 'node:path'
import { statSync } from 'node:fs'
import { detectGhostPkgs } from './ghost'

// 计算节点深度
function calculateDepths(nodes: GraphNode[], edges: GraphEdge[], options: GalaxyOptions = {}): GraphNode[] {
  const depthMap: Record<string, number> = {};
  const visited: Set<string> = new Set();
  const { maxDepth = Infinity } = options.graph || {};

  // 递归计算深度
  function dfs(nodeId: string): number {
    if (visited.has(nodeId)) {
      return depthMap[nodeId];
    }

    visited.add(nodeId);
    let maxDepthVal = 0;

    // 查找所有依赖当前节点的节点
    const dependents = edges.filter(edge => edge.target === nodeId);

    if (dependents.length === 0) {
      depthMap[nodeId] = 0;
      return 0;
    }

    for (const dep of dependents) {
      const depth = dfs(dep.source) + 1;
      if (depth > maxDepthVal) {
        maxDepthVal = depth;
      }
    }

    // 限制最大深度
    if (maxDepthVal > maxDepth) {
      maxDepthVal = maxDepth;
    }

    depthMap[nodeId] = maxDepthVal;
    return maxDepthVal;
  }

  // 计算所有节点的深度
  for (const node of nodes) {
    if (!visited.has(node.id)) {
      dfs(node.id);
    }
  }

  // 更新节点深度
  return nodes.map(node => ({
    ...node,
    depth: depthMap[node.id] || 0
  }));
}

// 分类节点类型
function classifyNodeTypes(nodes: GraphNode[], options: GalaxyOptions = {}): GraphNode[] {
  const { customTypeRules = [] } = options.classification || {};

  return nodes.map(node => {
    // 应用自定义类型规则
    for (const rule of customTypeRules) {
      if (rule.pattern.test(node.id)) {
        return {
          ...node,
          type: rule.type
        };
      }
    }

    // 默认类型分类
    let type: GraphNode['type'] = 'other';

    if (node.id.includes('util') || node.id.includes('utils')) {
      type = 'util';
    } else if (node.id.includes('ui') || node.id.includes('component')) {
      type = 'ui';
    } else if (node.id.includes('lib') || node.id.includes('library')) {
      type = 'lib';
    } else if (node.id.includes('api') || node.id.includes('server')) {
      type = 'other'; // 将api类型映射到other
    } else if (node.id.includes('router') || node.id.includes('route')) {
      type = 'other'; // 将router类型映射到other
    }

    return {
      ...node,
      type
    };
  });
}

// 应用别名映射
function applyAlias(nodeId: string, alias: Record<string, string> = {}): string {
  for (const [key, value] of Object.entries(alias)) {
    if (nodeId.startsWith(key)) {
      return nodeId.replace(key, value);
    }
  }
  return nodeId;
}

// 检查是否应该排除节点
function shouldExclude(nodeId: string, exclude: RegExp[] = []): boolean {
  return exclude.some(regex => regex.test(nodeId));
}

// 生成图数据
export async function generateGraph(ctx: PluginContext, options: GalaxyOptions = {}): Promise<GraphJSON> {
  const { exclude = [], alias = {} } = options;
  const modules = [...ctx.getModuleIds()];
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const seen = new Set<string>();

  for (const id of modules) {
    const info = ctx.getModuleInfo(id);
    if (!info) continue;

    let shortId = relative(ctx.config.root, id);

    // 应用别名
    shortId = applyAlias(shortId, alias);

    // 检查是否应该排除
    if (shouldExclude(shortId, exclude)) continue;

    if (seen.has(shortId)) continue;
    seen.add(shortId);

    try {
      const { size } = statSync(id);
      const mtime = statSync(id).mtimeMs;
      nodes.push({
        id: shortId,
        size,
        mtime,
        depth: 0
      });
    } catch {
      nodes.push({
        id: shortId,
        size: 0,
        mtime: 0,
        depth: 0
      });
    }

    for (const dep of info.importedIds) {
      let targetId = relative(ctx.config.root, dep);

      // 应用别名
      targetId = applyAlias(targetId, alias);

      // 检查是否应该排除
      if (shouldExclude(targetId, exclude)) continue;

      edges.push({
        source: shortId,
        target: targetId
      });
    }
  }

  // 计算节点深度
  const nodesWithDepth = calculateDepths(nodes, edges, options);

  // 分类节点类型
  const nodesWithType = classifyNodeTypes(nodesWithDepth, options);

  // 检测幽灵包
  const { ghosts } = await detectGhostPkgs(ctx, modules);

  // 过滤掉排除的幽灵包
  const filteredGhosts = ghosts
    .map(ghost => applyAlias(ghost, alias))
    .filter(ghost => !shouldExclude(ghost, exclude));

  return {
    nodes: nodesWithType,
    edges,
    ghosts: filteredGhosts
  };
}