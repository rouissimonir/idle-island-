import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/index.ts';
import {
  formatHarvestEta,
  nextCropReadyAtMs,
  toWidgetSnapshot,
} from '../src/platform/widgetSnapshot.ts';

describe('toWidgetSnapshot', () => {
  it('defaults to the cast-a-line headline on a fresh island', () => {
    const now = 1_000_000;
    const state = createInitialState(now, 7);
    const snap = toWidgetSnapshot(state, now);
    expect(snap).toEqual({
      version: 1,
      coins: 0,
      pendingValue: 0,
      pendingItems: 0,
      awayProcessedMs: 0,
      nextCropReadyAt: null,
      headline: 'Cast a line when you are back',
    });
  });

  it('uses pending coin value in the dock headline', () => {
    const now = 1_000_000;
    const state = createInitialState(now, 7);
    state.coins = 40;
    state.upgrades.market = 0;
    state.pending = {
      fish: { minnow: 2 },
      crops: {},
      elapsedMs: 3_600_000,
      capped: false,
    };
    // minnow sellValue is 4 → 2 * 4 = 8 at market 0
    const snap = toWidgetSnapshot(state, now);
    expect(snap.pendingItems).toBe(2);
    expect(snap.pendingValue).toBe(8);
    expect(snap.awayProcessedMs).toBe(3_600_000);
    expect(snap.headline).toBe('8 coins waiting on the dock');
  });

  it('prefers pending over a ripe crop for the headline', () => {
    const now = 1_000_000;
    const state = createInitialState(now, 7);
    state.pending = {
      fish: { minnow: 1 },
      crops: {},
      elapsedMs: 60_000,
      capped: false,
    };
    state.plots[0] = {
      cropId: 'turnip',
      plantedAt: now - 10_000,
      readyAt: now - 1_000,
    };
    const snap = toWidgetSnapshot(state, now);
    expect(snap.headline).toBe('4 coins waiting on the dock');
    expect(snap.nextCropReadyAt).toBe(now - 1_000);
  });

  it('reports a ready crop when nothing is pending', () => {
    const now = 1_000_000;
    const state = createInitialState(now, 7);
    state.plots[0] = {
      cropId: 'turnip',
      plantedAt: now - 10_000,
      readyAt: now - 500,
    };
    const snap = toWidgetSnapshot(state, now);
    expect(snap.headline).toBe('A crop is ready to pick');
    expect(snap.nextCropReadyAt).toBe(now - 500);
  });

  it('formats the next harvest ETA while a crop is growing', () => {
    const now = 1_000_000;
    const state = createInitialState(now, 7);
    state.plots[0] = {
      cropId: 'turnip',
      plantedAt: now,
      readyAt: now + 12 * 60_000,
    };
    state.plots[1] = {
      cropId: 'carrot',
      plantedAt: now,
      readyAt: now + 30 * 60_000,
    };
    expect(nextCropReadyAtMs(state)).toBe(now + 12 * 60_000);
    const snap = toWidgetSnapshot(state, now);
    expect(snap.headline).toBe('Next harvest in 12m');
  });

  it('formats longer ETAs with hours', () => {
    expect(formatHarvestEta(3_600_000, 0)).toBe('1h');
    expect(formatHarvestEta(3_600_000 + 5 * 60_000, 0)).toBe('1h 5m');
    expect(formatHarvestEta(30_000, 0)).toBe('1m');
  });
});
