import type { DependencyGraph, GalaxyOptions } from '../types';
import fs from 'fs';
import path from 'path';
import { collectDependencies } from './dependency-collector';

/**
 * 报告生成器实现
 */
export class ReportGeneratorImpl {
  /**
   * 生成报告
   * @param options 插件配置选项
   * @returns 生成报告的路径
   */
  async generate(options: GalaxyOptions): Promise<void> {
    // 在实际使用中，这里应该获取已经收集好的依赖图
    // 为了简化示例，我们假设在生成报告时重新收集依赖
    const mockContext = { root: process.cwd() } as any;
    const graph = await collectDependencies(mockContext, options);

    // 生成 JSON 数据
    const jsonPath = await this.generateJson(graph, options);
    console.log(`依赖数据已生成: ${jsonPath}`);

    // 生成 4K 海报
    const imagePath = await this.generateImage(graph, options);
    console.log(`4K 海报已生成: ${imagePath}`);
  }

  /**
   * 生成 JSON 数据
   * @param graph 依赖图
   * @param options 配置选项
   * @returns JSON 文件路径
   */
  async generateJson(graph: DependencyGraph, options: GalaxyOptions): Promise<string> {
    const outputPath = path.resolve(process.cwd(), options.output.json);
    fs.writeFileSync(outputPath, JSON.stringify(graph, null, 2));
    return outputPath;
  }

  /**
   * 生成 4K 海报
   * @param graph 依赖图
   * @param options 配置选项
   * @returns 图片文件路径
   */
  /**
   * 生成 4K 海报
   * @param graph 依赖图
   * @param options 配置选项
   * @returns 图片文件路径
   */
  async generateImage(graph: DependencyGraph, options: GalaxyOptions): Promise<string> {
    const outputPath = path.resolve(process.cwd(), options.output.image);
    const { width, height } = options.output.resolution;

    try {
      // 尝试使用 canvas 和 Three.js 生成高质量图片
      const { OffscreenCanvas } = require('canvas');
      global.OffscreenCanvas = OffscreenCanvas;

      const THREE = require('three');
      const { OrbitControls } = require('three/examples/jsm/controls/OrbitControls');

      // 创建场景、相机和渲染器
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(options.visual.backgroundColor || '#0a0a1a');

      const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 10000);
      camera.position.z = 1000;

      const canvas = new OffscreenCanvas(width, height);
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
      renderer.setSize(width, height);

      // 添加光源
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
      scene.add(ambientLight);

      const pointLight = new THREE.PointLight(0xffffff, 1);
      pointLight.position.set(100, 100, 1000);
      scene.add(pointLight);

      // 创建设置星系
      this.createGalaxy(scene, graph, options);

      // 添加轨道控制器
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.update();

      // 渲染场景
      renderer.render(scene, camera);

      // 将渲染结果保存为 PNG
      const dataUrl = canvas.toDataURL('image/png');
      const data = dataUrl.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(data, 'base64');
      fs.writeFileSync(outputPath, buffer);

      console.log('4K 海报已成功生成');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn('无法生成高质量 4K 海报，将使用占位符图片。原因:', errorMessage);
      console.warn('请安装 Python 和 node-gyp 以支持高质量渲染:');
      console.warn('1. 安装 Python: https://www.python.org/');
      console.warn('2. 安装 node-gyp: npm install -g node-gyp');
      console.warn('3. 重新安装依赖: pnpm install');

      // 创建占位符文件
      const placeholderContent = `{
  "message": "这是一个 4K 海报的占位符",
  "resolution": "${width}x${height}",
  "nodeCount": ${graph.nodes.length},
  "edgeCount": ${graph.edges.length},
  "error": "${errorMessage}"
}
`;
      fs.writeFileSync(outputPath, placeholderContent);
    }

    return outputPath;
  }

  /**
   * 创建星系可视化
   * @param scene Three.js 场景
   * @param graph 依赖图
   * @param options 配置选项
   */
  private createGalaxy(scene: THREE.Scene, graph: DependencyGraph, options: GalaxyOptions): void {
    const THREE = require('three');

    // 节点颜色映射
    const nodeColors = {
      default: new THREE.Color(options.visual.nodeColors?.default || '#8884d8'),
      ghost: new THREE.Color(options.visual.nodeColors?.ghost || '#ff4d4f'),
      large: new THREE.Color(options.visual.nodeColors?.large || '#ff7a45'),
    };

    // 创建节点
    const nodeGeometries: { [key: string]: THREE.BufferGeometry } = {};
    const nodeMaterials: { [key: string]: THREE.MeshBasicMaterial } = {};

    graph.nodes.forEach(node => {
      // 根据节点大小选择颜色
      let color = nodeColors.default;
      if (node.isGhost) color = nodeColors.ghost;
      if (node.size > 1000) color = nodeColors.large;

      // 为不同大小的节点创建不同的几何体和材质以优化性能
      const sizeKey = Math.round(node.size / 10) * 10;
      if (!nodeGeometries[sizeKey]) {
        nodeGeometries[sizeKey] = new THREE.SphereGeometry(sizeKey / 2 || 5, 16, 16);
        nodeMaterials[sizeKey] = new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.8,
          emissive: color,
          emissiveIntensity: 0.5
        });
      }

      // 创建节点网格
      const mesh = new THREE.Mesh(nodeGeometries[sizeKey], nodeMaterials[sizeKey]);

      // 随机分布节点位置
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * 400 + 100;
      mesh.position.x = Math.cos(angle) * radius;
      mesh.position.y = (Math.random() - 0.5) * 200;
      mesh.position.z = Math.sin(angle) * radius;

      scene.add(mesh);
    });

    // 创建边
    const edgeGeometry = new THREE.BufferGeometry();
    const edgePositions: number[] = [];

    graph.edges.forEach(edge => {
      const sourceNode = graph.nodes.find(n => n.id === edge.source);
      const targetNode = graph.nodes.find(n => n.id === edge.target);

      if (sourceNode && targetNode) {
        // 查找对应的网格对象
        const sourceMesh = scene.children.find(child => {
          return child.userData && child.userData.id === sourceNode.id;
        });
        const targetMesh = scene.children.find(child => {
          return child.userData && child.userData.id === targetNode.id;
        });

        if (sourceMesh && targetMesh) {
          edgePositions.push(sourceMesh.position.x, sourceMesh.position.y, sourceMesh.position.z);
          edgePositions.push(targetMesh.position.x, targetMesh.position.y, targetMesh.position.z);
        }
      }
    });

    edgeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(edgePositions, 3));
    const edgeMaterial = new THREE.LineBasicMaterial({
      color: 0x888888,
      transparent: true,
      opacity: 0.3
    });

    const edgeLines = new THREE.LineSegments(edgeGeometry, edgeMaterial);
    scene.add(edgeLines);
  }
}

/**
 * 创建报告生成器实例
 * @returns 报告生成器实例
 */
export function createReportGenerator(): ReportGeneratorImpl {
  return new ReportGeneratorImpl();
}

/**
 * 生成报告的便捷函数
 * @param options 配置选项
 * @returns 生成报告的路径
 */
export async function generateReport(options: GalaxyOptions): Promise<void> {
  const generator = createReportGenerator();
  await generator.generate(options);
}