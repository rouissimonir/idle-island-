import { content } from './content.ts';
import { SAVE_VERSION, type GameState, type PendingRewards, type PlotState } from './types.ts';

export function serialize(state: GameState): string {
  return JSON.stringify(state);
}

export function deserialize(raw: string): GameState | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    const migrated = migrateSave(parsed);
    if (!isGameState(migrated)) return null;
    return migrated;
  } catch {
    return null;
  }
}

function migrateSave(value: unknown): unknown {
  if (!isRecord(value)) return value;
  if (value.version === 1) {
    const next: Record<string, unknown> = { ...value, version: SAVE_VERSION };
    if (isRecord(value.pending) && typeof value.pending.capped !== 'boolean') {
      next.pending = { ...value.pending, capped: false };
    }
    return next;
  }
  return value;
}

const UPGRADE_MAX = new Map(content.upgrades.map((u) => [u.id, u.maxLevel]));
const FISH_IDS = new Set(content.fish.map((f) => f.id));
const CROP_IDS = new Set(content.crops.map((c) => c.id));

function isGameState(value: unknown): value is GameState {
  if (!isRecord(value)) return false;
  if (value.version !== SAVE_VERSION) return false;
  if (!isNonNegativeInt(value.coins) || !isNonNegativeInt(value.rngState)) return false;
  if (typeof value.lastTickAt !== 'number' || !Number.isFinite(value.lastTickAt)) return false;
  if (!isValidUpgrades(value.upgrades)) return false;
  if (!isPiles(value.inventory) || !isPiles(value.collection)) return false;
  if (value.pending !== null && !isPending(value.pending)) return false;
  if (!isRecord(value.fishing)) return false;
  if (!isFiniteNumber(value.fishing.manualNextAt) || !isFiniteNumber(value.fishing.autoNextAt)) {
    return false;
  }
  if (!Array.isArray(value.plots) || value.plots.length !== content.balance.plotCount) return false;
  return value.plots.every(isPlot);
}

function isValidUpgrades(value: unknown): value is Record<string, number> {
  if (!isCountRecord(value)) return false;
  for (const [id, level] of Object.entries(value)) {
    const max = UPGRADE_MAX.get(id);
    if (max === undefined || level > max) return false;
  }
  return true;
}

function isPlot(value: unknown): value is PlotState {
  if (!isRecord(value)) return false;
  const empty = value.cropId === null && value.plantedAt === null && value.readyAt === null;
  const planted =
    typeof value.cropId === 'string' &&
    CROP_IDS.has(value.cropId) &&
    isFiniteNumber(value.plantedAt) &&
    isFiniteNumber(value.readyAt);
  return empty || planted;
}

function isPending(value: unknown): value is PendingRewards {
  if (!isRecord(value) || !isNonNegativeInt(value.elapsedMs)) return false;
  if (typeof value.capped !== 'boolean') return false;
  return isKnownCounts(value.fish, FISH_IDS) && isKnownCounts(value.crops, CROP_IDS);
}

function isPiles(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return isKnownCounts(value.fish, FISH_IDS) && isKnownCounts(value.crops, CROP_IDS);
}

function isKnownCounts(value: unknown, allowed: Set<string>): value is Record<string, number> {
  if (!isCountRecord(value)) return false;
  return Object.keys(value).every((key) => allowed.has(key));
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
