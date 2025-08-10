import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js'
import type { GraphNode, GraphEdge, GraphJSON, RendererConfig, ColorMapper, ShapeMapper } from './types'

// 默认配置
const defaultConfig: RendererConfig = {
  backgroundColor: '#000000',
  nodeColors: {
    default: '#00ffff',
    ghost: '#ff00ff',
    large: '#ffff00'
  },
  sensitivity: 1.0,
  enableVR: false,
  LODThreshold: 10000
}

// 默认形状映射
const defaultShapeMapper: ShapeMapper = {
  util: new THREE.IcosahedronGeometry(1, 1),
  ui: new THREE.OctahedronGeometry(1, 1),
  lib: new THREE.TetrahedronGeometry(1, 1),
  other: new THREE.SphereGeometry(1, 16, 16)
}

// 默认颜色映射
const defaultColorMapper: ColorMapper = (node) => {
  if (node.size > defaultConfig.LODThreshold) {
    return defaultConfig.nodeColors.large
  }
  return defaultConfig.nodeColors.default
}

export class GalaxyRenderer {
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private renderer: THREE.WebGLRenderer
  private controls: OrbitControls
  private config: RendererConfig
  private colorMapper: ColorMapper
  private shapeMapper: ShapeMapper
  private nodeObjects: Map<string, THREE.Mesh<THREE.BufferGeometry, THREE.Material>>
  private raycaster: THREE.Raycaster
  private mouse: THREE.Vector2
  private isVRMode: boolean

  constructor(container: HTMLElement, config: Partial<RendererConfig> = {}) {
    // 合并配置
    this.config = { ...defaultConfig, ...config }
    this.colorMapper = defaultColorMapper
    this.shapeMapper = defaultShapeMapper
    this.nodeObjects = new Map()
    this.raycaster = new THREE.Raycaster()
    this.mouse = new THREE.Vector2()
    this.isVRMode = false

    // 创建场景
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(this.config.backgroundColor)

    // 创建相机
    this.camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000)
    this.camera.position.set(0, 0, 50)

    // 创建渲染器
    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setSize(container.clientWidth, container.clientHeight)
    this.renderer.setPixelRatio(window.devicePixelRatio)
    container.appendChild(this.renderer.domElement)

    // 创建控制器
    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.05
    this.controls.zoomSpeed = this.config.sensitivity
    this.controls.panSpeed = this.config.sensitivity
    this.controls.rotateSpeed = this.config.sensitivity

    // 初始化VR模式
    if (this.config.enableVR) {
      this.initVR()
    }

    // 监听窗口大小变化
    window.addEventListener('resize', () => this.onWindowResize(container))

    // 监听鼠标事件
    window.addEventListener('mousemove', (event) => this.onMouseMove(event))
    window.addEventListener('click', (event) => this.onClick(event))
    window.addEventListener('dblclick', (event) => this.onDoubleClick(event))

    // 监听键盘事件
    window.addEventListener('keydown', (event) => this.onKeyDown(event))
  }

  // 初始化VR模式
  private initVR() {
    if ('xr' in navigator) {
      this.renderer.xr.enabled = true
      document.body.appendChild(VRButton.createButton(this.renderer))
      this.isVRMode = true
    } else {
      console.warn('WebXR not supported in this browser')
    }
  }

  // 窗口大小变化处理
  private onWindowResize(container: HTMLElement) {
    this.camera.aspect = container.clientWidth / container.clientHeight
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(container.clientWidth, container.clientHeight)
  }

  // 鼠标移动处理
  private onMouseMove(event: MouseEvent) {
    // 计算鼠标在标准化设备坐标中的位置 (-1 to +1)
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1

    // 更新射线投射器
    this.raycaster.setFromCamera(this.mouse, this.camera)

    // 检测与节点的交集
    const intersects = this.raycaster.intersectObjects([...this.nodeObjects.values()])

    if (intersects.length > 0) {
      const node = intersects[0].object.userData as GraphNode
      document.body.style.cursor = 'pointer'
      // 显示节点信息提示
      this.showNodeInfo(node, event.clientX, event.clientY)
    } else {
      document.body.style.cursor = 'default'
      // 隐藏节点信息提示
      this.hideNodeInfo()
    }
  }

  // 单击事件处理
  private onClick(event: MouseEvent) {
    // 更新射线投射器
    this.raycaster.setFromCamera(this.mouse, this.camera)

    // 检测与节点的交集
    const intersects = this.raycaster.intersectObjects([...this.nodeObjects.values()])

    if (intersects.length > 0) {
      const node = intersects[0].object.userData as GraphNode
      // 显示节点详情抽屉
      this.showNodeDetails(node)
    }
  }

  // 双击事件处理
  private onDoubleClick(event: MouseEvent) {
    // 更新射线投射器
    this.raycaster.setFromCamera(this.mouse, this.camera)

    // 检测与节点的交集
    const intersects = this.raycaster.intersectObjects([...this.nodeObjects.values()])

    if (intersects.length > 0) {
      const node = intersects[0].object.userData as GraphNode
      // 打开VS Code源码
      this.openSourceInVSCode(node.id)
    }
  }

  // 键盘事件处理
  private onKeyDown(event: KeyboardEvent) {
    // WASD飞行模式
    const speed = 0.5
    switch (event.key.toLowerCase()) {
      case 'w':
        this.camera.position.z -= speed
        break
      case 's':
        this.camera.position.z += speed
        break
      case 'a':
        this.camera.position.x -= speed
        break
      case 'd':
        this.camera.position.x += speed
        break
      case 'r':
        this.camera.position.y += speed
        break
      case 'f':
        this.camera.position.y -= speed
        break
    }
  }

  // 显示节点信息提示
  private showNodeInfo(node: GraphNode, x: number, y: number) {
    // 实现节点信息提示逻辑
    let tooltip = document.getElementById('node-tooltip')
    if (!tooltip) {
      tooltip = document.createElement('div')
      tooltip.id = 'node-tooltip'
      tooltip.style.position = 'fixed'
      tooltip.style.backgroundColor = 'rgba(0, 0, 0, 0.8)'
      tooltip.style.color = 'white'
      tooltip.style.padding = '8px'
      tooltip.style.borderRadius = '4px'
      tooltip.style.zIndex = '1000'
      document.body.appendChild(tooltip)
    }

    tooltip.innerHTML = `
      <div>ID: ${node.id}</div>
      <div>Size: ${(node.size / 1024).toFixed(2)} KB</div>
      <div>Depth: ${node.depth}</div>
      <div>Type: ${node.type || 'other'}</div>
    `

    tooltip.style.left = `${x + 10}px`
    tooltip.style.top = `${y + 10}px`
    tooltip.style.display = 'block'
  }

  // 隐藏节点信息提示
  private hideNodeInfo() {
    const tooltip = document.getElementById('node-tooltip')
    if (tooltip) {
      tooltip.style.display = 'none'
    }
  }

  // 显示节点详情抽屉
  private showNodeDetails(node: GraphNode) {
    // 实现节点详情抽屉逻辑
    let detailsPanel = document.getElementById('node-details')
    if (!detailsPanel) {
      detailsPanel = document.createElement('div')
      detailsPanel.id = 'node-details'
      detailsPanel.style.position = 'fixed'
      detailsPanel.style.right = '0'
      detailsPanel.style.top = '0'
      detailsPanel.style.width = '300px'
      detailsPanel.style.height = '100%'
      detailsPanel.style.backgroundColor = 'rgba(0, 0, 0, 0.9)'
      detailsPanel.style.color = 'white'
      detailsPanel.style.padding = '16px'
      detailsPanel.style.zIndex = '999'
      detailsPanel.style.overflowY = 'auto'
      document.body.appendChild(detailsPanel)

      // 添加关闭按钮
      const closeBtn = document.createElement('button')
      closeBtn.innerText = 'Close'
      closeBtn.style.marginBottom = '10px'
      closeBtn.addEventListener('click', () => {
        detailsPanel!.style.display = 'none'
      })
      detailsPanel.appendChild(closeBtn)
    }

    // 清空内容
    while (detailsPanel.children.length > 1) {
      detailsPanel.removeChild(detailsPanel.children[1])
    }

    // 添加节点信息
    const infoDiv = document.createElement('div')
    infoDiv.innerHTML = `
      <h3>${node.id}</h3>
      <p><strong>Size:</strong> ${(node.size / 1024).toFixed(2)} KB</p>
      <p><strong>Depth:</strong> ${node.depth}</p>
      <p><strong>Type:</strong> ${node.type || 'other'}</p>
      <p><strong>Last Modified:</strong> ${new Date(node.mtime).toLocaleString()}</p>
    `
    detailsPanel.appendChild(infoDiv)

    detailsPanel.style.display = 'block'
  }

  // 打开VS Code源码
  private openSourceInVSCode(filePath: string) {
    // 这里假设VS Code协议已注册
    window.open(`vscode://file/${window.location.origin}/${filePath}`, '_blank')
  }

  // 设置自定义颜色映射
  setColorMapper(mapper: ColorMapper) {
    this.colorMapper = mapper
    // 重新渲染节点
    this.updateNodes()
  }

  // 设置自定义形状映射
  setShapeMapper(mapper: ShapeMapper) {
    this.shapeMapper = mapper
    // 重新渲染节点
    this.updateNodes()
  }

  // 更新节点
  private updateNodes() {
    // 清除现有节点
    this.nodeObjects.forEach(node => this.scene.remove(node))
    this.nodeObjects.clear()

    // 重新渲染节点
    const graph = this.getCurrentGraph()
    if (graph) {
      this.renderNodes(graph.nodes)
      this.renderEdges(graph.edges, graph.nodes)
    }
  }

  // 获取当前图数据
  private getCurrentGraph(): GraphJSON | null {
    // 实际应用中，这里可能需要从API获取最新数据
    // 为简化示例，我们返回null
    return null
  }

  // 渲染节点
  renderNodes(nodes: GraphNode[]) {
    // 清除现有节点
    this.nodeObjects.forEach(node => this.scene.remove(node))
    this.nodeObjects.clear()

    nodes.forEach(node => {
      // 根据节点类型选择形状
      const shape = this.shapeMapper[node.type || 'other'] || this.shapeMapper.other

      // 根据节点大小缩放
      const scale = Math.cbrt(node.size) / 30 || 0.5

      // 根据节点属性选择颜色
      let color
      if (node.id.includes('node_modules')) {
        // 检查是否为幽灵包
        const graph = this.getCurrentGraph()
        if (graph && graph.ghosts.includes(node.id)) {
          color = this.config.nodeColors.ghost
        } else {
          color = this.colorMapper(node)
        }
      } else {
        color = this.colorMapper(node)
      }

      const material = new THREE.MeshBasicMaterial({ color })
      const mesh = new THREE.Mesh(shape, material)

      // 根据深度设置位置
      const radius = node.depth * 5 + 10
      const angle = Math.random() * Math.PI * 2
      const height = (Math.random() - 0.5) * 20

      mesh.position.set(
        Math.cos(angle) * radius,
        height,
        Math.sin(angle) * radius
      )

      mesh.scale.set(scale, scale, scale)
      mesh.userData = node

      this.scene.add(mesh)
      this.nodeObjects.set(node.id, mesh)
    })
  }

  // 渲染边
  renderEdges(edges: GraphEdge[], nodes: GraphNode[]) {
    // 清除现有边
    this.scene.children = this.scene.children.filter(child => {
      if (child instanceof THREE.Line) {
        return false
      }
      return true
    })

    const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff, opacity: 0.2, transparent: true })

    edges.forEach(edge => {
      const sourceNode = this.nodeObjects.get(edge.source)
      const targetNode = this.nodeObjects.get(edge.target)

      if (sourceNode && targetNode) {
        const points = [
          sourceNode.position.clone(),
          targetNode.position.clone()
        ]

        const geom = new THREE.BufferGeometry().setFromPoints(points)
        this.scene.add(new THREE.Line(geom, lineMat))
      }
    })
  }

  // 渲染场景
  render() {
    this.renderer.render(this.scene, this.camera)
  }

  // 启动动画循环
  startAnimationLoop() {
    this.renderer.setAnimationLoop(() => {
      this.controls.update()
      this.render()
    })
  }

  // 停止动画循环
  stopAnimationLoop() {
    this.renderer.setAnimationLoop(null)
  }

  // 释放资源
  dispose() {
    this.stopAnimationLoop()

    // 清理场景中的资源
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach(material => material.dispose());
          } else {
            object.material.dispose();
          }
        }
      } else if (object instanceof THREE.Line) {
        if (object.geometry) object.geometry.dispose();
        if (object.material) object.material.dispose();
      }
    });

    // 清空场景
    while (this.scene.children.length > 0) {
      this.scene.remove(this.scene.children[0]);
    }

    // 清理渲染器
    this.renderer.dispose();

    // 移除事件监听器
    const resizeHandler = () => this.onWindowResize(document.body);
    const mouseMoveHandler = (event: MouseEvent) => this.onMouseMove(event);
    const clickHandler = (event: MouseEvent) => this.onClick(event);
    const doubleClickHandler = (event: MouseEvent) => this.onDoubleClick(event);
    const keyDownHandler = (event: KeyboardEvent) => this.onKeyDown(event);

    window.removeEventListener('resize', resizeHandler);
    window.removeEventListener('mousemove', mouseMoveHandler);
    window.removeEventListener('click', clickHandler);
    window.removeEventListener('dblclick', doubleClickHandler);
    window.removeEventListener('keydown', keyDownHandler);

    // 清空节点对象映射
    this.nodeObjects.clear();
  }
}