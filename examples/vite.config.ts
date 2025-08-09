import { defineConfig } from 'vite';
import galaxy from 'vite-plugin-galaxy';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    galaxy({
      // 排除某些依赖
      exclude: [/node_modules\/react/],

      // 别名映射
      alias: {
        '@': '/src',
      },

      // 输出配置
      output: {
        json: 'deps.json',
        image: 'deps-galaxy.png',
        resolution: { width: 3840, height: 2160 },
      },

      // 可视化配置
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

      // 自定义着色函数
      colorMapper: (node) => {
        // 根据最后更新时间着色
        const now = Date.now();
        const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
        const monthAgo = now - 30 * 24 * 60 * 60 * 1000;

        if (node.lastUpdated > weekAgo) return '#52c41a'; // 最近一周更新的依赖 - 绿色
        if (node.lastUpdated > monthAgo) return '#faad14'; // 最近一个月更新的依赖 - 黄色
        return '#ff4d4f'; // 超过一个月未更新的依赖 - 红色
      },

      // 自定义形状映射
      shapeMapper: (node) => {
        switch (node.type) {
          case 'ui': return 'cube';
          case 'util': return 'sphere';
          case 'lib': return 'torus';
          default: return 'sphere';
        }
      },
    }),
  ],
});