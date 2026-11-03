import type { UpgradeEffect } from '../data/validate.ts';
import { content } from './content.ts';
import { autoCastMs } from './formulas.ts';
import type { ActionResult, GameState } from './types.ts';

export interface UpgradeView {
  id: string;
  name: string;
  description: string;
  effect: UpgradeEffect;
  automation: boolean;
  level: number;
  maxLevel: number;
  nextCost: number | null;
  canAfford: boolean;
  isMaxed: boolean;
}

export function getUpgradeView(state: GameState, id: string): UpgradeView | null {
  const def = content.upgrades.find((entry) => entry.id === id);
  if (!def) return null;
  const level = state.upgrades[def.id] ?? 0;
  const isMaxed = level >= def.maxLevel;
  const nextCost = isMaxed ? null : (def.costs[level] ?? null);
  const canAfford = nextCost !== null && state.coins >= nextCost;
  return {
    id: def.id,
    name: def.name,
    description: def.description,
    effect: def.effect,
    automation: def.automation,
    level,
    maxLevel: def.maxLevel,
    nextCost,
    canAfford,
    isMaxed,
  };
}

export function getUpgradeViews(state: GameState): UpgradeView[] {
  return content.upgrades
    .map((def) => getUpgradeView(state, def.id))
    .filter((view): view is UpgradeView => view !== null);
}

export function buyUpgrade(
  state: GameState,
  id: string,
): ActionResult<{ id: string; level: number; cost: number }> {
  const def = content.upgrades.find((entry) => entry.id === id);
  if (!def) {
    return { ok: false, reason: 'unknown_upgrade' };
  }
  const currentLevel = state.upgrades[def.id] ?? 0;
  if (currentLevel >= def.maxLevel) {
    return { ok: false, reason: 'max_level' };
  }
  const cost = def.costs[currentLevel];
  if (cost === undefined) {
    return { ok: false, reason: 'max_level' };
  }
  if (state.coins < cost) {
    return { ok: false, reason: 'insufficient_coins' };
  }

  state.coins -= cost;
  const nextLevel = currentLevel + 1;
  state.upgrades[def.id] = nextLevel;

  if (def.effect === 'auto_fisher') {
    const rodLevel = state.upgrades.rod ?? 0;
    state.fishing.autoNextAt = state.lastTickAt + autoCastMs(rodLevel);
  }

  return { ok: true, value: { id: def.id, level: nextLevel, cost } };
}
