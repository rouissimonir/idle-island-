import {
  basketCount,
  basketValue,
  content,
  currentCropGrowMs,
  getUpgradeViews,
  pendingCount,
  pendingValue,
  unitPrice,
  type GameState,
  type UpgradeView,
} from '../core/index.ts';

export interface OverlayCallbacks {
  onCast: () => void;
  onSelectCrop: (cropId: string) => void;
  onPlotAction: (plotIndex: number) => void;
  onSellBasket: () => void;
  onBuyUpgrade: (upgradeId: string) => void;
  onCollectPending: (mode: 'sell' | 'stash') => void;
  onDevJumpHours: (hours: number) => void;
  onDevReset: () => void;
}

export interface OverlayController {
  render: (state: GameState, now: number) => void;
  setStatus: (message: string) => void;
  getSelectedCrop: () => string;
  setSelectedCrop: (cropId: string) => void;
  openUpgrades: () => void;
  closeUpgrades: () => void;
}

export function mountOverlay(callbacks: OverlayCallbacks): OverlayController {
  let selectedCropId = content.crops[0]?.id ?? 'turnip';
  let upgradesOpen = false;

  const coinsEl = mustEl('#coins');
  const statusNoteEl = mustEl('#status-note');
  const basketItemsEl = mustEl('#basket-items');
  const castBtn = mustButton('#cast-btn');
  const sellBtn = mustButton('#sell-btn');
  const upgradesBtn = mustButton('#upgrades-btn');
  const closeUpgradesBtn = mustButton('#close-upgrades-btn');
  const upgradesSheetEl = mustEl('#upgrades-sheet');
  const upgradesTracksEl = mustEl('#upgrades-tracks');
  const upgradesAutoEl = mustEl('#upgrades-automation');
  const cropChipsEl = mustEl('#crop-chips');
  const plotsStripEl = mustEl('#plots-strip');

  const awayModalEl = mustEl('#away-modal');
  const awayDurationEl = mustEl('#away-duration');
  const awayItemsEl = mustEl('#away-items');
  const awayValueEl = mustEl('#away-value');
  const collectSellBtn = mustButton('#collect-sell-btn');
  const collectStashBtn = mustButton('#collect-stash-btn');

  const devAway1hBtn = mustButton('#dev-away-1h');
  const devAway4hBtn = mustButton('#dev-away-4h');
  const devAway8hBtn = mustButton('#dev-away-8h');
  const devResetBtn = mustButton('#dev-reset');

  const setUpgradesOpen = (open: boolean): void => {
    upgradesOpen = open;
    upgradesSheetEl.classList.toggle('hidden', !open);
    upgradesBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  };

  castBtn.addEventListener('click', () => callbacks.onCast());
  sellBtn.addEventListener('click', () => callbacks.onSellBasket());
  upgradesBtn.addEventListener('click', () => setUpgradesOpen(!upgradesOpen));
  closeUpgradesBtn.addEventListener('click', () => setUpgradesOpen(false));
  upgradesSheetEl.addEventListener('click', (e) => {
    if (e.target === upgradesSheetEl) setUpgradesOpen(false);
  });

  collectSellBtn.addEventListener('click', () => {
    callbacks.onCollectPending('sell');
  });
  collectStashBtn.addEventListener('click', () => {
    callbacks.onCollectPending('stash');
  });

  devAway1hBtn.addEventListener('click', () => {
    callbacks.onDevJumpHours(1);
  });
  devAway4hBtn.addEventListener('click', () => {
    callbacks.onDevJumpHours(4);
  });
  devAway8hBtn.addEventListener('click', () => {
    callbacks.onDevJumpHours(8);
  });
  devResetBtn.addEventListener('click', () => {
    callbacks.onDevReset();
  });

  // Event delegation for crop chips, plots, and upgrade buttons
  cropChipsEl.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement | null)?.closest<HTMLButtonElement>('[data-crop-id]');
    if (!target) return;
    const cropId = target.dataset.cropId;
    if (cropId) {
      selectedCropId = cropId;
      callbacks.onSelectCrop(cropId);
    }
  });

  plotsStripEl.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement | null)?.closest<HTMLButtonElement>(
      '[data-plot-index]',
    );
    if (!target) return;
    const idx = Number(target.dataset.plotIndex);
    if (Number.isInteger(idx)) {
      callbacks.onPlotAction(idx);
    }
  });

  const handleUpgradeClick = (e: Event): void => {
    const target = (e.target as HTMLElement | null)?.closest<HTMLButtonElement>(
      '[data-upgrade-id]',
    );
    if (!target) return;
    const id = target.dataset.upgradeId;
    if (id) {
      callbacks.onBuyUpgrade(id);
    }
  };
  upgradesTracksEl.addEventListener('click', handleUpgradeClick);
  upgradesAutoEl.addEventListener('click', handleUpgradeClick);

  const render = (state: GameState, now: number): void => {
    coinsEl.textContent = `${state.coins} coins`;

    // Cast button state
    const cooldownRemainingMs = Math.max(0, state.fishing.manualNextAt - now);
    if (cooldownRemainingMs > 0) {
      const secs = Math.ceil(cooldownRemainingMs / 1000);
      castBtn.textContent = `Cooling (${secs}s)`;
      castBtn.disabled = true;
    } else {
      castBtn.textContent = 'Cast Line';
      castBtn.disabled = false;
    }

    // Basket summary & sell button
    const bCount = basketCount(state);
    const bVal = basketValue(state);
    if (bCount === 0) {
      basketItemsEl.textContent = 'Empty';
      sellBtn.textContent = 'Sell (0 coins)';
      sellBtn.disabled = true;
    } else {
      basketItemsEl.textContent = formatPileSummary(state.inventory);
      sellBtn.textContent = `Sell (${bVal} coins)`;
      sellBtn.disabled = false;
    }

    // Upgrades badge
    const upgradeViews = getUpgradeViews(state);
    const affordableCount = upgradeViews.filter((u) => u.canAfford).length;
    upgradesBtn.textContent = affordableCount > 0 ? `Upgrades (${affordableCount})` : 'Upgrades';

    // Crop selector chips
    const marketLevel = state.upgrades.market ?? 0;
    cropChipsEl.innerHTML = content.crops
      .map((crop) => {
        const isSelected = crop.id === selectedCropId;
        const growSecs = Math.round(currentCropGrowMs(state, crop) / 1000);
        const price = unitPrice(crop.sellValue, marketLevel);
        return `
          <button
            type="button"
            class="crop-chip ${isSelected ? 'crop-chip-active' : ''}"
            data-crop-id="${crop.id}"
            aria-pressed="${isSelected ? 'true' : 'false'}"
          >
            <span class="crop-dot" style="background:${crop.color}"></span>
            <span class="crop-name">${crop.name}</span>
            <span class="crop-meta">${growSecs}s · ${price}c</span>
          </button>
        `;
      })
      .join('');

    // Plot status buttons
    plotsStripEl.innerHTML = state.plots
      .map((plot, index) => {
        if (plot.cropId === null || plot.readyAt === null) {
          const selectedCrop = content.crops.find((c) => c.id === selectedCropId);
          return `
            <button
              type="button"
              class="plot-pill plot-empty"
              data-plot-index="${index}"
              aria-label="Plot ${index + 1}: Empty, plant ${selectedCrop?.name ?? selectedCropId}"
            >
              <span class="plot-num">Plot ${index + 1}</span>
              <span class="plot-state">Plant ${selectedCrop?.name ?? selectedCropId}</span>
            </button>
          `;
        }
        const crop = content.crops.find((c) => c.id === plot.cropId);
        const name = crop?.name ?? plot.cropId;
        const remainingMs = Math.max(0, plot.readyAt - now);
        if (remainingMs === 0) {
          return `
            <button
              type="button"
              class="plot-pill plot-ripe"
              data-plot-index="${index}"
              aria-label="Plot ${index + 1}: ${name} ready to harvest"
            >
              <span class="plot-num">Plot ${index + 1}</span>
              <span class="plot-state">${name} · Harvest!</span>
            </button>
          `;
        }
        const remSecs = Math.ceil(remainingMs / 1000);
        return `
          <button
            type="button"
            class="plot-pill plot-growing"
            data-plot-index="${index}"
            aria-label="Plot ${index + 1}: ${name} growing, ${remSecs} seconds left"
          >
            <span class="plot-num">Plot ${index + 1}</span>
            <span class="plot-state">${name} · ${remSecs}s</span>
          </button>
        `;
      })
      .join('');

    // Upgrades sheet lists
    const tracks = upgradeViews.filter((u) => !u.automation);
    const automations = upgradeViews.filter((u) => u.automation);
    upgradesTracksEl.innerHTML = tracks.map(renderUpgradeCard).join('');
    upgradesAutoEl.innerHTML = automations.map(renderUpgradeCard).join('');

    // Away summary modal
    const pCount = pendingCount(state);
    if (state.pending && pCount > 0) {
      awayModalEl.classList.remove('hidden');
      const mins = Math.round(state.pending.elapsedMs / 60_000);
      const hours = Math.floor(mins / 60);
      const remMins = mins % 60;
      const timeStr = hours > 0 ? `${hours}h ${remMins}m` : `${mins}m`;
      awayDurationEl.textContent = state.pending.capped
        ? `Away earnings for ${timeStr} (4h offline cap reached).`
        : `Your island kept working for ${timeStr} while you were away.`;
      awayItemsEl.textContent = formatPileSummary(state.pending);
      const pVal = pendingValue(state);
      awayValueEl.textContent = `Total value: ${pVal} coins`;
      collectSellBtn.textContent = `Collect & Sell (+${pVal} coins)`;
    } else {
      awayModalEl.classList.add('hidden');
    }
  };

  return {
    render,
    setStatus(message: string) {
      statusNoteEl.textContent = message;
    },
    getSelectedCrop() {
      return selectedCropId;
    },
    setSelectedCrop(cropId: string) {
      if (content.crops.some((c) => c.id === cropId)) {
        selectedCropId = cropId;
      }
    },
    openUpgrades() {
      setUpgradesOpen(true);
    },
    closeUpgrades() {
      setUpgradesOpen(false);
    },
  };
}

function renderUpgradeCard(u: UpgradeView): string {
  const statusBadge = u.automation
    ? u.isMaxed
      ? 'Owned'
      : 'Locked'
    : `Lv. ${u.level}/${u.maxLevel}`;
  const buttonLabel = u.isMaxed
    ? u.automation
      ? 'Owned'
      : 'Max Level'
    : `Buy · ${u.nextCost} coins`;

  return `
    <div class="upgrade-card" data-testid="upgrade-card-${u.id}">
      <div class="upgrade-info">
        <div class="upgrade-title-row">
          <span class="upgrade-name">${u.name}</span>
          <span class="upgrade-level" data-testid="upgrade-level-${u.id}">${statusBadge}</span>
        </div>
        <p class="upgrade-desc">${u.description}</p>
      </div>
      <button
        type="button"
        class="btn ${u.canAfford ? 'btn-primary' : 'btn-secondary'} upgrade-buy-btn"
        data-upgrade-id="${u.id}"
        aria-label="Buy ${u.name}"
        ${!u.canAfford || u.isMaxed ? 'disabled' : ''}
      >
        ${buttonLabel}
      </button>
    </div>
  `;
}

function formatPileSummary(piles: {
  fish: Record<string, number>;
  crops: Record<string, number>;
}): string {
  const parts: string[] = [];
  for (const fish of content.fish) {
    const count = piles.fish[fish.id] ?? 0;
    if (count > 0) {
      parts.push(`${fish.name} ×${count}`);
    }
  }
  for (const crop of content.crops) {
    const count = piles.crops[crop.id] ?? 0;
    if (count > 0) {
      parts.push(`${crop.name} ×${count}`);
    }
  }
  return parts.length > 0 ? parts.join(', ') : 'Empty';
}

function mustEl(selector: string): HTMLElement {
  const el = document.querySelector<HTMLElement>(selector);
  if (!el) throw new Error(`Missing UI element: ${selector}`);
  return el;
}

function mustButton(selector: string): HTMLButtonElement {
  const el = document.querySelector<HTMLButtonElement>(selector);
  if (!el) throw new Error(`Missing button element: ${selector}`);
  return el;
}
