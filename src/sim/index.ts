import {
  advanceTime,
  basketValue,
  buyUpgrade,
  collectPending,
  content,
  createInitialState,
  currentCropGrowMs,
  harvestPlot,
  plantPlot,
  sellAll,
  tryFish,
  unitPrice,
  type GameState,
} from '../core/index.ts';

export interface UpgradeMilestone {
  id: string;
  level: number;
  day: number;
  sessionLabel: string;
  elapsedMinutes: number;
  timestampMs: number;
}

export interface DaySummary {
  day: number;
  coins: number;
  upgrades: Record<string, number>;
}

export interface SimOptions {
  days?: number;
  seed?: number;
}

export interface SimResult {
  state: GameState;
  days: DaySummary[];
  milestones: UpgradeMilestone[];
  firstCastCoins: number;
}

interface BuyTarget {
  id: string;
  targetLevel: number;
}

/**
 * Suggested buy order from docs/RULES.md:
 * rod 1, soil 1, market 1, auto-fisher, rod 2, sprinkler, soil 2, market 2, helper,
 * then the remaining levels of rod, soil, and market in that rotation.
 */
export const SUGGESTED_BUY_ORDER: readonly BuyTarget[] = [
  { id: 'rod', targetLevel: 1 },
  { id: 'soil', targetLevel: 1 },
  { id: 'market', targetLevel: 1 },
  { id: 'auto_fisher', targetLevel: 1 },
  { id: 'rod', targetLevel: 2 },
  { id: 'sprinkler', targetLevel: 1 },
  { id: 'soil', targetLevel: 2 },
  { id: 'market', targetLevel: 2 },
  { id: 'helper', targetLevel: 1 },
  { id: 'rod', targetLevel: 3 },
  { id: 'soil', targetLevel: 3 },
  { id: 'market', targetLevel: 3 },
  { id: 'rod', targetLevel: 4 },
  { id: 'soil', targetLevel: 4 },
  { id: 'market', targetLevel: 4 },
  { id: 'rod', targetLevel: 5 },
  { id: 'soil', targetLevel: 5 },
  { id: 'market', targetLevel: 5 },
];

export function selectCropForSession(state: GameState, remainingSessionMs: number): string {
  const marketLevel = state.upgrades.market ?? 0;

  let bestFinishingId: string | null = null;
  let bestFinishingRate = -1;
  let bestOverallId = content.crops[0]?.id ?? 'turnip';
  let bestOverallRate = -1;

  for (const crop of content.crops) {
    const durationMs = currentCropGrowMs(state, crop);
    const price = unitPrice(crop.sellValue, marketLevel);
    const ratePerMs = price / durationMs;

    if (ratePerMs > bestOverallRate) {
      bestOverallRate = ratePerMs;
      bestOverallId = crop.id;
    }

    if (durationMs <= remainingSessionMs && ratePerMs > bestFinishingRate) {
      bestFinishingRate = ratePerMs;
      bestFinishingId = crop.id;
    }
  }

  return bestFinishingId ?? bestOverallId;
}

function tryBuyAlongOrder(
  state: GameState,
  day: number,
  sessionLabel: string,
  elapsedMinutes: number,
  timestampMs: number,
  milestones: UpgradeMilestone[],
): void {
  for (const step of SUGGESTED_BUY_ORDER) {
    const current = state.upgrades[step.id] ?? 0;
    if (current >= step.targetLevel) {
      continue;
    }
    const res = buyUpgrade(state, step.id);
    if (!res.ok) {
      // Stop at the first step the player cannot afford; do not skip ahead.
      break;
    }
    milestones.push({
      id: step.id,
      level: res.value.level,
      day,
      sessionLabel,
      elapsedMinutes: Math.round(elapsedMinutes * 10) / 10,
      timestampMs,
    });
  }
}

export function runSimulation(options: SimOptions = {}): SimResult {
  const totalDays = options.days ?? 14;
  const seed = options.seed ?? 42;
  const state = createInitialState(0, seed);

  const days: DaySummary[] = [];
  const milestones: UpgradeMilestone[] = [];
  let now = 0;
  let firstCastRecorded = false;
  let firstCastCoins = 0;

  const activeSessionMs = 4 * 60 * 1000; // 4 minutes
  const morningAwayMs = 2 * 60 * 60 * 1000; // 2 hours
  const afternoonAwayMs = 18 * 60 * 60 * 1000; // 18 hours
  const stepMs = 1000;

  const runSession = (day: number, label: string, startClockMinutes: number): void => {
    const sessionStart = now;
    const sessionEnd = sessionStart + activeSessionMs;

    for (let t = sessionStart; t <= sessionEnd; t += stepMs) {
      now = t;
      advanceTime(state, now, 'active');

      // 1. Fish on cooldown
      const fished = tryFish(state, now);
      if (fished.ok && !firstCastRecorded) {
        firstCastRecorded = true;
        firstCastCoins = basketValue(state);
      }

      // 2. Harvest ripe plots and plant empty plots
      const remainingMs = sessionEnd - now;
      for (let i = 0; i < state.plots.length; i += 1) {
        const plot = state.plots[i];
        if (!plot) continue;
        if (plot.cropId !== null && plot.readyAt !== null && now >= plot.readyAt) {
          harvestPlot(state, i, now);
        }
        if (plot.cropId === null) {
          const cropId = selectCropForSession(state, remainingMs);
          plantPlot(state, i, cropId, now);
        }
      }

      // 3. Sell when basket has value
      if (basketValue(state) > 0) {
        sellAll(state);
      }

      // 4. Buy upgrades in suggested order
      const sessionMinutes = startClockMinutes + (now - sessionStart) / 60_000;
      tryBuyAlongOrder(state, day, label, sessionMinutes, now, milestones);
    }
  };

  for (let day = 1; day <= totalDays; day += 1) {
    // Morning session at 08:00 (480m from midnight)
    runSession(day, '08:00', 8 * 60);

    // 2 hours away after morning session
    now += morningAwayMs;
    advanceTime(state, now, 'away');
    collectPending(state, 'sell');
    if (basketValue(state) > 0) {
      sellAll(state);
    }
    tryBuyAlongOrder(state, day, '10:04-away', 10 * 60 + 4, now, milestones);

    // Afternoon session at 13:00 (780m from midnight)
    runSession(day, '13:00', 13 * 60);

    // 18 hours away after afternoon session
    now += afternoonAwayMs;
    advanceTime(state, now, 'away');
    collectPending(state, 'sell');
    if (basketValue(state) > 0) {
      sellAll(state);
    }
    tryBuyAlongOrder(state, day, 'overnight', 24 * 60, now, milestones);

    days.push({
      day,
      coins: state.coins,
      upgrades: {
        rod: state.upgrades.rod ?? 0,
        soil: state.upgrades.soil ?? 0,
        market: state.upgrades.market ?? 0,
        auto_fisher: state.upgrades.auto_fisher ?? 0,
        sprinkler: state.upgrades.sprinkler ?? 0,
        helper: state.upgrades.helper ?? 0,
      },
    });
  }

  return {
    state,
    days,
    milestones,
    firstCastCoins,
  };
}

export function formatSimReport(result: SimResult): string {
  const lines: string[] = [];
  lines.push('=== Island Idle 14-Day Economy Simulation ===');
  lines.push('');
  lines.push('Day | Coins  | Rod | Soil | Market | AutoFish | Sprinkler | Helper');
  lines.push('----+--------+-----+------+--------+----------+-----------+-------');
  for (const row of result.days) {
    const u = row.upgrades;
    lines.push(
      `${String(row.day).padStart(3)} | ${String(row.coins).padStart(6)} | ${String(u.rod ?? 0).padStart(3)} | ${String(u.soil ?? 0).padStart(4)} | ${String(u.market ?? 0).padStart(6)} | ${String(u.auto_fisher ?? 0).padStart(8)} | ${String(u.sprinkler ?? 0).padStart(9)} | ${String(u.helper ?? 0).padStart(6)}`,
    );
  }
  lines.push('');
  lines.push('=== First Timestamp of Each Upgrade Level ===');
  for (const m of result.milestones) {
    const totalMin = Math.round(m.timestampMs / 60_000);
    lines.push(
      `Day ${String(m.day).padStart(2)} (${m.sessionLabel.padEnd(10)}) [t=${String(totalMin).padStart(5)}m]: ${m.id} -> Lv.${m.level}`,
    );
  }
  return lines.join('\n');
}
