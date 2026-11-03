import { content } from './content.ts';
import { SAVE_VERSION, type GameState, type PlotState } from './types.ts';

export function createInitialState(now: number, rngState: number): GameState {
  const seed = rngState >>> 0 || 1;
  const plots: PlotState[] = Array.from({ length: content.balance.plotCount }, () => ({
    cropId: null,
    plantedAt: null,
    readyAt: null,
  }));
  return {
    version: SAVE_VERSION,
    rngState: seed,
    coins: 0,
    lastTickAt: now,
    upgrades: {},
    inventory: { fish: {}, crops: {} },
    collection: { fish: {}, crops: {} },
    pending: null,
    fishing: { manualNextAt: now, autoNextAt: now },
    plots,
  };
}
