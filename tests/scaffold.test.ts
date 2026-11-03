import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import manifest from '../assets/assets.json' with { type: 'json' };
import { content, createInitialState, deserialize, serialize } from '../src/core/index.ts';
import { cappedElapsedMs } from '../src/core/offline.ts';
import fishJson from '../src/data/fish.json' with { type: 'json' };
import { parseAssets, parseContent } from '../src/data/validate.ts';
import { createSaveAdapter } from '../src/platform/storage.ts';
import { FRAME_MS, MAX_PIXEL_RATIO, TARGET_FPS, nextFrameDecision } from '../src/render/loop.ts';
import { SCENE_ASSETS } from '../src/render/props.ts';

describe('game shell', () => {
  it('starts a new island with empty plots and no coins', () => {
    const state = createInitialState(1_000, 5);
    expect(state.version).toBe(2);
    expect(state.coins).toBe(0);
    expect(state.rngState).toBe(5);
    expect(state.plots).toHaveLength(content.balance.plotCount);
    expect(state.plots.every((plot) => plot.cropId === null)).toBe(true);
    expect(state.pending).toBeNull();
  });

  it('caps offline time and ignores a non-positive gap', () => {
    expect(content.balance.offlineCapMs).toBe(14_400_000);
    expect(cappedElapsedMs(60_000)).toBe(60_000);
    expect(cappedElapsedMs(48 * 60 * 60 * 1000)).toBe(14_400_000);
    expect(cappedElapsedMs(0)).toBe(0);
    expect(cappedElapsedMs(-10)).toBe(0);
  });

  it('round-trips a save and rejects a bad payload', () => {
    const state = createInitialState(50, 9);
    state.coins = 12;
    const restored = deserialize(serialize(state));
    expect(restored).toEqual(state);
    expect(deserialize('{')).toBeNull();
    expect(deserialize(JSON.stringify({ ...state, version: 3 }))).toBeNull();
  });

  it('stores the save blob through a key-value adapter', () => {
    const memory = new Map<string, string>();
    const adapter = createSaveAdapter({
      getItem: (key) => memory.get(key) ?? null,
      setItem: (key, value) => {
        memory.set(key, value);
      },
    });
    expect(adapter.load()).toBeNull();
    adapter.save('{"version":1}');
    expect(adapter.load()).toBe('{"version":1}');
  });

  it('accepts the shipped content and rejects a broken fish', () => {
    const brokenFish = structuredClone(fishJson);
    const first = brokenFish[0];
    if (!first) throw new Error('expected a fish stub');
    first.sellValue = 0;
    const parsed = parseContent({
      balance: content.balance,
      fish: brokenFish,
      crops: content.crops,
      upgrades: content.upgrades,
    });
    expect(parsed.ok).toBe(false);
  });

  it('lists every placeholder the scene mounts', () => {
    const parsed = parseAssets(manifest);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const ids = new Set(parsed.value.assets.map((asset) => asset.id));
    for (const id of SCENE_ASSETS) expect(ids.has(id)).toBe(true);
    expect(parsed.value.assets.every((asset) => asset.file === null)).toBe(true);
  });

  it('keeps src/core free of three.js and the DOM', () => {
    for (const file of walk('src/core')) {
      const text = readFileSync(file, 'utf8');
      expect(text).not.toMatch(/from ['"]three/);
      expect(text).not.toMatch(/localStorage/);
      expect(text).not.toMatch(/document\./);
    }
  });

  it('pauses rendering while hidden and sleeps when nothing is moving', () => {
    expect(TARGET_FPS).toBe(30);
    expect(MAX_PIXEL_RATIO).toBe(2);
    expect(
      nextFrameDecision({ hidden: true, elapsedMs: FRAME_MS, dirty: true, animating: true }),
    ).toEqual({ render: false, continueLoop: false });
    expect(
      nextFrameDecision({ hidden: false, elapsedMs: FRAME_MS, dirty: true, animating: false }),
    ).toEqual({ render: true, continueLoop: false });
    expect(
      nextFrameDecision({ hidden: false, elapsedMs: 0, dirty: true, animating: false }),
    ).toEqual({ render: false, continueLoop: true });
  });
});

function walk(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(fullPath));
    else if (entry.name.endsWith('.ts')) files.push(fullPath);
  }
  return files;
}
