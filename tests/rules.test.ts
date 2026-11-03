import { describe, expect, it } from 'vitest';
import {
  advanceTime,
  autoCastMs,
  basketValue,
  buyUpgrade,
  collectPending,
  content,
  createInitialState,
  deserialize,
  getUpgradeViews,
  growMs,
  harvestPlot,
  jumpAway,
  manualCastMs,
  nextUnit,
  pendingValue,
  plantPlot,
  rollFish,
  SAVE_VERSION,
  sellAll,
  serialize,
  tryFish,
  unitPrice,
} from '../src/core/index.ts';

describe('milestone 1 — core rules', () => {
  it('locks the mulberry32 RNG sample from seed 1', () => {
    const s0 = nextUnit(1);
    expect(s0.value).toBe(0.6270739405881613);
    expect(s0.seed).toBe(1831565814);

    const s1 = nextUnit(s0.seed);
    expect(s1.value).toBe(0.002735721180215478);
    expect(s1.seed).toBe(3663131627);

    const s2 = nextUnit(s1.seed);
    expect(s2.value).toBe(0.5274470399599522);
    expect(s2.seed).toBe(1199730144);
  });

  it('matches worked formula examples in docs/RULES.md', () => {
    expect(manualCastMs(0)).toBe(5000);
    expect(manualCastMs(1)).toBe(4300);
    expect(autoCastMs(0)).toBe(60000);
    expect(growMs('turnip', 0, false)).toBe(90000);
    expect(growMs('turnip', 1, false)).toBe(81000);
    expect(unitPrice(8, 0)).toBe(8);
    expect(unitPrice(8, 1)).toBe(9);
  });

  it('enforces manual fishing cooldown and shortens interval at higher rod levels', () => {
    const state = createInitialState(1000, 42);
    const first = tryFish(state, 1000);
    expect(first.ok).toBe(true);
    expect(state.fishing.manualNextAt).toBe(1000 + 5000);

    const early = tryFish(state, 5999);
    expect(early).toEqual({ ok: false, reason: 'cooldown' });

    state.upgrades.rod = 1;
    const second = tryFish(state, 6000);
    expect(second.ok).toBe(true);
    expect(state.fishing.manualNextAt).toBe(6000 + 4300);
  });

  it('produces the exact same fish sequence from the same seed', () => {
    const a = createInitialState(0, 777);
    const b = createInitialState(0, 777);
    const seqA = Array.from({ length: 25 }, () => rollFish(a).id);
    const seqB = Array.from({ length: 25 }, () => rollFish(b).id);
    expect(seqA).toEqual(seqB);
  });

  it('never rolls koi at rod 0 across 500 rolls, and rolls koi at rod 5', () => {
    const state = createInitialState(0, 12345);
    const rod0Ids = new Set<string>();
    for (let i = 0; i < 500; i += 1) {
      rod0Ids.add(rollFish(state, 0).id);
    }
    expect(rod0Ids.has('koi')).toBe(false);
    expect(rod0Ids.has('bream')).toBe(false);

    const rod5Ids = new Set<string>();
    for (let i = 0; i < 200; i += 1) {
      rod5Ids.add(rollFish(state, 5).id);
    }
    expect(rod5Ids.has('koi')).toBe(true);
  });

  it('plants, rejects occupied plots, rejects early harvest, and harvests on time', () => {
    const state = createInitialState(1000, 10);
    expect(plantPlot(state, -1, 'turnip', 1000).ok).toBe(false);
    expect(plantPlot(state, 0, 'unknown', 1000)).toEqual({
      ok: false,
      reason: 'unknown_crop',
    });

    const planted = plantPlot(state, 0, 'turnip', 1000);
    expect(planted).toEqual({
      ok: true,
      value: { cropId: 'turnip', plantedAt: 1000, readyAt: 91000 },
    });

    expect(plantPlot(state, 0, 'carrot', 2000)).toEqual({
      ok: false,
      reason: 'occupied',
    });

    expect(harvestPlot(state, 0, 90999)).toEqual({
      ok: false,
      reason: 'not_ready',
    });

    const harvested = harvestPlot(state, 0, 91000);
    expect(harvested.ok).toBe(true);
    expect(state.inventory.crops.turnip).toBe(1);
    expect(state.collection.crops.turnip).toBe(1);
    expect(state.plots[0]?.cropId).toBeNull();
  });

  it('does not change readyAt of an already planted plot when sprinkler or soil is bought', () => {
    const state = createInitialState(0, 1);
    state.coins = 5000;
    plantPlot(state, 0, 'turnip', 0);
    expect(state.plots[0]?.readyAt).toBe(90000);

    expect(buyUpgrade(state, 'sprinkler').ok).toBe(true);
    expect(buyUpgrade(state, 'soil').ok).toBe(true);
    expect(state.plots[0]?.readyAt).toBe(90000);

    // A plot planted after buying uses the new upgrades
    plantPlot(state, 1, 'turnip', 0);
    expect(state.plots[1]?.readyAt).toBe(growMs('turnip', 1, true));
  });

  it('buys upgrades when affordable, rejects when poor or maxed, and schedules auto_fisher at lastTickAt + autoCastMs', () => {
    const state = createInitialState(1000, 1);
    expect(buyUpgrade(state, 'rod')).toEqual({
      ok: false,
      reason: 'insufficient_coins',
    });

    state.coins = 30;
    const bought = buyUpgrade(state, 'rod');
    expect(bought).toEqual({
      ok: true,
      value: { id: 'rod', level: 1, cost: 30 },
    });
    expect(state.coins).toBe(0);

    state.coins = 10000;
    expect(state.fishing.autoNextAt).toBe(1000);
    expect(buyUpgrade(state, 'auto_fisher').ok).toBe(true);
    expect(state.fishing.autoNextAt).toBe(1000 + autoCastMs(1));
    expect(buyUpgrade(state, 'auto_fisher')).toEqual({
      ok: false,
      reason: 'max_level',
    });

    const views = getUpgradeViews(state);
    const autoView = views.find((v) => v.id === 'auto_fisher');
    expect(autoView?.isMaxed).toBe(true);
    expect(autoView?.nextCost).toBeNull();
  });

  it('produces tide fish while away without auto-fisher and marks pending.capped only when elapsed > offlineCapMs', () => {
    const state4h = createInitialState(0, 99);
    const state20h = createInitialState(0, 99);

    const rep4h = advanceTime(state4h, 4 * 3600 * 1000, 'away');
    const rep20h = advanceTime(state20h, 20 * 3600 * 1000, 'away');

    expect(rep4h.capped).toBe(false);
    expect(state4h.pending?.capped).toBe(false);
    expect(rep20h.capped).toBe(true);
    expect(state20h.pending?.capped).toBe(true);
    expect(rep4h.processed).toBe(content.balance.offlineCapMs);
    expect(rep20h.processed).toBe(content.balance.offlineCapMs);
    expect(rep4h.fish).toEqual(rep20h.fish);
    expect(pendingValue(state4h)).toBeGreaterThan(0);
    expect(pendingValue(state4h)).toBe(pendingValue(state20h));
  });

  it('advances autoNextAt by fired castCount when clamped to maxCastsPerAdvance', () => {
    const state = createInitialState(0, 7);
    state.upgrades.auto_fisher = 1;
    state.upgrades.rod = 5;
    const interval = autoCastMs(5);
    const hugeWindow = (content.balance.maxCastsPerAdvance + 500) * interval;
    advanceTime(state, hugeWindow, 'active');
    expect(state.fishing.autoNextAt).toBe(content.balance.maxCastsPerAdvance * interval);
  });

  it('does not backfill the tide during active play', () => {
    const state = createInitialState(0, 1);
    const activeReport = advanceTime(state, 30 * 60 * 1000, 'active');
    expect(activeReport.coins).toBe(0);
    expect(state.inventory.fish).toEqual({});
    expect(state.fishing.autoNextAt).toBe(30 * 60 * 1000 + content.balance.tideCastMs);

    const shortAway = advanceTime(state, 32 * 60 * 1000, 'away');
    expect(shortAway.fish).toEqual({});
  });

  it('harvests once and clears plot when away without helper, and replants with helper', () => {
    const withoutHelper = createInitialState(0, 1);
    plantPlot(withoutHelper, 0, 'turnip', 0);
    advanceTime(withoutHelper, 10 * 60 * 1000, 'away');
    expect(withoutHelper.pending?.crops.turnip).toBe(1);
    expect(withoutHelper.plots[0]?.cropId).toBeNull();

    const withHelper = createInitialState(0, 1);
    withHelper.upgrades.helper = 1;
    plantPlot(withHelper, 0, 'turnip', 0);
    advanceTime(withHelper, 450_000, 'away');
    expect(withHelper.pending?.crops.turnip).toBe(5);
    expect(withHelper.plots[0]?.cropId).toBe('turnip');
    expect(withHelper.plots[0]?.plantedAt).toBe(450_000);
    expect(withHelper.plots[0]?.readyAt).toBe(540_000);
  });

  it('collectPending("sell") does not sell a pre-existing basket', () => {
    const state = createInitialState(0, 5);
    tryFish(state, 0);
    const existingBasketValue = basketValue(state);
    expect(existingBasketValue).toBeGreaterThan(0);

    jumpAway(state, 3600_000, 3600_000);
    const pendingCoins = pendingValue(state);
    expect(pendingCoins).toBeGreaterThan(0);

    const collected = collectPending(state, 'sell');
    expect(collected.coinsGained).toBe(pendingCoins);
    expect(state.coins).toBe(pendingCoins);
    expect(state.pending).toBeNull();
    expect(basketValue(state)).toBe(existingBasketValue);

    const soldBasket = sellAll(state);
    expect(soldBasket).toBe(existingBasketValue);
    expect(state.coins).toBe(pendingCoins + existingBasketValue);
  });

  it('round-trips a mutated save, migrates v1 saves, and rejects unknown item or upgrade ids', () => {
    const state = createInitialState(1000, 15);
    tryFish(state, 1000);
    plantPlot(state, 0, 'carrot', 1000);
    jumpAway(state, 120_000, 121_000);

    const raw = serialize(state);
    const restored = deserialize(raw);
    expect(restored).toEqual(state);

    // Migrate version 1 save where pending lacks capped
    const v1Raw = JSON.stringify({
      ...state,
      version: 1,
      pending: { fish: { minnow: 2 }, crops: {}, elapsedMs: 120_000 },
    });
    const migrated = deserialize(v1Raw);
    expect(migrated).not.toBeNull();
    expect(migrated?.version).toBe(SAVE_VERSION);
    expect(migrated?.pending?.capped).toBe(false);

    const badUpgrade = structuredClone(state);
    badUpgrade.upgrades.jetpack = 1;
    expect(deserialize(JSON.stringify(badUpgrade))).toBeNull();

    const badFish = structuredClone(state);
    badFish.inventory.fish.shark = 2;
    expect(deserialize(JSON.stringify(badFish))).toBeNull();
  });
});
