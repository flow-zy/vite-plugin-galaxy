产品定位  
vite-plugin-galaxy 是一款“零配置”的 Vite 插件，把项目依赖关系实时渲染成可交互 3D 星系。开发者通过浏览器即可一眼发现体积黑洞、循环依赖与幽灵包，为大型项目提供直观、沉浸式的依赖治理体验。

---

功能清单

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
