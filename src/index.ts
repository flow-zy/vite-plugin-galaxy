import type { Plugin } from 'vite';
import { collectDependencies } from './core/dependency-collector';
import { setupDevServer } from './core/dev-server';
import { generateReport } from './core/report-generator';
import { GalaxyOptions } from './types';
import DepsGalaxy from './web-component';
import { PerformanceOptimizer } from './core/performance-optimization';

// 定义默认选项
const defaultOptions: GalaxyOptions = {
  exclude: [],
  alias: {},
  output: {
    json: 'deps.json',
    image: 'deps-galaxy.png',
    resolution: { width: 3840, height: 2160 },
  },
  visual: {
    backgroundColor: '#0a0a1a',
    nodeColors: {
      default: '#8884d8',
      ghost: '#ff4d4f',
      large: '#ff7a45',
    },
    sensitivity: 1.0,
    enableVR: true,
  },
  performance: {
    enableFrustumCulling: true,
    enableLOD: true,
    lodLevels: [10, 20, 40],
    cleanupInterval: 2000,
    detailLevels: {
      high: 1.0,
      medium: 0.5,
      low: 0.2,
    },
  },
};

/**
 * Vite 插件主函数
 * @param options 插件配置选项
 * @returns Vite 插件对象
 */
export function galaxy(options: Partial<GalaxyOptions> = {}): Plugin {
  // 合并用户选项和默认选项
  const mergedOptions = { ...defaultOptions, ...options };

  return {
    name: 'vite-plugin-galaxy',

    // 初始化阶段
    buildStart() {
      collectDependencies(this, mergedOptions);
    },

    // 配置开发服务器
    configureServer(server) {
      setupDevServer(server, mergedOptions);
    },

    // 热更新处理
    handleHotUpdate(context) {
      // 实现热更新逻辑
      return context.modules;
    },

    // 构建完成后生成报告
    writeBundle() {
      generateReport(mergedOptions);
    },
  };
}

export default galaxy;

export { DepsGalaxy };