import type { IslandDebug } from './debug.ts';

declare global {
  interface Window {
    __ISLAND__?: IslandDebug;
  }
}

export {};
