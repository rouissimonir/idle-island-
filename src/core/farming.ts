import type { CropDef } from '../data/validate.ts';
import { content } from './content.ts';
import { growMs } from './formulas.ts';
import type { ActionResult, GameState, PlotState } from './types.ts';

export function addCropToPile(pile: Record<string, number>, cropId: string, count = 1): void {
  pile[cropId] = (pile[cropId] ?? 0) + count;
}

export function currentCropGrowMs(state: GameState, crop: CropDef): number {
  const soilLevel = state.upgrades.soil ?? 0;
  const sprinklerOwned = (state.upgrades.sprinkler ?? 0) > 0;
  return growMs(crop, soilLevel, sprinklerOwned);
}

export function plantPlot(
  state: GameState,
  index: number,
  cropId: string,
  now: number,
): ActionResult<PlotState> {
  if (!Number.isInteger(index) || index < 0 || index >= state.plots.length) {
    return { ok: false, reason: 'invalid_plot' };
  }
  const plot = state.plots[index];
  if (!plot) {
    return { ok: false, reason: 'invalid_plot' };
  }
  if (plot.cropId !== null) {
    return { ok: false, reason: 'occupied' };
  }
  const crop = content.crops.find((entry) => entry.id === cropId);
  if (!crop) {
    return { ok: false, reason: 'unknown_crop' };
  }

  const duration = currentCropGrowMs(state, crop);
  plot.cropId = crop.id;
  plot.plantedAt = now;
  plot.readyAt = now + duration;

  return {
    ok: true,
    value: {
      cropId: plot.cropId,
      plantedAt: plot.plantedAt,
      readyAt: plot.readyAt,
    },
  };
}

export function harvestPlot(state: GameState, index: number, now: number): ActionResult<CropDef> {
  if (!Number.isInteger(index) || index < 0 || index >= state.plots.length) {
    return { ok: false, reason: 'invalid_plot' };
  }
  const plot = state.plots[index];
  if (!plot || plot.cropId === null || plot.readyAt === null) {
    return { ok: false, reason: 'empty' };
  }
  if (now < plot.readyAt) {
    return { ok: false, reason: 'not_ready' };
  }
  const crop = content.crops.find((entry) => entry.id === plot.cropId);
  if (!crop) {
    return { ok: false, reason: 'unknown_crop' };
  }

  addCropToPile(state.inventory.crops, crop.id, 1);
  addCropToPile(state.collection.crops, crop.id, 1);

  plot.cropId = null;
  plot.plantedAt = null;
  plot.readyAt = null;

  return { ok: true, value: crop };
}
