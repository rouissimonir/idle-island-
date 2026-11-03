/** Manifest ids the placeholder scene mounts. A missing id is a boot error. */
export const SCENE_ASSETS = ['water', 'island', 'dock', 'plot', 'tree', 'cottage', 'rock'] as const;

export type SceneAssetId = (typeof SCENE_ASSETS)[number];
