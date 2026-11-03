export const SAVE_VERSION = 2 as const;

export interface PlotState {
  cropId: string | null;
  plantedAt: number | null;
  readyAt: number | null;
}

export interface ItemPiles {
  fish: Record<string, number>;
  crops: Record<string, number>;
}

export interface PendingRewards extends ItemPiles {
  elapsedMs: number;
  capped: boolean;
}

/** Serializable save blob. */
export interface GameState {
  version: typeof SAVE_VERSION;
  rngState: number;
  coins: number;
  lastTickAt: number;
  upgrades: Record<string, number>;
  inventory: ItemPiles;
  collection: ItemPiles;
  pending: PendingRewards | null;
  fishing: { manualNextAt: number; autoNextAt: number };
  plots: PlotState[];
}

export type ActionResult<T> = { ok: true; value: T } | { ok: false; reason: string };
