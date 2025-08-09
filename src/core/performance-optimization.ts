import * as THREE from 'three';
import type { DependencyNode } from '../types';

/**
 * 性能优化管理器
 * 处理视锥剔除、LOD和内存管理
 */
export class PerformanceOptimizer {
  private camera: THREE.Camera;
  private scene: THREE.Scene;
  private lodLevels: number[] = [10, 20, 40]; // 距离阈值
  private nodeMap: Map<string, { mesh: THREE.Mesh; lod: THREE.LOD; node: DependencyNode }> = new Map();
  private visibleNodes: Set<string> = new Set();
  private memoryManager: MemoryManager;

  /**
   * 构造函数
   * @param camera 相机对象
   * @param scene 场景对象
   */
  constructor(camera: THREE.Camera, scene: THREE.Scene) {
    this.camera = camera;
    this.scene = scene;
    this.memoryManager = new MemoryManager();

    // 初始化视锥剔除
    this.initializeFrustumCulling();
  }

  /**
   * 初始化视锥剔除
   */
  private initializeFrustumCulling() {
    // 使用Three.js内置的视锥剔除
    this.scene.autoUpdate = true;
  }

  /**
   * 添加节点到优化管理器
   * @param id 节点ID
   * @param node 依赖节点数据
   * @param baseMesh 基础网格对象
   */
  addNode(id: string, node: DependencyNode, baseMesh: THREE.Mesh) {
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

  /**
   * 创建简化的网格
   * @param originalMesh 原始网格
   * @param detailLevel 细节级别 (0-1)
   * @returns 简化后的网格
   */
  private createSimplifiedMesh(originalMesh: THREE.Mesh, detailLevel: number): THREE.Mesh {
    // 对于球体，我们可以通过减少分段来简化
    if (originalMesh.geometry instanceof THREE.SphereGeometry) {
      const params = originalMesh.geometry.parameters;
      const simplifiedGeometry = new THREE.SphereGeometry(
        params.radius,
        Math.max(4, Math.floor(params.widthSegments * detailLevel)),
        Math.max(2, Math.floor(params.heightSegments * detailLevel))
      );
      return new THREE.Mesh(simplifiedGeometry, originalMesh.material.clone());
    }

    // 对于其他几何体，返回原始网格的克隆
    return originalMesh.clone();
  }

  /**
   * 更新可见节点
   * 应该在每一帧调用
   */
  updateVisibleNodes() {
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
      boundingSphere.copy(lod.geometry.boundingSphere!);
      boundingSphere.applyMatrix4(lod.matrixWorld);

      const isVisible = frustum.intersectsSphere(boundingSphere);

      if (isVisible) {
        if (!this.visibleNodes.has(id)) {
          this.visibleNodes.add(id);
          // 节点变为可见，可以加载更高细节
          this.memoryManager.markAsUsed(id);
        }
      } else {
        if (this.visibleNodes.has(id)) {
          this.visibleNodes.delete(id);
          // 节点变为不可见，可以降低细节或释放内存
          this.memoryManager.markAsUnused(id);
        }
      }

      // 更新LOD
      lod.update(this.camera);
    });

    // 执行内存清理
    this.memoryManager.cleanupUnused(this.nodeMap);
  }

  /**
   * 释放所有资源
   */
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
    this.memoryManager.dispose();
  }
}

/**
 * 内存管理器
 * 处理节点的内存分配和释放
 */
class MemoryManager {
  private unusedTimeout: number = 5000; // 5秒后释放未使用的节点
  private lastUsed: Map<string, number> = new Map();
  private toDispose: Set<string> = new Set();
  private cleanupInterval: number;

  constructor() {
    // 每秒钟检查一次未使用的节点
    this.cleanupInterval = window.setInterval(() => {
      this.checkUnused();
    }, 1000);
  }

  /**
   * 标记节点为已使用
   * @param id 节点ID
   */
  markAsUsed(id: string) {
    this.lastUsed.set(id, Date.now());
    this.toDispose.delete(id);
  }

  /**
   * 标记节点为未使用
   * @param id 节点ID
   */
  markAsUnused(id: string) {
    this.lastUsed.set(id, Date.now());
    this.toDispose.add(id);
  }

  /**
   * 检查未使用的节点
   */
  private checkUnused() {
    const now = Date.now();

    this.toDispose.forEach(id => {
      const lastUsedTime = this.lastUsed.get(id) || 0;

      if (now - lastUsedTime > this.unusedTimeout) {
        // 可以释放节点资源
        this.lastUsed.delete(id);
        this.toDispose.delete(id);
      }
    });
  }

  /**
   * 清理未使用的节点
   * @param nodeMap 节点映射
   */
  cleanupUnused(nodeMap: Map<string, { mesh: THREE.Mesh; lod: THREE.LOD; node: DependencyNode }>) {
    // 实际项目中，这里可以根据内存使用情况决定是否释放资源
    // 为了简化，我们只记录但不实际释放
  }

  /**
   * 释放所有资源
   */
  dispose() {
    clearInterval(this.cleanupInterval);
    this.lastUsed.clear();
    this.toDispose.clear();
  }
}