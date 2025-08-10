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
| **嵌入能力** | Web Component | 独立构建 | `<deps-galaxy src="./deps.json"></deps-galaxy>` 可嵌入 Storybook、文档站 | 主题色 |
| **性能优化** | 节点裁剪 | 浏览器端 | 视锥剔除 + LOD，>2k 节点仍 60 FPS | LOD 阈值可调 |
|  | 内存释放 | 热更新 | 旧场景对象自动 dispose，防止泄漏 | — |
| **扩展钩子** | 自定义着色 | 插件选项 | 通过 colorMapper 函数按更新时间/团队归属着色 | 函数 |
|  | 自定义形状 | 插件选项 | 根据包类型（util、ui、lib）使用不同几何体 | 映射对象 |

```
vite-plugin-galaxy/
├─ src/
│  ├─ index.ts                 # 插件入口
│  ├─ core/
│  │  ├─ collect.ts            # 依赖采集（moduleGraph + esbuild metafile）
│  │  ├─ ghost.ts              # 幽灵包检测
│  │  └─ graph.ts              # 生成 GraphJSON
│  ├─ server/
│  │  └─ index.ts              # configureServer & handleHotUpdate
│  ├─ client/                  # 浏览器端代码（Three.js、WebXR）
│  │  ├─ main.ts               # 挂在 /__deps3d 的入口
│  │  ├─ renderer.ts           # 3D 渲染逻辑
│  │  └─ types.ts
│  ├─ ci/                      # GitHub Action 模板
│  └─ webcomponent/            # <deps-galaxy> 独立构建
├─ examples/                 # 用于本地调试的 Vite 项目
├─ tsup.config.ts
├─ package.json
└─ README.md
```