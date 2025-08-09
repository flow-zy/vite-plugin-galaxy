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
  private detailPanel!: HTMLDivElement; // 使用非空断言
  private volumeTooltip!: HTMLDivElement; // 使用非空断言

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

    // 添加键盘事件监听器
    this.addKeyboardListeners();

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
    document.removeEventListener('keydown', this.handleKeyDown.bind(this));
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

  /**
   * 初始化UI元素
   */
  private initUIElements() {
    this.detailPanel = document.createElement('div');
    this.detailPanel.style.position = 'absolute';
    this.detailPanel.style.top = '10px';
    this.detailPanel.style.right = '10px';
    this.detailPanel.style.width = '300px';
    this.detailPanel.style.backgroundColor = 'rgba(10, 10, 26, 0.8)';
    this.detailPanel.style.color = 'white';
    this.detailPanel.style.padding = '10px';
    this.detailPanel.style.borderRadius = '5px';
    this.detailPanel.style.display = 'none';
    this.shadowRoot?.appendChild(this.detailPanel);

    this.volumeTooltip = document.createElement('div');
    this.volumeTooltip.style.position = 'absolute';
    this.volumeTooltip.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    this.volumeTooltip.style.color = 'white';
    this.volumeTooltip.style.padding = '5px';
    this.volumeTooltip.style.borderRadius = '3px';
    this.volumeTooltip.style.pointerEvents = 'none';
    this.volumeTooltip.style.display = 'none';
    this.shadowRoot?.appendChild(this.volumeTooltip);

    // 添加帮助提示
    const helpDiv = document.createElement('div');
    helpDiv.style.position = 'absolute';
    helpDiv.style.bottom = '10px';
    helpDiv.style.left = '10px';
    helpDiv.style.backgroundColor = 'rgba(10, 10, 26, 0.8)';
    helpDiv.style.color = 'white';
    helpDiv.style.padding = '5px 10px';
    helpDiv.style.borderRadius = '5px';
    helpDiv.style.fontSize = '12px';
    helpDiv.innerHTML = '📝 双击节点: 打开源码 | 📊 悬停: 查看体积 | 🔄 拖拽: 旋转视图 | WASD: 移动视角';
    this.shadowRoot?.appendChild(helpDiv);
  }

  /**
   * 添加事件监听器
   */
  private addEventListeners() {
    this.renderer.domElement.addEventListener('mousedown', this.handleMouseDown.bind(this));
    document.addEventListener('mousemove', this.handleMouseMove.bind(this));
    document.addEventListener('mouseup', this.handleMouseUp.bind(this));
    this.renderer.domElement.addEventListener('wheel', this.handleWheel.bind(this));
    this.renderer.domElement.addEventListener('dblclick', this.handleDoubleClick.bind(this));
    this.renderer.domElement.addEventListener('mousemove', this.handleHover.bind(this));
  }

  /**
   * 添加键盘事件监听器
   */
  private addKeyboardListeners() {
    document.addEventListener('keydown', this.handleKeyDown.bind(this));
  }

  /**
   * 处理键盘按下事件
   */
  private handleKeyDown(event: KeyboardEvent) {
    const moveSpeed = 0.1;
    switch (event.key.toLowerCase()) {
      case 'w':
        this.cameraPosition.z -= moveSpeed;
        this.cameraTarget.z -= moveSpeed;
        break;
      case 's':
        this.cameraPosition.z += moveSpeed;
        this.cameraTarget.z += moveSpeed;
        break;
      case 'a':
        this.cameraPosition.x -= moveSpeed;
        this.cameraTarget.x -= moveSpeed;
        break;
      case 'd':
        this.cameraPosition.x += moveSpeed;
        this.cameraTarget.x += moveSpeed;
        break;
      case 'q':
        this.cameraPosition.y -= moveSpeed;
        this.cameraTarget.y -= moveSpeed;
        break;
      case 'e':
        this.cameraPosition.y += moveSpeed;
        this.cameraTarget.y += moveSpeed;
        break;
    }
    this.updateCamera();
  }

  /**
   * 更新相机位置
   */
  private updateCamera() {
    this.camera.position.copy(this.cameraPosition);
    this.camera.lookAt(this.cameraTarget);
  }

  /**
   * 处理鼠标双击事件 - 打开源码
   */
  private handleDoubleClick(event: MouseEvent) {
    event.preventDefault();

    const rect = this.renderer.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, this.camera);

    const intersects = raycaster.intersectObjects(Array.from(this.nodes.values()));

    if (intersects.length > 0) {
      const mesh = intersects[0].object as THREE.Mesh;
      const nodeId = Array.from(this.nodes.entries()).find(([_, value]) => value === mesh)?.[0];

      if (nodeId) {
        const node = this.data.nodes.find(n => n.id === nodeId);
        if (node && node.path) {
          // 在实际开发环境中，这里会打开文件
          console.log(`Opening source file: ${node.path}`);
          alert(`Would open source file: ${node.path}`);
          // 这里可以添加实际打开文件的逻辑，取决于开发环境
        }
      }
    }
  }

  /**
   * 处理鼠标悬停事件 - 显示体积提示
   */
  private handleHover(event: MouseEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, this.camera);

    const intersects = raycaster.intersectObjects(Array.from(this.nodes.values()));

    if (intersects.length > 0) {
      const mesh = intersects[0].object as THREE.Mesh;
      const nodeId = Array.from(this.nodes.entries()).find(([_, value]) => value === mesh)?.[0];

      if (nodeId) {
        const node = this.data.nodes.find(n => n.id === nodeId);
        if (node) {
          // 显示体积提示
          this.volumeTooltip.textContent = `Size: ${this.formatBytes(node.size)}`;
          this.volumeTooltip.style.left = `${event.clientX - rect.left + 10}px`;
          this.volumeTooltip.style.top = `${event.clientY - rect.top + 10}px`;
          this.volumeTooltip.style.display = 'block';

          // 高亮节点
          if (mesh.material instanceof THREE.MeshBasicMaterial) {
            // 使用类型断言解决类型不匹配问题
            (mesh.material as unknown as THREE.MeshLambertMaterial).emissive.set(0xffffff);
            (mesh.material as unknown as THREE.MeshLambertMaterial).emissiveIntensity = 0.5; // 先转为unknown再转为MeshLambertMaterial
          }
        }
      }
    } else {
      // 隐藏体积提示
      this.volumeTooltip.style.display = 'none';

      // 重置所有节点高亮
      this.nodes.forEach(mesh => {
        if (mesh.material instanceof THREE.MeshBasicMaterial) {
          // 使用类型断言解决类型不匹配问题
          (mesh.material as unknown as THREE.MeshLambertMaterial).emissive.set(0x000000);
          (mesh.material as unknown as THREE.MeshLambertMaterial).emissiveIntensity = 0; // 先转为unknown再转为MeshLambertMaterial
        }
      });
    }
  }

  /**
   * 格式化字节数
   */
  private formatBytes(bytes: number, decimals: number = 2): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  /**
   * 处理鼠标按下事件
   */
  private handleMouseDown(event: MouseEvent) {
    event.preventDefault();
    this.isDragging = true;
    this.previousMousePosition = { x: event.clientX, y: event.clientY };
    this.renderer.domElement.style.cursor = 'grabbing';
  }

  /**
   * 处理鼠标移动事件
   */
  private handleMouseMove(event: MouseEvent) {
    if (!this.isDragging) return;

    const deltaX = event.clientX - this.previousMousePosition.x;
    const deltaY = event.clientY - this.previousMousePosition.y;

    // 使用球面坐标进行旋转
    const spherical = new THREE.Spherical();
    spherical.setFromVector3(this.camera.position.clone().sub(this.cameraTarget));

    spherical.theta += deltaX * 0.01 * this.sensitivity;
    spherical.phi += deltaY * 0.01 * this.sensitivity;
    spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));

    this.camera.position.setFromSpherical(spherical).add(this.cameraTarget);
    this.camera.lookAt(this.cameraTarget);

    this.previousMousePosition = { x: event.clientX, y: event.clientY };
  }

  /**
   * 处理鼠标释放事件
   */
  private handleMouseUp() {
    this.isDragging = false;
    this.renderer.domElement.style.cursor = 'grab';
  }

  /**
   * 处理鼠标滚轮事件
   */
  private handleWheel(event: WheelEvent) {
    event.preventDefault();

    const delta = event.deltaY > 0 ? -0.5 : 0.5;
    const spherical = new THREE.Spherical();
    spherical.setFromVector3(this.camera.position.clone().sub(this.cameraTarget));

    spherical.radius = Math.max(2, Math.min(20, spherical.radius + delta));

    this.camera.position.setFromSpherical(spherical).add(this.cameraTarget);
  }
}

// 定义自定义元素
if (!customElements.get('deps-galaxy')) {
  customElements.define('deps-galaxy', DepsGalaxy);
}

// 导出 Web Component 类，便于 TypeScript 使用
export default DepsGalaxy;