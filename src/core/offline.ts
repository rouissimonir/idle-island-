import { content } from './content.ts';

/**
 * Clamp a time-away gap to the offline earnings window.
 * Resolving what was earned is milestone 1 (`advanceTime` in this folder).
 */
export function cappedElapsedMs(elapsedMs: number, capMs = content.balance.offlineCapMs): number {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return 0;
  return Math.min(elapsedMs, capMs);
}
