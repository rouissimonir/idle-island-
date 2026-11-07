import { pendingCount, pendingValue } from '../core/economy.ts';
import type { GameState } from '../core/types.ts';

/** JSON shape the WidgetKit extension decodes. Keep in sync with docs/NATIVE.md. */
export interface WidgetSnapshot {
  version: 1;
  coins: number;
  pendingValue: number;
  pendingItems: number;
  awayProcessedMs: number;
  nextCropReadyAt: number | null;
  headline: string;
}

export const WIDGET_SNAPSHOT_VERSION = 1 as const;

/**
 * Pure snapshot for Live Activity / home widget / StandBy.
 * Does not advance the economy — Swift only displays this JSON.
 */
export function toWidgetSnapshot(state: GameState, now: number): WidgetSnapshot {
  const pendingItems = pendingCount(state);
  const pendingCoins = pendingValue(state);
  const awayProcessedMs = state.pending?.elapsedMs ?? 0;
  const nextCropReadyAt = nextCropReadyAtMs(state);
  const headline = widgetHeadline({
    pendingItems,
    pendingCoins,
    nextCropReadyAt,
    now,
  });

  return {
    version: WIDGET_SNAPSHOT_VERSION,
    coins: state.coins,
    pendingValue: pendingCoins,
    pendingItems,
    awayProcessedMs,
    nextCropReadyAt,
    headline,
  };
}

export function nextCropReadyAtMs(state: GameState): number | null {
  let soonest: number | null = null;
  for (const plot of state.plots) {
    if (plot.cropId === null || plot.readyAt === null) continue;
    if (soonest === null || plot.readyAt < soonest) {
      soonest = plot.readyAt;
    }
  }
  return soonest;
}

export function formatHarvestEta(readyAt: number, now: number): string {
  const remainingMs = Math.max(0, readyAt - now);
  const totalMinutes = Math.max(1, Math.ceil(remainingMs / 60_000));
  if (totalMinutes < 60) {
    return `${totalMinutes}m`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (minutes === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${minutes}m`;
}

function widgetHeadline(input: {
  pendingItems: number;
  pendingCoins: number;
  nextCropReadyAt: number | null;
  now: number;
}): string {
  if (input.pendingItems > 0) {
    return `${input.pendingCoins} coins waiting on the dock`;
  }
  if (input.nextCropReadyAt !== null && input.nextCropReadyAt <= input.now) {
    return 'A crop is ready to pick';
  }
  if (input.nextCropReadyAt !== null && input.nextCropReadyAt > input.now) {
    return `Next harvest in ${formatHarvestEta(input.nextCropReadyAt, input.now)}`;
  }
  return 'Cast a line when you are back';
}
