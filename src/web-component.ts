import * as THREE from 'three';
import type { DependencyGraph } from './types';

/**
 * 依赖星系 Web Component
 * 使用方法: <deps-galaxy src="./deps.json"></deps-galaxy>
 */
export class DepsGalaxy extends HTMLElement {
  private container: HTMLDivElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private animationId: number;
  private nodes: Map<string, THREE.Mesh> = new Map();
  private edges: Map<string, THREE.Line> = new Map();
  private data: DependencyGraph = { nodes: [], edges: [] };
  private themeColor: string = '#8884d8';
  private isDragging: boolean = false;
  private previousMousePosition: { x: number; y: number } = { x: 0, y: 0 };
  private cameraPosition: THREE.Vector3 = new THREE.Vector3(0, 0, 5);
  private cameraTarget: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  private sensitivity: number = 1.0;
  private detailPanel: HTMLDivElement;
  private volumeTooltip: HTMLDivElement;

  // 观察属性变化
  static get observedAttributes() {
    return ['src', 'theme-color'];
  }

  constructor() {
    super();

    // 创建 Shadow DOM
    const shadow = this.attachShadow({ mode: 'open' });

    // 创建容器
    this.container = document.createElement('div');
    this.container.style.width = '100%';
    this.container.style.height = '100%';
    this.container.style.minHeight = '400px';
    this.container.style.position = 'relative';

    // 添加样式
    const style = document.createElement('style');
    style.textContent = `
      :host {
        display: block;
        width: 100%;
        height: 100%;
      }
      .loading {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-family: monospace;
        color: #888;
      }
      .node-label {
        position: absolute;
        color: white;
        font-size: 12px;
        pointer-events: none;
        white-space: nowrap;
        text-shadow: 0 0 2px #000;
      }
    `;

    // 添加加载提示
    const loading = document.createElement('div');
    loading.className = 'loading';
    loading.textContent = 'Loading dependency galaxy...';

    // 将元素添加到 Shadow DOM
    shadow.appendChild(style);
    shadow.appendChild(this.container);
    shadow.appendChild(loading);

    // 初始化 Three.js
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#0a0a1a');

    this.camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    this.camera.position.z = 5;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(400, 400); // 默认大小
    this.container.appendChild(this.renderer.domElement);

    // 添加光源
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0xffffff, 0.5);
    pointLight.position.set(5, 5, 5);
    this.scene.add(pointLight);

    // 初始化UI元素
    this.initUIElements();

    // 添加事件监听器
    this.addEventListeners();

    // 开始动画循环
    this.animateLoop = this.animateLoop.bind(this);
    this.animationId = requestAnimationFrame(this.animateLoop);
  }

  connectedCallback() {
    // 监听窗口大小变化
    window.addEventListener('resize', this.handleResize.bind(this));
    this.handleResize();

    // 检查是否有 src 属性
    const src = this.getAttribute('src');
    if (src) {
      this.loadData(src);
    }

    // 检查主题颜色
    const themeColor = this.getAttribute('theme-color');
    if (themeColor) {
      this.themeColor = themeColor;
    }
  }

  disconnectedCallback() {
    // 清理事件监听器
    window.removeEventListener('resize', this.handleResize.bind(this));
    cancelAnimationFrame(this.animationId);
  }

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    if (name === 'src' && newValue !== oldValue) {
      this.loadData(newValue);
    }

    if (name === 'theme-color' && newValue !== oldValue) {
      this.themeColor = newValue;
      this.updateTheme();
    }
  }

  /**
   * 加载依赖数据
   * @param src 数据文件路径
   */
  private async loadData(src: string) {
    try {
      const response = await fetch(src);
      if (!response.ok) {
        throw new Error(`Failed to load data: ${response.statusText}`);
      }

      this.data = await response.json();
      this.renderGalaxy();

      // 移除加载提示
      const loading = this.shadowRoot?.querySelector('.loading');
      if (loading) {
        this.shadowRoot?.removeChild(loading);
      }
    } catch (error) {
      console.error('Error loading dependency data:', error);
      const loading = this.shadowRoot?.querySelector('.loading');
      if (loading) {
        loading.textContent = `Error: ${error instanceof Error ? error.message : 'Failed to load data'}`;
      }
    }
  }

  /**
   * 渲染星系图
   */
  private renderGalaxy() {
    // 清除旧的节点和边
    this.nodes.forEach(mesh => this.scene.remove(mesh));
    this.edges.forEach(line => this.scene.remove(line));
    this.nodes.clear();
    this.edges.clear();

    // 清除所有标签
    this.shadowRoot?.querySelectorAll('.node-label').forEach(label => {
      this.shadowRoot?.removeChild(label);
    });

    // 创建节点
    this.data.nodes.forEach(node => {
      let color = this.themeColor;
      if (node.isGhost) color = '#ff4d4f';
      else if (node.isLarge) color = '#ff7a45';

      // 根据节点大小创建几何体
      const size = Math.max(0.05, Math.min(0.5, node.size / 100000));
      const geometry = new THREE.SphereGeometry(size, 32, 32);
      const material = new THREE.MeshBasicMaterial({ color });
      const sphere = new THREE.Mesh(geometry, material);

      // 基于依赖关系的布局 (简化版)
      // 实际应用中可以使用力导向布局算法
      sphere.position.x = (Math.random() - 0.5) * 10;
      sphere.position.y = (Math.random() - 0.5) * 10;
      sphere.position.z = (Math.random() - 0.5) * 10;

      this.scene.add(sphere);
      this.nodes.set(node.id, sphere);

      // 添加标签
      const label = document.createElement('div');
      label.className = 'node-label';
      label.textContent = node.name;
      this.shadowRoot?.appendChild(label);

      // 更新标签位置的函数
      sphere.userData.label = label;
    });

    // 创建边
    this.data.edges.forEach(edge => {
      const source = this.nodes.get(edge.source);
      const target = this.nodes.get(edge.target);

      if (source && target) {
        const geometry = new THREE.BufferGeometry();
        const material = new THREE.LineBasicMaterial({ color: 0x888888, linewidth: 0.5 });

        const points = new Float32Array([
          source.position.x, source.position.y, source.position.z,
          target.position.x, target.position.y, target.position.z
        ]);

        geometry.setAttribute('position', new THREE.BufferAttribute(points, 3));
        const line = new THREE.Line(geometry, material);
        this.scene.add(line);
        this.edges.set(`${edge.source}-${edge.target}`, line);
      }
    });
  }

  /**
   * 处理窗口大小变化
   */
  private handleResize() {
    const { width, height } = this.container.getBoundingClientRect();
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  /**
   * 更新主题颜色
   */
  private updateTheme() {
    this.data.nodes.forEach(node => {
      const mesh = this.nodes.get(node.id);
      if (mesh && mesh.material instanceof THREE.MeshBasicMaterial) {
        let color = this.themeColor;
        if (node.isGhost) color = '#ff4d4f';
        else if (node.isLarge) color = '#ff7a45';

        mesh.material.color.set(color);
      }
    });
  }

  /**
   * 动画循环
   */
  private animateLoop() {
    this.animationId = requestAnimationFrame(this.animateLoop);

    // 更新节点动画和标签位置
    this.nodes.forEach((mesh, id) => {
      // 简单旋转动画
      mesh.rotation.x += 0.001;
      mesh.rotation.y += 0.001;

      // 更新标签位置
      if (mesh.userData.label) {
        const label = mesh.userData.label as HTMLDivElement;
        const pos = new THREE.Vector3();
        pos.setFromMatrixPosition(mesh.matrixWorld);
        pos.project(this.camera);

        const rect = this.container.getBoundingClientRect();
        const x = (pos.x * 0.5 + 0.5) * rect.width;
        const y = (-pos.y * 0.5 + 0.5) * rect.height;

        label.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`;
        label.style.display = pos.z > 1 ? 'none' : 'block';
      }
    });

    this.renderer.render(this.scene, this.camera);
  }
}

// 定义自定义元素
if (!customElements.get('deps-galaxy')) {
  customElements.define('deps-galaxy', DepsGalaxy);
}

// 导出 Web Component 类，便于 TypeScript 使用
export default DepsGalaxy;