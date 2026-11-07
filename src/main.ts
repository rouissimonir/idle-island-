import type { IslandDebug } from './debug.ts';
import {
  advanceTime,
  buyUpgrade,
  collectPending,
  content,
  createInitialState,
  deserialize,
  harvestPlot,
  jumpAway,
  plantPlot,
  sellAll,
  serialize,
  tryFish,
  unitPrice,
  type GameState,
} from './core/index.ts';
import { createSaveAdapter } from './platform/storage.ts';
import { writeWidgetSnapshot } from './platform/widgetBridge.ts';
import { mountScene } from './render/scene.ts';
import { mountOverlay } from './ui/overlay.ts';
import './style.css';

const JUMP_STORAGE_KEY = 'island-idle-jump-ms';

const canvas = document.querySelector('#scene');
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error('Missing #scene canvas');
}

const adapter = createSaveAdapter(window.localStorage);
const nowAtBoot = Date.now();
const saved = adapter.load();
let state: GameState = saved
  ? (deserialize(saved) ?? createInitialState(nowAtBoot, freshSeed()))
  : createInitialState(nowAtBoot, freshSeed());

// Resolve any real away gap or simulated reload jump (?jumpMs= or sessionStorage)
const reloadJumpMs = consumeReloadJumpMs();
if (reloadJumpMs > 0) {
  if (nowAtBoot > state.lastTickAt) {
    advanceTime(state, nowAtBoot, 'active');
  }
  jumpAway(state, reloadJumpMs, nowAtBoot);
} else {
  const gap = nowAtBoot - state.lastTickAt;
  if (gap >= content.balance.awayThresholdMs) {
    advanceTime(state, nowAtBoot, 'away');
  } else if (gap > 0) {
    advanceTime(state, nowAtBoot, 'active');
  }
}
persistSave(state, nowAtBoot);

const persistAndRender = (now = Date.now()): void => {
  persistSave(state, now);
  overlay.render(state, now);
  view.syncState(state, now);
};

const handleCast = (): void => {
  const now = Date.now();
  const res = tryFish(state, now);
  if (res.ok) {
    const val = unitPrice(res.value.sellValue, state.upgrades.market ?? 0);
    overlay.setStatus(`Caught ${res.value.name} (+${val}c in basket).`);
    view.triggerSplash(res.value.color);
    persistAndRender(now);
  } else {
    const waitSec = Math.ceil(Math.max(0, state.fishing.manualNextAt - now) / 1000);
    overlay.setStatus(`Line cooling down (${waitSec}s left).`);
  }
};

const handlePlotInteraction = (plotIndex: number): void => {
  const now = Date.now();
  const plot = state.plots[plotIndex];
  if (!plot) return;

  if (plot.cropId === null) {
    const cropId = overlay.getSelectedCrop();
    const planted = plantPlot(state, plotIndex, cropId, now);
    if (planted.ok) {
      const crop = content.crops.find((c) => c.id === cropId);
      overlay.setStatus(`Planted ${crop?.name ?? cropId} in Plot ${plotIndex + 1}.`);
      persistAndRender(now);
    }
    return;
  }

  if (plot.readyAt !== null && now >= plot.readyAt) {
    const harvested = harvestPlot(state, plotIndex, now);
    if (harvested.ok) {
      overlay.setStatus(`Harvested ${harvested.value.name} from Plot ${plotIndex + 1}!`);
      persistAndRender(now);
    }
    return;
  }

  if (plot.readyAt !== null) {
    const remSec = Math.ceil((plot.readyAt - now) / 1000);
    const crop = content.crops.find((c) => c.id === plot.cropId);
    overlay.setStatus(`${crop?.name ?? plot.cropId} still growing (${remSec}s left).`);
  }
};

const view = await mountScene(canvas, {
  onWaterTap: () => handleCast(),
  onPlotTap: (plotIndex) => handlePlotInteraction(plotIndex),
});

const resetIsland = (): void => {
  const now = Date.now();
  state = createInitialState(now, freshSeed());
  overlay.closeUpgrades();
  overlay.setStatus('Island reset to a fresh start.');
  persistAndRender(now);
};

const overlay = mountOverlay({
  onCast: () => handleCast(),
  onSelectCrop: (cropId) => {
    const crop = content.crops.find((c) => c.id === cropId);
    overlay.setStatus(`Selected ${crop?.name ?? cropId} seeds.`);
    overlay.render(state, Date.now());
  },
  onPlotAction: (plotIndex) => handlePlotInteraction(plotIndex),
  onSellBasket: () => {
    const gained = sellAll(state);
    if (gained > 0) {
      overlay.setStatus(`Sold basket for ${gained} coins!`);
      persistAndRender();
    }
  },
  onBuyUpgrade: (upgradeId) => {
    const res = buyUpgrade(state, upgradeId);
    if (res.ok) {
      const def = content.upgrades.find((u) => u.id === upgradeId);
      overlay.setStatus(`Purchased ${def?.name ?? upgradeId} (Lv. ${res.value.level})!`);
      persistAndRender();
    }
  },
  onCollectPending: (mode) => {
    const res = collectPending(state, mode);
    if (mode === 'sell') {
      overlay.setStatus(`Collected and sold away goods for ${res.coinsGained} coins!`);
    } else {
      overlay.setStatus(`Stashed ${res.itemsCollected} away items into your basket.`);
    }
    persistAndRender();
  },
  onResetIsland: () => resetIsland(),
  onDevJumpHours: (hours) => {
    const now = Date.now();
    if (now > state.lastTickAt) {
      advanceTime(state, now, 'active');
    }
    const ms = Math.round(hours * 3_600_000);
    const report = jumpAway(state, ms, now);
    overlay.setStatus(
      `Simulated ${hours}h away (${Math.round(report.processed / 60_000)}m processed).`,
    );
    persistAndRender(now);
  },
  onDevReset: () => resetIsland(),
});

persistAndRender(nowAtBoot);

// 1s active tick while visible; pause on hide and resolve away time on show
let activeInterval: number | null = null;

const startActiveLoop = (): void => {
  if (activeInterval !== null) return;
  activeInterval = window.setInterval(() => {
    if (document.hidden) return;
    const now = Date.now();
    advanceTime(state, now, 'active');
    persistAndRender(now);
  }, 1000);
};

const stopActiveLoop = (): void => {
  if (activeInterval !== null) {
    window.clearInterval(activeInterval);
    activeInterval = null;
  }
};

document.addEventListener('visibilitychange', () => {
  const now = Date.now();
  if (document.hidden) {
    stopActiveLoop();
    persistSave(state, now);
  } else {
    const gap = now - state.lastTickAt;
    if (gap >= content.balance.awayThresholdMs) {
      advanceTime(state, now, 'away');
    } else if (gap > 0) {
      advanceTime(state, now, 'active');
    }
    persistAndRender(now);
    startActiveLoop();
  }
});

if (!document.hidden) {
  startActiveLoop();
}

const debug: IslandDebug = {
  ready: true,
  getState: () => structuredClone(state),
  project: (target) => view.project(target),
  fish: () => {
    const now = Date.now();
    const res = tryFish(state, now);
    if (res.ok) {
      view.triggerSplash(res.value.color);
      persistAndRender(now);
    }
    return res;
  },
  plant: (index, cropId) => {
    const now = Date.now();
    const chosen = cropId ?? overlay.getSelectedCrop();
    overlay.setSelectedCrop(chosen);
    const res = plantPlot(state, index, chosen, now);
    if (res.ok) {
      persistAndRender(now);
    }
    return res;
  },
  harvest: (index) => {
    const now = Date.now();
    const res = harvestPlot(state, index, now);
    if (res.ok) {
      persistAndRender(now);
    }
    return res;
  },
  sell: () => {
    const gained = sellAll(state);
    persistAndRender();
    return gained;
  },
  buy: (id) => {
    const res = buyUpgrade(state, id);
    if (res.ok) {
      persistAndRender();
    }
    return res;
  },
  jumpHours: (hours) => {
    const now = Date.now();
    if (now > state.lastTickAt) {
      advanceTime(state, now, 'active');
    }
    const ms = Math.round(hours * 3_600_000);
    const report = jumpAway(state, ms, now);
    persistAndRender(now);
    return report;
  },
  reloadJumpHours: (hours) => {
    const ms = Math.round(hours * 3_600_000);
    persistSave(state, Date.now());
    window.sessionStorage.setItem(JUMP_STORAGE_KEY, String(ms));
    window.location.reload();
  },
  reset: () => {
    const now = Date.now();
    state = createInitialState(now, freshSeed());
    overlay.closeUpgrades();
    persistAndRender(now);
  },
  collect: (mode) => {
    const res = collectPending(state, mode);
    persistAndRender();
    return res;
  },
};

window.__ISLAND__ = debug;

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    stopActiveLoop();
    view.dispose();
  });
}

function consumeReloadJumpMs(): number {
  let jumpMs = 0;
  try {
    const stored = window.sessionStorage.getItem(JUMP_STORAGE_KEY);
    if (stored) {
      window.sessionStorage.removeItem(JUMP_STORAGE_KEY);
      const parsed = Number(stored);
      if (Number.isFinite(parsed) && parsed > 0) {
        jumpMs = parsed;
      }
    }
  } catch {
    // Ignore sessionStorage errors
  }

  const url = new URL(window.location.href);
  const param = url.searchParams.get('jumpMs');
  if (param !== null) {
    const parsed = Number(param);
    if (Number.isFinite(parsed) && parsed > 0) {
      jumpMs = parsed;
    }
    url.searchParams.delete('jumpMs');
    window.history.replaceState({}, '', url.toString());
  }

  return jumpMs;
}

function freshSeed(): number {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  const seed = buffer[0];
  return seed ? seed : 1;
}

function persistSave(next: GameState, now: number): void {
  adapter.save(serialize(next));
  void writeWidgetSnapshot(next, now);
}
