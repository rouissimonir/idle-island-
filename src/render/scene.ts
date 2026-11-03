import * as THREE from 'three';
import { content } from '../core/content.ts';
import { findAsset, loadModel } from './assets.ts';
import { MAX_PIXEL_RATIO, nextFrameDecision } from './loop.ts';
import { SCENE_ASSETS, type SceneAssetId } from './props.ts';

const ZOOM = 5.6;

export interface IslandView {
  dispose: () => void;
}

export async function mountScene(canvas: HTMLCanvasElement): Promise<IslandView> {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'low-power',
  });
  renderer.setClearColor('#b7dcea');
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = false;

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 80);
  const hemi = new THREE.HemisphereLight('#fff4e0', '#7f9a62', 0.9);
  const sun = new THREE.DirectionalLight('#fff0d4', 1.15);
  sun.position.set(6, 10, 4);
  scene.add(hemi, sun);

  await mountProps(scene);

  let raf = 0;
  let running = false;
  let dirty = true;
  let last = 0;

  const frame = (time: number): void => {
    const decision = nextFrameDecision({
      hidden: document.hidden,
      elapsedMs: time - last,
      dirty,
      animating: false,
    });
    if (decision.render) {
      last = time;
      renderer.render(scene, camera);
      dirty = false;
    }
    if (decision.continueLoop) raf = requestAnimationFrame(frame);
    else running = false;
  };

  const requestRender = (): void => {
    dirty = true;
    if (running || document.hidden) return;
    running = true;
    raf = requestAnimationFrame(frame);
  };

  const resize = (): void => {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (width < 1 || height < 1) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
    renderer.setSize(width, height, false);
    const aspect = width / height;
    camera.left = -ZOOM * aspect;
    camera.right = ZOOM * aspect;
    camera.top = ZOOM;
    camera.bottom = -ZOOM;
    camera.position.set(12, 10, 12);
    camera.lookAt(0, 0.2, 0);
    camera.updateProjectionMatrix();
    requestRender();
  };

  const onVisibility = (): void => {
    if (document.hidden) {
      cancelAnimationFrame(raf);
      running = false;
      return;
    }
    requestRender();
  };

  const observer = new ResizeObserver(() => resize());
  observer.observe(canvas);
  document.addEventListener('visibilitychange', onVisibility);
  resize();

  return {
    dispose() {
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      cancelAnimationFrame(raf);
      renderer.dispose();
    },
  };
}

async function mountProps(scene: THREE.Scene): Promise<void> {
  const placed: {
    id: SceneAssetId;
    name: string;
    position: [number, number, number];
    kind: string;
    plotIndex?: number;
  }[] = [
    { id: 'water', name: 'water', position: [0, -0.18, 0], kind: 'water' },
    { id: 'island', name: 'island', position: [0, 0, 0], kind: 'ground' },
    { id: 'dock', name: 'dock', position: [0.2, 0.08, 2.15], kind: 'water' },
    { id: 'cottage', name: 'cottage', position: [1.2, 0.02, -0.55], kind: 'ground' },
    { id: 'tree', name: 'tree', position: [0.15, 0.02, -1.35], kind: 'ground' },
    { id: 'rock', name: 'rock', position: [-2.05, 0.02, 0.85], kind: 'ground' },
  ];
  const cols = Math.ceil(Math.sqrt(content.balance.plotCount));
  for (let index = 0; index < content.balance.plotCount; index += 1) {
    const col = index % cols;
    const row = Math.floor(index / cols);
    placed.push({
      id: 'plot',
      name: `plot-${index}`,
      position: [-1.35 + col * 0.92, 0.05, -0.15 + row * 0.92],
      kind: 'plot',
      plotIndex: index,
    });
  }
  for (const id of SCENE_ASSETS) {
    if (!findAsset(id)) throw new Error(`assets/assets.json is missing "${id}"`);
  }
  for (const prop of placed) {
    const entry = findAsset(prop.id);
    if (!entry) continue;
    const group = new THREE.Group();
    group.name = prop.name;
    group.position.set(prop.position[0], prop.position[1], prop.position[2]);
    group.userData = { kind: prop.kind, assetId: prop.id, plotIndex: prop.plotIndex ?? null };
    group.add(placeholder(prop.id));
    const model = await loadModel(entry);
    if (model) {
      group.clear();
      group.add(model);
    }
    scene.add(group);
  }
}

function placeholder(id: SceneAssetId): THREE.Object3D {
  switch (id) {
    case 'water': {
      const water = new THREE.Mesh(new THREE.CircleGeometry(9, 40), lambert('#6eb8c8'));
      water.rotation.x = -Math.PI / 2;
      return water;
    }
    case 'island':
      return islandMesh();
    case 'dock':
      return dockMesh();
    case 'plot':
      return plotMesh();
    case 'tree':
      return treeMesh();
    case 'cottage':
      return cottageMesh();
    case 'rock':
      return rockMesh();
    default:
      return new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), lambert('#cccccc'));
  }
}

function islandMesh(): THREE.Group {
  const group = new THREE.Group();
  const sand = new THREE.Mesh(new THREE.CylinderGeometry(3.05, 3.35, 0.8, 8), lambert('#e6c98a'));
  sand.position.y = -0.4;
  const grass = new THREE.Mesh(new THREE.CircleGeometry(2.55, 8), lambert('#8fb56a'));
  grass.rotation.x = -Math.PI / 2;
  grass.position.y = 0.02;
  group.add(sand, grass);
  return group;
}

function dockMesh(): THREE.Group {
  const group = new THREE.Group();
  for (let index = 0; index < 5; index += 1) {
    const plank = new THREE.Mesh(
      new THREE.BoxGeometry(0.78, 0.08, 0.22),
      lambert(index % 2 === 0 ? '#b07543' : '#8d5a32'),
    );
    plank.position.set(0, 0, index * 0.24);
    group.add(plank);
  }
  for (const x of [-0.28, 0.28]) {
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 0.55, 6),
      lambert('#6b4228'),
    );
    post.position.set(x, -0.24, 0.95);
    group.add(post);
  }
  return group;
}

function plotMesh(): THREE.Group {
  const group = new THREE.Group();
  const soil = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.1, 0.7), lambert('#6d4632'));
  const anchor = new THREE.Object3D();
  anchor.name = 'cropAnchor';
  anchor.position.y = 0.2;
  group.add(soil, anchor);
  return group;
}

function treeMesh(): THREE.Group {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.45, 6), lambert('#7d5233'));
  trunk.position.y = 0.22;
  const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(0.38, 0), lambert('#5f8f45'));
  leaves.position.y = 0.62;
  group.add(trunk, leaves);
  return group;
}

function cottageMesh(): THREE.Group {
  const group = new THREE.Group();
  const wall = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.62, 0.75), lambert('#f3e2c4'));
  wall.position.y = 0.31;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.72, 0.42, 4), lambert('#d36b55'));
  roof.position.y = 0.78;
  roof.rotation.y = Math.PI / 4;
  group.add(wall, roof);
  return group;
}

function rockMesh(): THREE.Mesh {
  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.28, 0), lambert('#c5beb2'));
  rock.scale.set(1.2, 0.7, 1);
  rock.position.y = 0.12;
  return rock;
}

function lambert(color: string): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ color });
}
