import assert from 'node:assert/strict';
import test from 'node:test';
import {
  advanceTime,
  buyUpgrade,
  collectPending,
  createInitialState,
  growMs,
  harvestPlot,
  manualCastMs,
  nextUnit,
  plantPlot,
  sellAll,
  tryFish,
  unitPrice,
} from '../src/core/index.ts';
import { runSimulation } from '../src/sim/index.ts';

void test('RNG and formula checks', () => {
  const step0 = nextUnit(1);
  assert.equal(step0.value, 0.6270739405881613);
  assert.equal(step0.seed, 1831565814);
  assert.equal(manualCastMs(0), 5000);
  assert.equal(manualCastMs(1), 4300);
  assert.equal(growMs('turnip', 0, false), 90000);
  assert.equal(growMs('turnip', 1, false), 81000);
  assert.equal(unitPrice(8, 0), 8);
  assert.equal(unitPrice(8, 1), 9);
});

void test('fishing, farming, selling, and away progression', () => {
  const state = createInitialState(0, 1);
  const f = tryFish(state, 0);
  assert.equal(f.ok, true);
  const p = plantPlot(state, 0, 'turnip', 0);
  assert.equal(p.ok, true);
  const h = harvestPlot(state, 0, 90000);
  assert.equal(h.ok, true);
  const coins = sellAll(state);
  assert.equal(coins > 0, true);

  state.coins = 30;
  assert.equal(buyUpgrade(state, 'rod').ok, true);

  advanceTime(state, 90000 + 3600_000, 'away');
  assert.equal(state.pending !== null, true);
  const collected = collectPending(state, 'sell');
  assert.equal(collected.coinsGained > 0, true);
});

void test('economy simulation runs cleanly', () => {
  const res = runSimulation({ days: 3, seed: 42 });
  assert.equal(res.days.length, 3);
  assert.equal(res.firstCastCoins < 240, true);
  assert.equal(res.days[0]?.upgrades.helper, 0);
});
