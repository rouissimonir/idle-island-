import type { CropDef, FishDef } from './data/validate.ts';
import type { ActionResult, AdvanceReport, GameState, PlotState } from './core/index.ts';

export type ProjectTarget = 'water' | 'dock' | `plot-${number}` | { plot: number } | number;

/** Extended in milestone 2. Keep the name `window.__ISLAND__`. */
export interface IslandDebug {
  ready: boolean;
  getState: () => GameState;
  project: (target: ProjectTarget) => { x: number; y: number } | null;
  fish: () => ActionResult<FishDef>;
  plant: (index: number, cropId?: string) => ActionResult<PlotState>;
  harvest: (index: number) => ActionResult<CropDef>;
  sell: () => number;
  buy: (id: string) => ActionResult<{ id: string; level: number; cost: number }>;
  jumpHours: (hours: number) => AdvanceReport;
  reloadJumpHours: (hours: number) => void;
  reset: () => void;
  collect: (mode: 'sell' | 'stash') => { coinsGained: number; itemsCollected: number };
}
