import type { FishDef } from '../data/validate.ts';
import { content } from './content.ts';
import { manualCastMs } from './formulas.ts';
import { nextUnit } from './rng.ts';
import type { ActionResult, GameState } from './types.ts';

export function clampRodLevel(level: number): number {
  const rodUpgrade = content.upgrades.find((u) => u.effect === 'rod');
  const maxLevel = rodUpgrade ? rodUpgrade.maxLevel : 0;
  return Math.max(0, Math.min(maxLevel, Math.floor(level)));
}

export function rollFish(state: GameState, explicitRodLevel?: number): FishDef {
  const rodLevel = clampRodLevel(explicitRodLevel ?? state.upgrades.rod ?? 0);
  const { value, seed } = nextUnit(state.rngState);
  state.rngState = seed;

  let totalWeight = 0;
  for (const fish of content.fish) {
    totalWeight += fish.weights[rodLevel] ?? 0;
  }

  let x = value * totalWeight;
  let lastNonZero: FishDef | undefined;
  for (const fish of content.fish) {
    const weight = fish.weights[rodLevel] ?? 0;
    if (weight > 0) {
      lastNonZero = fish;
    }
    x -= weight;
    if (x < 0) {
      return fish;
    }
  }

  const fallback = lastNonZero ?? content.fish[content.fish.length - 1];
  if (!fallback) {
    throw new Error('No fish configured');
  }
  return fallback;
}

export function addFishToPile(pile: Record<string, number>, fishId: string, count = 1): void {
  pile[fishId] = (pile[fishId] ?? 0) + count;
}

export function tryFish(state: GameState, now: number): ActionResult<FishDef> {
  if (now < state.fishing.manualNextAt) {
    return { ok: false, reason: 'cooldown' };
  }
  const rodLevel = clampRodLevel(state.upgrades.rod ?? 0);
  const caught = rollFish(state, rodLevel);
  addFishToPile(state.inventory.fish, caught.id, 1);
  addFishToPile(state.collection.fish, caught.id, 1);
  state.fishing.manualNextAt = now + manualCastMs(rodLevel);
  return { ok: true, value: caught };
}
