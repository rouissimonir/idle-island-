import { content } from './content.ts';
import { unitPrice } from './formulas.ts';
import type { GameState, ItemPiles } from './types.ts';

export function pilesValue(piles: ItemPiles, marketLevel: number): number {
  let total = 0;
  for (const fish of content.fish) {
    const count = piles.fish[fish.id] ?? 0;
    if (count > 0) {
      total += unitPrice(fish.sellValue, marketLevel) * count;
    }
  }
  for (const crop of content.crops) {
    const count = piles.crops[crop.id] ?? 0;
    if (count > 0) {
      total += unitPrice(crop.sellValue, marketLevel) * count;
    }
  }
  return total;
}

export function pilesCount(piles: ItemPiles): number {
  let count = 0;
  for (const value of Object.values(piles.fish)) {
    count += value;
  }
  for (const value of Object.values(piles.crops)) {
    count += value;
  }
  return count;
}

export function basketValue(state: GameState): number {
  return pilesValue(state.inventory, state.upgrades.market ?? 0);
}

export function pendingValue(state: GameState): number {
  if (!state.pending) return 0;
  return pilesValue(state.pending, state.upgrades.market ?? 0);
}

export function basketCount(state: GameState): number {
  return pilesCount(state.inventory);
}

export function pendingCount(state: GameState): number {
  if (!state.pending) return 0;
  return pilesCount(state.pending);
}

export function sellAll(state: GameState): number {
  const gained = basketValue(state);
  state.coins += gained;
  state.inventory = { fish: {}, crops: {} };
  return gained;
}

export function collectPending(
  state: GameState,
  mode: 'sell' | 'stash',
): { coinsGained: number; itemsCollected: number } {
  if (!state.pending) {
    return { coinsGained: 0, itemsCollected: 0 };
  }

  const pending = state.pending;
  const itemsCollected = pilesCount(pending);

  for (const [id, count] of Object.entries(pending.fish)) {
    if (count > 0) {
      state.collection.fish[id] = (state.collection.fish[id] ?? 0) + count;
      if (mode === 'stash') {
        state.inventory.fish[id] = (state.inventory.fish[id] ?? 0) + count;
      }
    }
  }

  for (const [id, count] of Object.entries(pending.crops)) {
    if (count > 0) {
      state.collection.crops[id] = (state.collection.crops[id] ?? 0) + count;
      if (mode === 'stash') {
        state.inventory.crops[id] = (state.inventory.crops[id] ?? 0) + count;
      }
    }
  }

  let coinsGained = 0;
  if (mode === 'sell') {
    coinsGained = pilesValue(pending, state.upgrades.market ?? 0);
    state.coins += coinsGained;
  }

  state.pending = null;
  return { coinsGained, itemsCollected };
}
