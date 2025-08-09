# vite-plugin-galaxy

产品定位  
vite-plugin-galaxy 是一款“零配置”的 Vite 插件，把项目依赖关系实时渲染成可交互 3D 星系。开发者通过浏览器即可一眼发现体积黑洞、循环依赖与幽灵包，为大型项目提供直观、沉浸式的依赖治理体验。

## 安装

```bash
# 使用 npm
npm install vite-plugin-galaxy --save-dev

# 使用 yarn
yarn add vite-plugin-galaxy --dev

# 使用 pnpm
pnpm add vite-plugin-galaxy --dev
```

## 快速开始

1. 在 `vite.config.ts` 中添加插件：

```ts
import { defineConfig } from 'vite';
import galaxy from 'vite-plugin-galaxy';

export default defineConfig({
  plugins: [
    galaxy() // 零配置使用
  ]
});
```

2. 启动开发服务器：

```bash
npm run dev
```

3. 访问 `http://localhost:5173/__deps3d` 查看 3D 星系图。

## 功能清单

| 模块 | 子功能 | 触发时机 | 描述 | 可配置项 |
|---|---|---|---|---|
| **依赖采集** | 深度解析 | buildStart / 首次 dev | 读取 Vite moduleGraph + esbuild metafile，生成含体积、深度、更新时间的 GraphJSON | 排除正则 / 别名映射 |
|  | 幽灵包检测 | 同上 | 找出未声明在 package.json 却被引用的依赖 | 可输出警告日志 |
| **开发视图** | 3D 星系渲染 | configureServer | 启动本地路由 `/__deps3d`，Three.js WebGL 渲染 | 背景、节点纹理、轨道颜色 |
|  | 实时 HMR | handleHotUpdate | 仅增量同步新增/删除/改动的节点与边 | 开关 |
|  | 节点交互 | 浏览器端 | 单击 → 抽屉详情；双击 → VS Code 打开源码；Hover → 体积提示 | 快捷键可改 |
|  | 视角控制 | 浏览器端 | 鼠标拖拽/滚轮缩放；支持十字键 WASD 飞行模式 | 灵敏度调节 |
|  | VR 模式 | 浏览器端 | WebXR API，陀螺仪 + Oculus 浏览器沉浸式浏览 | 可关闭 |
| **生产报告** | 4K 海报 | writeBundle | 渲染 3840×2160 PNG 星系图，附带图例 | 分辨率、格式 |
|  | JSON 数据 | 同上 | 生成 deps.json，供后续 BI 或自定义图表使用 | 路径 |
| **CI 集成** | GitHub Action | 用户 CI | 官方模板 action，一键生成 PR 评论 + 对比图 | Token 配置 |
| **嵌入能力** | Web Component | 独立构建 | `<deps-galaxy src="./deps.json"></deps-galaxy>` 可嵌入 Storybook、文档站 | 主题色 |
| **性能优化** | 节点裁剪 | 浏览器端 | 视锥剔除 + LOD，>2k 节点仍 60 FPS | LOD 阈值可调 |
|  | 内存释放 | 热更新 | 旧场景对象自动 dispose，防止泄漏 | — |
| **扩展钩子** | 自定义着色 | 插件选项 | 通过 colorMapper 函数按更新时间/团队归属着色 | 函数 |
|  | 自定义形状 | 插件选项 | 根据包类型（util、ui、lib）使用不同几何体 | 映射对象 |

## 配置选项

```ts
interface GalaxyOptions {
  // 排除某些依赖（正则表达式数组）
  exclude?: RegExp[];
  
  // 别名映射
  alias?: Record<string, string>;
  
  // 输出配置
  output?: {
    json?: string;         // JSON 数据输出路径
    image?: string;        // 图片输出路径
    resolution?: {         // 图片分辨率
      width: number;
      height: number;
    };
  };
  
  // 可视化配置
  visual?: {
    backgroundColor?: string;  // 背景颜色
    nodeColors?: {
      default?: string;        // 默认节点颜色
      ghost?: string;          // 幽灵依赖颜色
      large?: string;          // 大型依赖颜色
    };
    sensitivity?: number;      // 视角灵敏度
    enableVR?: boolean;        // 是否启用 VR 模式
  };
  
  // 性能优化配置
  performance?: {
    enableFrustumCulling?: boolean;  // 是否启用视锥剔除
    enableLOD?: boolean;             // 是否启用 LOD
    lodLevels?: [number, number, number];  // LOD 距离阈值
    cleanupInterval?: number;        // 内存清理间隔（毫秒）
    detailLevels?: {
      high?: number;                 // 高细节级别
      medium?: number;               // 中细节级别
      low?: number;                  // 低细节级别
    };
  };
  
  // 自定义着色函数
  colorMapper?: (node: DependencyNode) => string;
  
  // 自定义形状映射
  shapeMapper?: (node: DependencyNode) => 'sphere' | 'cube' | 'torus' | 'custom';
}
```

## 高级示例

```ts
import { defineConfig } from 'vite';
import galaxy from 'vite-plugin-galaxy';

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

      // 性能优化配置
      performance: {
        enableFrustumCulling: true,
        enableLOD: true,
        lodLevels: [15, 30, 60], // 自定义 LOD 距离阈值
        cleanupInterval: 3000,    // 延长清理间隔至 3 秒
        detailLevels: {
          high: 1.0,
          medium: 0.6,
          low: 0.3,
        },
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
```

## 注意事项

1. 插件需要 Vite 5.0.0 或更高版本。
2. VR 模式需要浏览器支持 WebXR API。
3. 对于非常大的项目（依赖超过 2000 个），首次加载可能会有些延迟。
4. 生产报告生成可能需要额外的依赖，如 `canvas` 或 `sharp`。

## 贡献

欢迎贡献代码、提交问题或提出建议！

## 许可证

MIT 许可证
