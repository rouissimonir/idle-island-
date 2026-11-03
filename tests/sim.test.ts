import { describe, expect, it } from 'vitest';
import { formatSimReport, runSimulation } from '../src/sim/index.ts';

describe('milestone 3 — economy simulation', () => {
  it('runs a short simulation and a full 14-day simulation with sane progression', () => {
    const shortSim = runSimulation({ days: 2, seed: 42 });
    expect(shortSim.days).toHaveLength(2);

    const fullSim = runSimulation({ days: 14, seed: 42 });
    expect(fullSim.days).toHaveLength(14);

    // Auto-fisher (cost 240) is not affordable on the very first cast
    expect(fullSim.firstCastCoins).toBeLessThan(240);

    // Helper (cost 4200) is not owned at the end of Day 1
    const day1 = fullSim.days[0];
    expect(day1).toBeDefined();
    expect(day1?.upgrades.helper).toBe(0);
    // Early upgrades (rod 1, soil 1, market 1) are earned on Day 1
    expect(day1?.upgrades.rod).toBeGreaterThanOrEqual(1);

    // By day 14, automation unlocks are owned
    const day14 = fullSim.days[13];
    expect(day14?.upgrades.auto_fisher).toBe(1);
    expect(day14?.upgrades.sprinkler).toBe(1);
    expect(day14?.upgrades.helper).toBe(1);

    const report = formatSimReport(fullSim);
    expect(report).toContain('Island Idle 14-Day Economy Simulation');
    expect(report).toContain('auto_fisher -> Lv.1');
  });
});
