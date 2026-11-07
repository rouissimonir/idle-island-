import { Capacitor } from '@capacitor/core';
import { IslandWidget } from '../../plugins/widget-bridge/src/index.ts';
import type { GameState } from '../core/types.ts';
import { toWidgetSnapshot } from './widgetSnapshot.ts';

/** localStorage mirror for browser/dev; native uses the App Group file instead. */
export const WIDGET_SNAPSHOT_KEY = 'island-idle-widget-snapshot-v1';

/**
 * Persist the widget snapshot whenever the save is written.
 * Native iOS writes App Group JSON + refreshes Live Activity / widgets.
 * Web keeps a localStorage copy for debugging only.
 */
export async function writeWidgetSnapshot(state: GameState, now: number): Promise<void> {
  const snapshot = toWidgetSnapshot(state, now);
  const json = JSON.stringify(snapshot);

  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(WIDGET_SNAPSHOT_KEY, json);
    } catch {
      // Ignore quota / private-mode failures.
    }
  }

  if (!Capacitor.isNativePlatform()) {
    return;
  }

  try {
    await IslandWidget.writeSnapshot({ json });
  } catch {
    // Plugin may be missing on a stale native build; never break gameplay saves.
  }
}
