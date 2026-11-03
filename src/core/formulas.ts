import type { CropDef } from '../data/validate.ts';
import { content } from './content.ts';

export function manualCastMs(rodLevel: number): number {
  const { minManualCastMs, manualCastBaseMs, castLevelFactor } = content.balance;
  const level = Math.max(0, rodLevel);
  return Math.max(minManualCastMs, Math.round(manualCastBaseMs * Math.pow(castLevelFactor, level)));
}

export function autoCastMs(rodLevel: number): number {
  const { minAutoCastMs, autoCastBaseMs, castLevelFactor } = content.balance;
  const level = Math.max(0, rodLevel);
  return Math.max(minAutoCastMs, Math.round(autoCastBaseMs * Math.pow(castLevelFactor, level)));
}

export function growMs(
  cropOrId: CropDef | string,
  soilLevel: number,
  sprinklerOwned: boolean,
): number {
  const crop =
    typeof cropOrId === 'string' ? content.crops.find((entry) => entry.id === cropOrId) : cropOrId;
  if (!crop) {
    const label = typeof cropOrId === 'string' ? cropOrId : cropOrId.id;
    throw new Error(`Unknown crop: ${label}`);
  }
  const { soilGrowFactor, sprinklerGrowFactor } = content.balance;
  const soil = Math.max(0, soilLevel);
  const sprinklerFactor = sprinklerOwned ? sprinklerGrowFactor : 1;
  return Math.round(crop.growSeconds * 1000 * Math.pow(soilGrowFactor, soil) * sprinklerFactor);
}

export function unitPrice(baseOrItem: number | { sellValue: number }, marketLevel: number): number {
  const base = typeof baseOrItem === 'number' ? baseOrItem : baseOrItem.sellValue;
  const level = Math.max(0, marketLevel);
  return Math.round(base * Math.pow(content.balance.marketPriceFactor, level));
}
