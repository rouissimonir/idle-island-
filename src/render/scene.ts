import * as THREE from 'three';
import { content } from '../core/content.ts';
import type { GameState } from '../core/types.ts';
import type { ProjectTarget } from '../debug.ts';
import { findAsset, loadModel } from './assets.ts';
import { MAX_PIXEL_RATIO, nextFrameDecision } from './loop.ts';
import { SCENE_ASSETS, type SceneAssetId } from './props.ts';

const BASE_ZOOM = 5.6;
const MIN_ZOOM = 3.6;
const MAX_ZOOM = 8.0;
const SPLASH_DURATION_MS = 450;

export interface SceneInteractions {
  onWaterTap?: () => void;
  onPlotTap?: (plotIndex: number) => void;
}

export interface IslandView {
  syncState: (state: GameState, now: number) => void;
  triggerSplash: (colorHex?: string) => void;
  project: (target: ProjectTarget) => { x: number; y: number } | null;
  dispose: () => void;
}

interface PlotVisuals {
  group: THREE.Group;
  anchor: THREE.Object3D;
  sproutGroup: THREE.Group;
  stemMesh: THREE.Mesh;
  bulbMesh: THREE.Mesh;
  ripeRing: THREE.Mesh;
  bulbMaterial: THREE.MeshLambertMaterial;
}

export async function mountScene(
  canvas: HTMLCanvasElement,
  interactions: SceneInteractions = {},
): Promise<IslandView> {
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
  const hemi = new THREE.HemisphereLight('#fff4e0', '#7f9a62', 0.95);
  const sun = new THREE.DirectionalLight('#fff0d4', 1.15);
  sun.position.set(6, 10, 4);
  scene.add(hemi, sun);

  const { interactables, plotVisuals, splashGroup, splashRingMat, splashBobberMat } =
    await mountProps(scene);

  let yaw = Math.PI / 4;
  let zoom = BASE_ZOOM;
  let raf = 0;
  let running = false;
  let dirty = true;
  let last = 0;
  let splashEndAt = 0;

  const updateCamera = (): void => {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (width < 1 || height < 1) return;
    const aspect = width / height;
    camera.left = -zoom * aspect;
    camera.right = zoom * aspect;
    camera.top = zoom;
    camera.bottom = -zoom;
    const radius = Math.hypot(12, 12);
    camera.position.set(Math.sin(yaw) * radius, 10, Math.cos(yaw) * radius);
    camera.lookAt(0, 0.2, 0);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  };

  const frame = (time: number): void => {
    const isSplashing = time < splashEndAt;
    if (isSplashing) {
      const progress = Math.max(0, Math.min(1, 1 - (splashEndAt - time) / SPLASH_DURATION_MS));
      splashGroup.visible = true;
      const scale = 0.5 + progress * 1.4;
      splashGroup.scale.set(scale, 1, scale);
      splashGroup.position.y = -0.12 + Math.sin(progress * Math.PI) * 0.12;
    } else if (splashGroup.visible) {
      splashGroup.visible = false;
      dirty = true;
    }

    const decision = nextFrameDecision({
      hidden: document.hidden,
      elapsedMs: time - last,
      dirty,
      animating: isSplashing,
    });
    if (decision.render) {
      last = time;
      renderer.render(scene, camera);
      dirty = false;
    }
    if (decision.continueLoop) {
      raf = requestAnimationFrame(frame);
    } else {
      running = false;
    }
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
    updateCamera();
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

  // Raycasting and gentle yaw/zoom gestures
  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();
  const scratchVec = new THREE.Vector3();

  let pointerDown = false;
  let startX = 0;
  let startY = 0;
  let startYaw = yaw;
  let dragged = false;

  const onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    pointerDown = true;
    dragged = false;
    startX = event.clientX;
    startY = event.clientY;
    startYaw = yaw;
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (!pointerDown) return;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    if (Math.hypot(dx, dy) > 6) {
      dragged = true;
    }
    if (dragged) {
      yaw = startYaw - dx * 0.007;
      updateCamera();
      requestRender();
    }
  };

  const handleTap = (clientX: number, clientY: number): void => {
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointerNdc, camera);

    const hits = raycaster.intersectObjects(interactables, true);
    for (const hit of hits) {
      const tagged = findTaggedGroup(hit.object);
      if (!tagged) continue;
      const kind = tagged.userData.kind as string | undefined;
      if (kind === 'plot') {
        const plotIndex = tagged.userData.plotIndex as number | null;
        if (typeof plotIndex === 'number') {
          interactions.onPlotTap?.(plotIndex);
          return;
        }
      }
      if (kind === 'water') {
        interactions.onWaterTap?.();
        return;
      }
      if (kind === 'ground') {
        // Ignore clicks on ground/cottage/tree/rock that occlude water behind them
        return;
      }
    }
  };

  const onPointerUp = (event: PointerEvent): void => {
    if (!pointerDown) return;
    pointerDown = false;
    if (!dragged) {
      handleTap(event.clientX, event.clientY);
    }
  };

  const onPointerCancel = (): void => {
    pointerDown = false;
    dragged = false;
  };

  const onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    const factor = event.deltaY > 0 ? 1.06 : 0.94;
    zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * factor));
    updateCamera();
    requestRender();
  };

  canvas.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerCancel);
  canvas.addEventListener('wheel', onWheel, { passive: false });

  const observer = new ResizeObserver(() => resize());
  observer.observe(canvas);
  document.addEventListener('visibilitychange', onVisibility);
  resize();

  const syncState = (state: GameState, now: number): void => {
    let changed = false;
    for (let i = 0; i < plotVisuals.length; i += 1) {
      const visual = plotVisuals[i];
      const plot = state.plots[i];
      if (!visual || !plot) continue;

      if (plot.cropId === null || plot.plantedAt === null || plot.readyAt === null) {
        if (visual.sproutGroup.visible) {
          visual.sproutGroup.visible = false;
          changed = true;
        }
        continue;
      }

      const crop = content.crops.find((c) => c.id === plot.cropId);
      if (!crop) continue;

      const total = Math.max(1, plot.readyAt - plot.plantedAt);
      const elapsed = Math.max(0, now - plot.plantedAt);
      const progress = Math.min(1, elapsed / total);
      const isRipe = now >= plot.readyAt;

      if (!visual.sproutGroup.visible) {
        visual.sproutGroup.visible = true;
        changed = true;
      }

      visual.bulbMaterial.color.set(crop.color);
      const targetScale = 0.45 + progress * 0.65;
      if (Math.abs(visual.sproutGroup.scale.x - targetScale) > 0.02) {
        visual.sproutGroup.scale.setScalar(targetScale);
        changed = true;
      }
      if (visual.ripeRing.visible !== isRipe) {
        visual.ripeRing.visible = isRipe;
        changed = true;
      }
    }
    if (changed) {
      requestRender();
    }
  };

  const triggerSplash = (colorHex = '#ffffff'): void => {
    const reducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) {
      requestRender();
      return;
    }
    splashBobberMat.color.set(colorHex);
    splashRingMat.color.set('#e8f9ff');
    splashEndAt = performance.now() + SPLASH_DURATION_MS;
    splashGroup.visible = true;
    requestRender();
  };

  const project = (target: ProjectTarget): { x: number; y: number } | null => {
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return null;
    updateCamera();

    if (target === 'water') {
      scratchVec.set(0.2, -0.15, 3.6);
    } else if (target === 'dock') {
      scratchVec.set(0.2, 0.1, 2.6);
    } else {
      let plotIndex = -1;
      if (typeof target === 'number') {
        plotIndex = target;
      } else if (typeof target === 'object' && target !== null && 'plot' in target) {
        plotIndex = target.plot;
      } else if (typeof target === 'string' && target.startsWith('plot-')) {
        plotIndex = Number(target.slice(5));
      }
      const visual = plotVisuals[plotIndex];
      if (!visual) return null;
      visual.group.getWorldPosition(scratchVec);
      scratchVec.y += 0.1;
    }

    scratchVec.project(camera);
    const x = Math.round(rect.left + ((scratchVec.x + 1) / 2) * rect.width);
    const y = Math.round(rect.top + ((-scratchVec.y + 1) / 2) * rect.height);
    return { x, y };
  };

  return {
    syncState,
    triggerSplash,
    project,
    dispose() {
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerCancel);
      canvas.removeEventListener('wheel', onWheel);
      cancelAnimationFrame(raf);
      renderer.dispose();
    },
  };
}

function findTaggedGroup(obj: THREE.Object3D | null): THREE.Object3D | null {
  let current: THREE.Object3D | null = obj;
  while (current) {
    if (current.userData && typeof current.userData.kind === 'string') {
      return current;
    }
    current = current.parent;
  }
  return null;
}

async function mountProps(scene: THREE.Scene): Promise<{
  interactables: THREE.Object3D[];
  plotVisuals: PlotVisuals[];
  splashGroup: THREE.Group;
  splashRingMat: THREE.MeshLambertMaterial;
  splashBobberMat: THREE.MeshLambertMaterial;
}> {
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

  const interactables: THREE.Object3D[] = [];
  const plotVisuals: PlotVisuals[] = [];

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

    if (prop.kind === 'plot' && typeof prop.plotIndex === 'number') {
      let anchor = group.getObjectByName('cropAnchor');
      if (!anchor) {
        anchor = new THREE.Object3D();
        anchor.name = 'cropAnchor';
        anchor.position.set(0, 0.25, 0);
        group.add(anchor);
      }
      const sprout = createCropVisual(anchor);
      plotVisuals[prop.plotIndex] = {
        group,
        anchor,
        ...sprout,
      };
    }

    scene.add(group);
    interactables.push(group);
  }

  // Pre-allocated splash/bobber visual for fishing casts (zero per-frame allocations)
  const splashGroup = new THREE.Group();
  splashGroup.name = 'fishing-splash';
  splashGroup.position.set(0.2, -0.12, 3.45);
  splashGroup.visible = false;

  const splashRingMat = lambert('#e8f9ff');
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.18, 0.32, 16), splashRingMat);
  ring.rotation.x = -Math.PI / 2;

  const splashBobberMat = lambert('#f26a4b');
  const bobber = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 10), splashBobberMat);
  bobber.position.y = 0.08;

  splashGroup.add(ring, bobber);
  scene.add(splashGroup);

  return { interactables, plotVisuals, splashGroup, splashRingMat, splashBobberMat };
}

function createCropVisual(anchor: THREE.Object3D): {
  sproutGroup: THREE.Group;
  stemMesh: THREE.Mesh;
  bulbMesh: THREE.Mesh;
  ripeRing: THREE.Mesh;
  bulbMaterial: THREE.MeshLambertMaterial;
} {
  const sproutGroup = new THREE.Group();
  sproutGroup.visible = false;

  const stemMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.06, 0.22, 6),
    lambert('#4e8c3a'),
  );
  stemMesh.position.y = 0.14;

  const bulbMaterial = lambert('#e6c36a');
  const bulbMesh = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18, 0), bulbMaterial);
  bulbMesh.position.y = 0.02;

  const ripeRing = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.3, 12), lambert('#ffe066'));
  ripeRing.rotation.x = -Math.PI / 2;
  ripeRing.position.y = -0.08;
  ripeRing.visible = false;

  sproutGroup.add(stemMesh, bulbMesh, ripeRing);
  anchor.add(sproutGroup);

  return { sproutGroup, stemMesh, bulbMesh, ripeRing, bulbMaterial };
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
