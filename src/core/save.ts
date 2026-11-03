import { content } from './content.ts';
import { SAVE_VERSION, type GameState, type PlotState } from './types.ts';

export function serialize(state: GameState): string {
  return JSON.stringify(state);
}

export function deserialize(raw: string): GameState | null {
  try {
    const data: unknown = JSON.parse(raw);
    if (!isGameState(data)) return null;
    return data;
  } catch {
    return null;
  }
}

function isGameState(value: unknown): value is GameState {
  if (!isRecord(value)) return false;
  if (value.version !== SAVE_VERSION) return false;
  if (!isNonNegativeInt(value.coins) || !isNonNegativeInt(value.rngState)) return false;
  if (typeof value.lastTickAt !== 'number' || !Number.isFinite(value.lastTickAt)) return false;
  if (!isCountRecord(value.upgrades)) return false;
  if (!isPiles(value.inventory) || !isPiles(value.collection)) return false;
  if (value.pending !== null && !isPending(value.pending)) return false;
  if (!isRecord(value.fishing)) return false;
  if (!isFiniteNumber(value.fishing.manualNextAt) || !isFiniteNumber(value.fishing.autoNextAt)) {
    return false;
  }
  if (!Array.isArray(value.plots) || value.plots.length !== content.balance.plotCount) return false;
  return value.plots.every(isPlot);
}

function isPlot(value: unknown): value is PlotState {
  if (!isRecord(value)) return false;
  const empty = value.cropId === null && value.plantedAt === null && value.readyAt === null;
  const planted =
    typeof value.cropId === 'string' &&
    isFiniteNumber(value.plantedAt) &&
    isFiniteNumber(value.readyAt);
  return empty || planted;
}

function isPending(value: unknown): boolean {
  if (!isRecord(value) || !isNonNegativeInt(value.elapsedMs)) return false;
  return isCountRecord(value.fish) && isCountRecord(value.crops);
}

function isPiles(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return isCountRecord(value.fish) && isCountRecord(value.crops);
}

function isCountRecord(value: unknown): value is Record<string, number> {
  if (!isRecord(value)) return false;
  return Object.values(value).every(isNonNegativeInt);
}

function isNonNegativeInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
