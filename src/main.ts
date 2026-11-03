import type { IslandDebug } from './debug.ts';
import { createInitialState, deserialize, serialize } from './core/index.ts';
import { createSaveAdapter } from './platform/storage.ts';
import { mountScene } from './render/scene.ts';
import './style.css';

const canvas = document.querySelector('#scene');
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error('Missing #scene canvas');
}

const adapter = createSaveAdapter(window.localStorage);
const saved = adapter.load();
const state = saved
  ? (deserialize(saved) ?? createInitialState(Date.now(), freshSeed()))
  : createInitialState(Date.now(), freshSeed());
adapter.save(serialize(state));

const coins = document.querySelector('#coins');
if (coins) coins.textContent = `${state.coins} coins`;

const view = await mountScene(canvas);
const debug: IslandDebug = { ready: true };
window.__ISLAND__ = debug;

if (import.meta.hot) {
  import.meta.hot.dispose(() => view.dispose());
}

function freshSeed(): number {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  const seed = buffer[0];
  return seed ? seed : 1;
}
