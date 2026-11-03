# Rules

Authoritative spec for the simulation. `src/data/balance.json`, `fish.json`, `crops.json`, and `upgrades.json` are the machine copy of the tables below. If a formula and the JSON disagree, fix the JSON to match this document, then update the worked examples.

Milestone 0 stores the tables and clamps offline time. It does **not** fish, farm, sell, buy, or resolve away rewards. Milestone 1 implements this file in `src/core`.

Schema bounds (positive costs, weight width, factor ranges) are enforced by `src/data/validate.ts`. Stay inside them.

## Time

All timestamps are milliseconds. Callers pass `now`. Core code does not read the clock.

| Name                  | Value      | Meaning                                                     |
| --------------------- | ---------- | ----------------------------------------------------------- |
| `offlineCapMs`        | `14400000` | 4 hours. Max gap that produces goods.                       |
| `awayThresholdMs`     | `20000`    | A gap at least this long is an away resolution.             |
| `summaryMinMs`        | `60000`    | Away summaries open only if the processed gap is this long. |
| `manualCastBaseMs`    | `5000`     | Manual cast interval at rod level 0.                        |
| `autoCastBaseMs`      | `60000`    | Auto-fisher interval at rod level 0.                        |
| `tideCastMs`          | `180000`   | Away-only casts when the auto-fisher is not owned.          |
| `castLevelFactor`     | `0.86`     | Per rod level.                                              |
| `minManualCastMs`     | `900`      | Safety floor.                                               |
| `minAutoCastMs`       | `8000`     | Safety floor.                                               |
| `soilGrowFactor`      | `0.9`      | Per soil level.                                             |
| `sprinklerGrowFactor` | `0.62`     | Applied when the sprinkler is owned.                        |
| `marketPriceFactor`   | `1.12`     | Per market level.                                           |
| `plotCount`           | `4`        | Empty plots on a new island.                                |
| `maxCastsPerAdvance`  | `20000`    | Safety cap on one `advanceTime` call.                       |

`cappedElapsedMs` is implemented. Everything else in this file is spec.

## Formulas

`level` is `state.upgrades[id] ?? 0`.

```text
manualCastMs(level) = max(minManualCastMs, round(manualCastBaseMs * castLevelFactor^level))
autoCastMs(level)   = max(minAutoCastMs,   round(autoCastBaseMs   * castLevelFactor^level))
growMs(crop, soil, sprinklerOwned) =
  round(crop.growSeconds * 1000 * soilGrowFactor^soil * (sprinklerOwned ? sprinklerGrowFactor : 1))
unitPrice(base, marketLevel) = round(base * marketPriceFactor^marketLevel)
```

Worked checks for milestone 1 tests:

- `manualCastMs(0) = 5000`
- `manualCastMs(1) = 4300`
- Turnip, soil 0, no sprinkler: `90000` ms
- Turnip, soil 1, no sprinkler: `81000` ms
- Turnip price at market 0: `8`. At market 1: `9`

Rod level also selects the fish weight column. Column index equals rod level. Do not read past the row; the schema makes every row `maxLevel + 1` long.

## RNG

Mulberry32. Implement this exactly and lock the sample in a test. `state.rngState` starts at a non-zero uint32. Each roll replaces it with `seed`.

```ts
export function nextUnit(seed: number): { value: number; seed: number } {
  let a = seed >>> 0;
  a = (a + 0x6d2b79f5) >>> 0;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, seed: a };
}
```

From seed `1`, the first three values are:

| Step | value                  | next seed    |
| ---- | ---------------------- | ------------ |
| 0    | `0.6270739405881613`   | `1831565814` |
| 1    | `0.002735721180215478` | `3663131627` |
| 2    | `0.5274470399599522`   | `1199730144` |

Weighted pick: `x = value * totalWeight`, walk the fish list in file order, subtract each weight, return the first fish that drives `x` below 0. If the roll lands on the last sliver, return the last fish with a non-zero weight in that column, else the last fish.

## Fish

Weights are rod levels 0 through 5. Sell values are the base before the market multiplier.

| Id       | Name       | Sell | Rarity    | Weights                |
| -------- | ---------- | ---- | --------- | ---------------------- |
| minnow   | Minnow     | 4    | common    | 62, 42, 26, 14, 6, 2   |
| sardine  | Sardine    | 9    | common    | 28, 34, 30, 24, 16, 10 |
| mackerel | Mackerel   | 22   | uncommon  | 10, 16, 24, 28, 28, 22 |
| bream    | Sea Bream  | 48   | rare      | 0, 8, 15, 22, 28, 32   |
| koi      | Island Koi | 120  | legendary | 0, 0, 5, 12, 22, 34    |

## Crops

| Id      | Name    | Grow seconds | Base sell |
| ------- | ------- | ------------ | --------- |
| turnip  | Turnip  | 90           | 8         |
| carrot  | Carrot  | 240          | 26        |
| pumpkin | Pumpkin | 600          | 78        |

Rough coins per minute per plot at soil 0, no sprinkler, ignoring rounding: turnip 5.3, carrot 6.5, pumpkin 7.8. The sim should prefer a crop that finishes before the active session ends, otherwise the best coins per minute.

## Upgrades

Cost is `costs[currentLevel]`. Buying increments the level by 1 and spends that cost. You cannot buy past `maxLevel` or with too few coins.

| Id          | Effect      | Automation | Costs                       |
| ----------- | ----------- | ---------- | --------------------------- |
| rod         | rod         | no         | 30, 480, 2800, 12000, 42000 |
| soil        | soil        | no         | 40, 540, 3100, 13500, 46000 |
| market      | market      | no         | 55, 620, 3400, 15000, 50000 |
| auto_fisher | auto_fisher | yes        | 240                         |
| sprinkler   | sprinkler   | yes        | 2600                        |
| helper      | helper      | yes        | 9500                        |

Suggested buy order for the sim, stopping at the first step the player cannot afford: rod 1, soil 1, market 1, auto-fisher, rod 2, sprinkler, soil 2, market 2, helper, then the remaining levels of rod, soil, and market in that rotation. Do not skip ahead to a later step.

## Actions

All of these mutate `state` and are still to be built.

- `tryFish(state, now)` fails with `cooldown` when `now < fishing.manualNextAt`. Otherwise roll one fish into `inventory` and `collection`, and set `manualNextAt = now + manualCastMs(rodLevel)`.
- `plantPlot(state, index, cropId, now)` fails if the index is bad, the plot is occupied, or the crop id is unknown. On success set `cropId`, `plantedAt = now`, and `readyAt = now + growMs(...)` using upgrades **at plant time**.
- `harvestPlot(state, index, now)` fails if the plot is empty or `now < readyAt`. On success add one crop to inventory and collection and clear the plot.
- `sellAll(state)` adds `unitPrice * count` for every basket stack, then clears the basket. Collection is unchanged. Returns the coins gained (0 if the basket was empty).
- `buyUpgrade(state, id)` applies the cost rule above.
- `collectPending(state, 'sell' | 'stash')` clears `pending`. `sell` adds coins and collection counts only. `stash` merges into the basket and the collection. Selling pending goods must not sell a basket that was already there.

## advanceTime

```text
advanceTime(state, now, mode: 'active' | 'away') -> report
```

If `now < lastTickAt`, return an empty report and do not move the clock.

`elapsed = now - lastTickAt`. In `away` mode, `processed = min(elapsed, offlineCapMs)` and `windowEnd = lastTickAt + processed`. In `active` mode, `processed = elapsed` and `windowEnd = now`. The report records `elapsed`, `processed`, and `capped = away && elapsed > offlineCapMs`.

Fishing during the window:

- If the auto-fisher is owned, emit casts every `autoCastMs(rodLevel)` starting at `fishing.autoNextAt`.
- If it is not owned and mode is `away`, emit tide casts every `tideCastMs`.
- If it is not owned and mode is `active`, do not emit casts. Set `autoNextAt` to `windowEnd + tideCastMs` so away time does not backfill the tide for the period the player was watching.
- Cast count is `floor((windowEnd - autoNextAt) / interval) + 1` when `autoNextAt <= windowEnd`, then clamped to `maxCastsPerAdvance`. Each cast rolls one fish. Afterwards `autoNextAt` points at the next unfired cast.

Farming during the window:

- No helper, `active`: do nothing. Ripe crops wait for a tap.
- No helper, `away`: if `readyAt <= windowEnd`, harvest once into the away pile and clear the plot.
- Helper (either mode): harvest once at `readyAt`, then `extra = floor((windowEnd - readyAt) / growMs)` more harvests of the **same** crop. `growMs` for the extra cycles uses current upgrades. Set `plantedAt` to the last replant time and `readyAt` to `plantedAt + growMs` for the current grow time.

If `now > windowEnd` (the cap discarded a tail), add `now - windowEnd` to every remaining plot's `plantedAt` and `readyAt`. If `autoNextAt < now`, set it to `now`.

Then set `lastTickAt = now`.

Where goods go:

- `active`: inventory and collection.
- `away` and `processed >= summaryMinMs`: merge into `pending` (create it if null) and add `processed` to `pending.elapsedMs`.
- `away` and `processed < summaryMinMs`: inventory and collection, same as active. No summary.

The report lists the fish and crops produced by **this** call and the coins they would sell for at current prices. Do not share the report's objects with `state`.

`jumpAway` for the dev clock and for reload tests is `shiftTimestamps(state, -ms)` then `advanceTime(state, now, 'away')`. `shiftTimestamps` moves `lastTickAt`, both fishing timestamps, and every non-null `plantedAt` / `readyAt`. It does not change `pending.elapsedMs`.

## Save validation

`deserialize` validates all upgrade, fish, and crop IDs against `src/data/*.json` and rejects saves containing unknown item/upgrade IDs or upgrade levels exceeding `maxLevel` (returning `null`).

## What is implemented now

- Content JSON, schema, `GameState`, `createInitialState`, `serialize` / `deserialize`, `cappedElapsedMs`, save adapter.
- Core rules: `nextUnit` (RNG), formulas, fishing, farming, upgrades, economy, `advanceTime` / `shiftTimestamps`, UI overlay, 3D scene interactions, and 14-day economy simulation.
