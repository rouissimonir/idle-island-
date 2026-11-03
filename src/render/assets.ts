import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as THREE from 'three';
import manifestJson from '../../assets/assets.json' with { type: 'json' };
import { parseAssets, type AssetEntry } from '../data/validate.ts';

const parsed = parseAssets(manifestJson);
if (!parsed.ok) {
  throw new Error(`Invalid assets/assets.json:\n${parsed.errors.join('\n')}`);
}

export const assetManifest = parsed.value;

export function findAsset(id: string): AssetEntry | undefined {
  return assetManifest.assets.find((asset) => asset.id === id);
}

export function modelUrl(file: string): string {
  return `${import.meta.env.BASE_URL}assets/${file}`;
}

const GLB_MAGIC = 0x46546c67;
const GLB_VERSION = 2;

/** Loads a GLB when the manifest `file` is set. `null` means keep the placeholder. */
export async function loadModel(entry: AssetEntry): Promise<THREE.Group | null> {
  if (!entry.file) return null;
  try {
    const response = await fetch(modelUrl(entry.file));
    if (!response.ok) return null;
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength < 12) return null;
    const header = new DataView(buffer, 0, 12);
    if (
      header.getUint32(0, true) !== GLB_MAGIC ||
      header.getUint32(4, true) !== GLB_VERSION ||
      header.getUint32(8, true) > buffer.byteLength
    ) {
      return null;
    }
    const loader = new GLTFLoader();
    const gltf = await loader.parseAsync(buffer, '');
    gltf.scene.scale.multiplyScalar(entry.scale);
    return gltf.scene;
  } catch {
    return null;
  }
}
