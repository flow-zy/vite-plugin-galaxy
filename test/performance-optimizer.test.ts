import * as THREE from 'three';
import { expect } from 'chai';
import { PerformanceOptimizer } from '../src/core/performance-optimization';

// 模拟浏览器环境
global.window = { innerWidth: 800, innerHeight: 600 } as any;

describe('PerformanceOptimizer', () => {
  let camera: THREE.PerspectiveCamera;
  let scene: THREE.Scene;
  let optimizer: PerformanceOptimizer;

  beforeEach(() => {
    // 创建相机和场景
    camera = new THREE.PerspectiveCamera(75, 800 / 600, 0.1, 1000);
    camera.position.z = 5;
    scene = new THREE.Scene();

    // 创建性能优化器
    optimizer = new PerformanceOptimizer(camera, scene);
  });

  afterEach(() => {
    optimizer.dispose();
  });

  it('应该正确初始化', () => {
    expect(optimizer).to.be.instanceOf(PerformanceOptimizer);
    expect(optimizer['lodLevels']).to.deep.equal([10, 20, 40]);
    expect(optimizer['nodeMap']).to.be.instanceOf(Map);
    expect(optimizer['visibleNodes']).to.be.instanceOf(Set);
  });

  it('应该添加和管理节点', () => {
    // 创建测试节点
    const geometry = new THREE.SphereGeometry(0.5, 32, 32);
    const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    // 节点数据
    const nodeData = { 
      id: 'test-node', 
      name: 'Test Node', 
      version: '1.0.0',
      size: 10000, 
      depth: 1, 
      isGhost: false, 
      isLarge: false, 
      lastUpdated: Date.now(), 
      dependencies: [], 
      type: 'util'
    };

    // 添加节点到优化器
    optimizer.addNode('test-node', nodeData, mesh);

    // 检查节点是否被正确管理
    expect(optimizer['nodeMap'].has('test-node')).to.be.true;
    const nodeInfo = optimizer['nodeMap'].get('test-node');
    expect(nodeInfo).to.not.be.undefined;
    expect(nodeInfo?.node).to.equal(nodeData);
    expect(nodeInfo?.mesh).to.equal(mesh);
    expect(nodeInfo?.lod).to.be.instanceOf(THREE.LOD);

    // 检查场景中是否替换了网格
    expect(scene.children).to.include(nodeInfo?.lod);
    expect(scene.children).to.not.include(mesh);
  });

  it('应该更新可见节点', () => {
    // 创建两个测试节点
    const geometry1 = new THREE.SphereGeometry(0.5, 32, 32);
    const material1 = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const mesh1 = new THREE.Mesh(geometry1, material1);
    mesh1.position.set(0, 0, 0); // 在视锥内
    scene.add(mesh1);

    const geometry2 = new THREE.SphereGeometry(0.5, 32, 32);
    const material2 = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const mesh2 = new THREE.Mesh(geometry2, material2);
    mesh2.position.set(100, 0, 0); // 在视锥外
    scene.add(mesh2);

    // 节点数据
    const nodeData1 = { 
      id: 'node1', 
      name: 'Node 1', 
      version: '1.0.0',
      size: 10000, 
      depth: 1, 
      isGhost: false, 
      isLarge: false, 
      lastUpdated: Date.now(), 
      dependencies: [], 
      type: 'util'
    };

    const nodeData2 = { 
      id: 'node2', 
      name: 'Node 2', 
      version: '1.0.0',
      size: 10000, 
      depth: 1, 
      isGhost: false, 
      isLarge: false, 
      lastUpdated: Date.now(), 
      dependencies: [], 
      type: 'util'
    };

    // 添加节点到优化器
    optimizer.addNode('node1', nodeData1, mesh1);
    optimizer.addNode('node2', nodeData2, mesh2);

    // 初始状态下两个节点都应该可见
    expect(optimizer['visibleNodes'].has('node1')).to.be.true;
    expect(optimizer['visibleNodes'].has('node2')).to.be.true;

    // 更新可见节点
    optimizer.updateVisibleNodes();

    // 第一个节点应该可见，第二个节点应该不可见
    expect(optimizer['visibleNodes'].has('node1')).to.be.true;
    expect(optimizer['visibleNodes'].has('node2')).to.be.false;
  });

  it('应该正确处理LOD级别', () => {
    // 创建测试节点
    const geometry = new THREE.SphereGeometry(0.5, 32, 32);
    const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    // 添加节点到优化器
    optimizer.addNode('test-node', { id: 'test-node', name: 'Test Node', size: 10000 }, mesh);

    const nodeInfo = optimizer['nodeMap'].get('test-node');
    expect(nodeInfo).to.not.be.undefined;
    expect(nodeInfo?.lod.levels.length).to.equal(3);

    // 测试不同距离下的LOD级别
    camera.position.z = 5; // 近距离
    nodeInfo?.lod.update(camera);
    expect(nodeInfo?.lod.getCurrentLevel()).to.equal(0);

    camera.position.z = 15; // 中等距离
    nodeInfo?.lod.update(camera);
    expect(nodeInfo?.lod.getCurrentLevel()).to.equal(1);

    camera.position.z = 45; // 远距离
    nodeInfo?.lod.update(camera);
    expect(nodeInfo?.lod.getCurrentLevel()).to.equal(2);
  });

  it('应该正确清理资源', () => {
    // 创建测试节点
    const geometry = new THREE.SphereGeometry(0.5, 32, 32);
    const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    // 添加节点到优化器
    optimizer.addNode('test-node', { id: 'test-node', name: 'Test Node', size: 10000 }, mesh);

    expect(optimizer['nodeMap'].size).to.equal(1);
    expect(optimizer['visibleNodes'].size).to.equal(1);

    // 清理资源
    optimizer.dispose();

    expect(optimizer['nodeMap'].size).to.equal(0);
    expect(optimizer['visibleNodes'].size).to.equal(0);
  });
});