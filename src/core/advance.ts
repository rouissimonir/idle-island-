import { content } from './content.ts';
import { pilesValue } from './economy.ts';
import { addCropToPile, currentCropGrowMs } from './farming.ts';
import { addFishToPile, clampRodLevel, rollFish } from './fishing.ts';
import { autoCastMs } from './formulas.ts';
import { cappedElapsedMs } from './offline.ts';
import type { GameState } from './types.ts';

export type AdvanceMode = 'active' | 'away';

export interface AdvanceReport {
  elapsed: number;
  processed: number;
  capped: boolean;
  fish: Record<string, number>;
  crops: Record<string, number>;
  coins: number;
  value: number;
}

export function advanceTime(state: GameState, now: number, mode: AdvanceMode): AdvanceReport {
  if (now < state.lastTickAt) {
    return {
      elapsed: 0,
      processed: 0,
      capped: false,
      fish: {},
      crops: {},
      coins: 0,
      value: 0,
    };
  }

  const elapsed = now - state.lastTickAt;
  const processed =
    mode === 'away' ? cappedElapsedMs(elapsed, content.balance.offlineCapMs) : elapsed;
  const windowEnd = state.lastTickAt + processed;
  const capped = mode === 'away' && elapsed > content.balance.offlineCapMs;

  const producedFish: Record<string, number> = {};
  const producedCrops: Record<string, number> = {};

  // 1. Fishing during the window
  const autoFisherOwned = (state.upgrades.auto_fisher ?? 0) > 0;
  const rodLevel = clampRodLevel(state.upgrades.rod ?? 0);

  if (!autoFisherOwned && mode === 'active') {
    state.fishing.autoNextAt = windowEnd + content.balance.tideCastMs;
  } else if (processed > 0) {
    const interval = autoFisherOwned ? autoCastMs(rodLevel) : content.balance.tideCastMs;
    if (state.fishing.autoNextAt <= windowEnd) {
      const rawCount = Math.floor((windowEnd - state.fishing.autoNextAt) / interval) + 1;
      const castCount = Math.min(rawCount, content.balance.maxCastsPerAdvance);
      for (let i = 0; i < castCount; i += 1) {
        const caught = rollFish(state, rodLevel);
        addFishToPile(producedFish, caught.id, 1);
      }
      state.fishing.autoNextAt += castCount * interval;
    }
  }

  // 2. Farming during the window
  const helperOwned = (state.upgrades.helper ?? 0) > 0;
  for (const plot of state.plots) {
    if (plot.cropId === null || plot.readyAt === null || plot.plantedAt === null) {
      continue;
    }
    const crop = content.crops.find((entry) => entry.id === plot.cropId);
    if (!crop) continue;

    if (helperOwned) {
      if (plot.readyAt <= windowEnd) {
        const growDuration = currentCropGrowMs(state, crop);
        const extra = Math.floor((windowEnd - plot.readyAt) / growDuration);
        const totalHarvests = 1 + extra;
        addCropToPile(producedCrops, crop.id, totalHarvests);
        const lastReplantAt = plot.readyAt + extra * growDuration;
        plot.plantedAt = lastReplantAt;
        plot.readyAt = lastReplantAt + growDuration;
      }
    } else if (mode === 'away') {
      if (plot.readyAt <= windowEnd) {
        addCropToPile(producedCrops, crop.id, 1);
        plot.cropId = null;
        plot.plantedAt = null;
        plot.readyAt = null;
      }
    }
  }

  // 3. Discarded tail adjustment when now > windowEnd
  if (now > windowEnd) {
    const tail = now - windowEnd;
    for (const plot of state.plots) {
      if (plot.cropId !== null && plot.plantedAt !== null && plot.readyAt !== null) {
        plot.plantedAt += tail;
        plot.readyAt += tail;
      }
    }
    if (state.fishing.autoNextAt < now) {
      state.fishing.autoNextAt = now;
    }
  }

  state.lastTickAt = now;

  // 4. Route goods to pending or inventory/collection
  const toPending = mode === 'away' && processed >= content.balance.summaryMinMs;
  const hasProduced = Object.keys(producedFish).length > 0 || Object.keys(producedCrops).length > 0;

  if (toPending) {
    if (hasProduced || state.pending !== null) {
      if (!state.pending) {
        state.pending = { fish: {}, crops: {}, elapsedMs: 0, capped: false };
      }
      state.pending.elapsedMs += processed;
      state.pending.capped = state.pending.capped || capped;
      for (const [id, count] of Object.entries(producedFish)) {
        addFishToPile(state.pending.fish, id, count);
      }
      for (const [id, count] of Object.entries(producedCrops)) {
        addCropToPile(state.pending.crops, id, count);
      }
    }
  } else {
    for (const [id, count] of Object.entries(producedFish)) {
      addFishToPile(state.inventory.fish, id, count);
      addFishToPile(state.collection.fish, id, count);
    }
    for (const [id, count] of Object.entries(producedCrops)) {
      addCropToPile(state.inventory.crops, id, count);
      addCropToPile(state.collection.crops, id, count);
    }
  }

  const reportFish = { ...producedFish };
  const reportCrops = { ...producedCrops };
  const coins = pilesValue({ fish: reportFish, crops: reportCrops }, state.upgrades.market ?? 0);

  return {
    elapsed,
    processed,
    capped,
    fish: reportFish,
    crops: reportCrops,
    coins,
    value: coins,
  };
}

export function shiftTimestamps(state: GameState, deltaMs: number): void {
  state.lastTickAt += deltaMs;
  state.fishing.manualNextAt += deltaMs;
  state.fishing.autoNextAt += deltaMs;
  for (const plot of state.plots) {
    if (plot.plantedAt !== null) {
      plot.plantedAt += deltaMs;
    }
    if (plot.readyAt !== null) {
      plot.readyAt += deltaMs;
    }
  }
}

export function jumpAway(state: GameState, ms: number, now: number): AdvanceReport {
  shiftTimestamps(state, -ms);
  return advanceTime(state, now, 'away');
}
