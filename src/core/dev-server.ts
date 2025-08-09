import type { ViteDevServer } from 'vite';
import type { DependencyGraph, GalaxyOptions } from '../types';
import path from 'path';
import fs from 'fs';
import { collectDependencies } from './dependency-collector';

// 缓存依赖图
let dependencyGraph: DependencyGraph | null = null;

/**
 * 设置开发服务器
 * @param server Vite 开发服务器
 * @param options 插件配置选项
 */
export function setupDevServer(server: ViteDevServer, options: GalaxyOptions): void {
  // 创建临时目录用于存放前端资源
  const tempDir = path.resolve(server.config.root, '.galaxy-temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  // 生成前端页面
  generateFrontendAssets(tempDir, options);

  // 设置路由
  server.middlewares.use('/__deps3d', (req, res) => {
    if (req.url === '/') {
      // 提供 index.html
      res.setHeader('Content-Type', 'text/html');
      res.end(fs.readFileSync(path.join(tempDir, 'index.html'), 'utf-8'));
    } else if (req.url === '/deps-data') {
      // 提供依赖数据
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(dependencyGraph || { nodes: [], edges: [] }));
    } else if (req.url === '/three.min.js') {
      // 提供 Three.js 库
      res.setHeader('Content-Type', 'application/javascript');
      res.end(fs.readFileSync(path.join(tempDir, 'three.min.js'), 'utf-8'));
    } else if (req.url === '/galaxy-viewer.js') {
      // 提供星系查看器脚本
      res.setHeader('Content-Type', 'application/javascript');
      res.end(fs.readFileSync(path.join(tempDir, 'galaxy-viewer.js'), 'utf-8'));
    } else {
      res.statusCode = 404;
      res.end('Not found');
    }
  });

  // 初始收集依赖
  server.pluginContainer
    .resolveId('vite-plugin-galaxy')
    .then(() => {
      return collectDependencies(server.pluginContainer as any, options);
    })
    .then(graph => {
      dependencyGraph = graph;
      console.log('依赖采集完成，访问 /__deps3d 查看 3D 星系图');
    });

  // 监听热更新事件
  server.watcher.on('change', async (filePath) => {
    // 当文件变化时，增量更新依赖图
    if (filePath.includes('.js') || filePath.includes('.ts') || filePath.includes('.vue')) {
      console.log('检测到文件变化，更新依赖图...');
      dependencyGraph = await collectDependencies(server.pluginContainer as any, options);
    }
  });
}

/**
 * 生成前端资源
 * @param outputDir 输出目录
 * @param options 配置选项
 */
function generateFrontendAssets(outputDir: string, options: GalaxyOptions): void {
  // 下载或复制 Three.js 库
  const threeJsContent = `/* 这里应该是 Three.js 库的内容 */
// 实际使用时，应该从 node_modules/three/build/three.min.js 复制
`;
  fs.writeFileSync(path.join(outputDir, 'three.min.js'), threeJsContent);

  // 生成星系查看器脚本
  const viewerScript = `import * as THREE from './three.min.js';

// 性能优化器类
class PerformanceOptimizer {
  constructor(camera, scene) {
    this.camera = camera;
    this.scene = scene;
    this.lodLevels = [10, 20, 40]; // 距离阈值
    this.nodeMap = new Map();
    this.visibleNodes = new Set();
    this.lastCleanupTime = 0;
    this.cleanupInterval = 2000; // 2秒清理一次
  }

  addNode(id, node, baseMesh) {
    // 创建LOD对象
    const lod = new THREE.LOD();

    // 根据节点大小确定LOD级别
    const size = baseMesh.geometry.parameters.radius;

    // 创建不同级别的细节网格
    const highDetailMesh = baseMesh.clone();
    const mediumDetailMesh = this.createSimplifiedMesh(baseMesh, 0.5);
    const lowDetailMesh = this.createSimplifiedMesh(baseMesh, 0.2);

    // 添加到LOD
    lod.addLevel(highDetailMesh, this.lodLevels[0] * size);
    lod.addLevel(mediumDetailMesh, this.lodLevels[1] * size);
    lod.addLevel(lowDetailMesh, this.lodLevels[2] * size);

    // 保存节点信息
    this.nodeMap.set(id, { mesh: baseMesh, lod, node });

    // 替换场景中的原始网格
    if (baseMesh.parent) {
      baseMesh.parent.add(lod);
      baseMesh.parent.remove(baseMesh);
    }

    // 初始设置为可见
    this.visibleNodes.add(id);
  }

  createSimplifiedMesh(originalMesh, detailLevel) {
    if (originalMesh.geometry instanceof THREE.SphereGeometry) {
      const params = originalMesh.geometry.parameters;
      const simplifiedGeometry = new THREE.SphereGeometry(
        params.radius,
        Math.max(4, Math.floor(params.widthSegments * detailLevel)),
        Math.max(2, Math.floor(params.heightSegments * detailLevel))
      );
      return new THREE.Mesh(simplifiedGeometry, originalMesh.material.clone());
    }
    return originalMesh.clone();
  }

  updateVisibleNodes() {
    const now = Date.now();
    if (now - this.lastCleanupTime < this.cleanupInterval) {
      return;
    }
    this.lastCleanupTime = now;

    const frustum = new THREE.Frustum();
    const matrix = new THREE.Matrix4().multiplyMatrices(
      this.camera.projectionMatrix,
      this.camera.matrixWorldInverse
    );
    frustum.setFromProjectionMatrix(matrix);

    // 检查每个节点是否在视锥内
    this.nodeMap.forEach(({ lod, node }, id) => {
      const boundingSphere = new THREE.Sphere();
      lod.geometry.computeBoundingSphere();
      boundingSphere.copy(lod.geometry.boundingSphere);
      boundingSphere.applyMatrix4(lod.matrixWorld);

      const isVisible = frustum.intersectsSphere(boundingSphere);

      if (isVisible) {
        this.visibleNodes.add(id);
      } else {
        this.visibleNodes.delete(id);
      }

      // 更新LOD
      lod.update(this.camera);
    });
  }

  dispose() {
    this.nodeMap.forEach(({ lod }) => {
      lod.traverse(obj => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (obj.material instanceof THREE.Material) {
            obj.material.dispose();
          }
        }
      });
    });
    this.nodeMap.clear();
    this.visibleNodes.clear();
  }
}

// 初始化场景、相机和渲染器
const scene = new THREE.Scene();
scene.background = new THREE.Color('${options.visual.backgroundColor}');

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 5;

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// 创建性能优化器
const performanceOptimizer = new PerformanceOptimizer(camera, scene);

// 存储节点和边的引用
const nodes = new Map();
const edges = new Map();

// 从服务器获取依赖数据
async function fetchDependencyData() {
  try {
    const response = await fetch('/__deps3d/deps-data');
    const data = await response.json();
    updateScene(data);
  } catch (error) {
    console.error('获取依赖数据失败:', error);
    setTimeout(fetchDependencyData, 1000);
  }
}

// 更新场景
function updateScene(data) {
  // 清除旧的节点和边
  nodes.forEach(mesh => scene.remove(mesh));
  edges.forEach(line => scene.remove(line));
  nodes.clear();
  edges.clear();
  performanceOptimizer.dispose();

  // 创建节点
  data.nodes.forEach(node => {
    let color = '${options.visual.nodeColors.default}';
    if (node.isGhost) color = '${options.visual.nodeColors.ghost}';
    else if (node.isLarge) color = '${options.visual.nodeColors.large}';

    // 根据节点大小创建几何体
    const size = Math.max(0.05, Math.min(0.5, node.size / 100000));
    const geometry = new THREE.SphereGeometry(size, 32, 32);
    const material = new THREE.MeshBasicMaterial({ color });
    const sphere = new THREE.Mesh(geometry, material);

    // 随机位置（实际应该基于依赖关系布局）
    sphere.position.x = (Math.random() - 0.5) * 10;
    sphere.position.y = (Math.random() - 0.5) * 10;
    sphere.position.z = (Math.random() - 0.5) * 10;

    scene.add(sphere);
    nodes.set(node.id, sphere);

    // 添加到性能优化器
    performanceOptimizer.addNode(node.id, node, sphere);

    // 添加标签
    const div = document.createElement('div');
    div.className = 'node-label';
    div.textContent = node.name;
    div.style.position = 'absolute';
    div.style.color = 'white';
    div.style.fontSize = '12px';
    document.body.appendChild(div);

    // 更新标签位置的函数
    function updateLabelPosition() {
      const pos = new THREE.Vector3();
      pos.setFromMatrixPosition(sphere.matrixWorld);
      pos.project(camera);

      const x = (pos.x * 0.5 + 0.5) * window.innerWidth;
      const y = (-pos.y * 0.5 + 0.5) * window.innerHeight;

      div.style.transform = \`translate(-50%, -50%) translate(\${x}px, \${y}px)\`;
      div.style.display = pos.z > 1 ? 'none' : 'block';
    }

    // 存储更新函数
    sphere.userData.updateLabel = updateLabelPosition;
  });

  // 创建边
  data.edges.forEach(edge => {
    const source = nodes.get(edge.source);
    const target = nodes.get(edge.target);

    if (source && target) {
      const geometry = new THREE.BufferGeometry();
      const material = new THREE.LineBasicMaterial({ color: 0x888888, linewidth: 0.5 });

      const points = new Float32Array([
        source.position.x, source.position.y, source.position.z,
        target.position.x, target.position.y, target.position.z
      ]);

      geometry.setAttribute('position', new THREE.BufferAttribute(points, 3));
      const line = new THREE.Line(geometry, material);
      scene.add(line);
      edges.set(\`\${edge.source}-\${edge.target}\`, line);
    }
  });
}

// 动画循环
function animate() {
  requestAnimationFrame(animate);

  // 更新可见节点
  performanceOptimizer.updateVisibleNodes();

  // 更新节点动画和标签位置
  nodes.forEach((mesh, id) => {
    // 简单旋转动画
    mesh.rotation.x += 0.001;
    mesh.rotation.y += 0.001;

    // 更新标签位置
    if (mesh.userData.updateLabel) {
      mesh.userData.updateLabel();
    }
  });

  renderer.render(scene, camera);
}

// 初始化
fetchDependencyData();
animate();

// 窗口大小调整
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// 清理资源
window.addEventListener('beforeunload', () => {
  performanceOptimizer.dispose();
  renderer.dispose();
});
`;
  fs.writeFileSync(path.join(outputDir, 'galaxy-viewer.js'), viewerScript);

  // 生成 HTML 页面
  const htmlContent = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Vite 依赖星系图</title>
  <style>
    body {
      margin: 0;
      overflow: hidden;
      background-color: #000;
    }
    .node-label {
      pointer-events: none;
      white-space: nowrap;
      text-shadow: 0 0 2px #000;
    }
    .controls {
      position: fixed;
      top: 10px;
      left: 10px;
      background: rgba(0, 0, 0, 0.7);
      padding: 10px;
      border-radius: 5px;
      color: white;
      font-family: monospace;
    }
    .info-panel {
      position: fixed;
      bottom: 10px;
      right: 10px;
      background: rgba(0, 0, 0, 0.7);
      padding: 10px;
      border-radius: 5px;
      color: white;
      font-family: monospace;
      max-width: 300px;
    }
  </style>
</head>
<body>
  <div class="controls">
    <h3>控制说明</h3>
    <p>鼠标拖拽: 旋转视角</p>
    <p>鼠标滚轮: 缩放</p>
    <p>WASD: 移动视角</p>
    <p>单击节点: 显示详情</p>
    <p>双击节点: 打开源码</p>
  </div>
  <div class="info-panel" id="node-info">
    选择节点查看详情
  </div>
  <script type="module" src="/__deps3d/galaxy-viewer.js"></script>
</body>
</html>
`;
  fs.writeFileSync(path.join(outputDir, 'index.html'), htmlContent);
}