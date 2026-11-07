# AGENTS.md

Instructions for any coding agent working in this repo (Claude, GPT, Grok, Cursor, or otherwise). The owner, Monir, does not write code by hand. He runs builds, drops `.glb` files in, and steers by prompting. Optimize for the next agent, not for a human skimming a tutorial.

## Status

Milestones 0–4 are done: docs, tooling, JSON content + schema validation, core rules (`src/core`), playable 3D island + HTML overlay (`src/render`, `src/ui`), the 14-day economy simulation (`src/sim`, `scripts/sim.ts`), and the GLB art-swap check (`assets/models/rock.glb`, `assets/assets.json`). Milestone 5 web work is complete (dev clock gated to `import.meta.env.DEV`, Reset Island visible), `ios/` exists (Capacitor 8 SPM), and `.github/workflows/ios.yml` uploads an IPA to App Store Connect from secrets. Milestone 5 is still open until the owner verifies on an iPhone via Internal TestFlight that force-quit keeps the save and backgrounding stops the render loop. Do one milestone per session, always the lowest milestone in [docs/ROADMAP.md](docs/ROADMAP.md) that is not marked done. Do not skip ahead.

## Before you finish

Run all three. Do not finish while any of them fail.

```bash
npm test
npm run lint
npm run build
```

`npm run lint` is ESLint plus Prettier. Fix formatting with `npm run format`.

Also run `npm run sim` or `npm run shots` when the milestone you touched says to.

## Owner workflow

- He tests in a browser, then later in Xcode on a Mac.
- He adds art by dropping a GLB and editing `assets/assets.json`. He should not have to edit TypeScript for a prop swap.
- He will not notice a broken import, a skipped test, or a number that only lives in a comment. If the rules change, update `docs/RULES.md` and `src/data/*.json` in the same change.

## Layout

```text
AGENTS.md                 this file
README.md                 how to run the app
docs/DESIGN.md            why the game is shaped this way
docs/RULES.md             formulas and numbers (authoritative)
docs/ROADMAP.md           milestones and the next prompt
docs/NATIVE.md            future Live Activity / widget placeholder
assets/assets.json        prop manifest (id, file, scale, license, source)
assets/models/            GLB files live here
src/data/                 JSON content + schema parser
src/core/                 pure game rules, no Three.js, no DOM
src/render/               Three.js scene, loop, GLB swap
src/platform/             localStorage adapter; later the widget snapshot
src/ui/                   HTML/CSS overlay
src/sim/                  14-day economy simulation library
scripts/sim.ts            npm run sim
tests/                    Vitest (*.test.ts). Playwright lives in tests/e2e
ios/                      Capacitor 8 SPM Xcode project (App.xcodeproj)
.github/workflows/ios.yml macos-latest archive + App Store Connect upload
```

There is no database, no auth, and no network API. Do not add them.

## Conventions

- TypeScript strict mode. Relative imports use the `.ts` extension (`import { x } from './state.ts'`). `verbatimModuleSyntax` is on: use `import type` for types.
- No enums and no parameter properties (`erasableSyntaxOnly`).
- `src/core` mutates the `GameState` object it is given and returns a result. State must stay JSON-serializable: plain data, no functions, no class instances, no `Date`.
- Economy numbers live in `src/data/*.json`. Formulas live in `docs/RULES.md` and, once milestone 1 exists, `src/core/formulas.ts`. Do not hard-code a cost or a duration in a component.
- New content kinds (a new upgrade effect, a new rarity) require a branch in the schema (`src/data/validate.ts`), the rules doc, and the system that applies them. Do not invent a parallel config file.
- RNG is mulberry32, stored on `state.rngState`. The exact step is in `docs/RULES.md`. Do not call `Math.random` inside `src/core`.
- Public gameplay API is exported from `src/core/index.ts`. Render and UI import that barrel, not deep files, unless they are the core tests.
- Keep functions small and named for the rule they implement. Match existing names: `createInitialState`, `serialize`, `deserialize`, `cappedElapsedMs`.

## Battery and rendering

These are already implemented. Do not regress them.

- Target 30 fps (`TARGET_FPS`, `FRAME_MS` in `src/render/loop.ts`).
- `devicePixelRatio` is capped at 2 (`MAX_PIXEL_RATIO`).
- The loop renders one frame when something is dirty, then stops. It does not spin when the island is idle.
- `document.hidden` cancels the loop. Resume with a single render when the page is visible again.
- No shadow maps. Do not allocate geometries, materials, or GLTF loaders inside the frame callback.
- Continuous motion (water, bobbers) must be short and must set the loop's animating flag. When the gesture or splash ends, the loop goes idle again. Honor `prefers-reduced-motion` by skipping those tweens.

`nextFrameDecision` is unit-tested. Extend it rather than replacing the loop with a raw `requestAnimationFrame` spinner.

## How to add a 3D asset

1. Export a GLB, Y-up, 1 unit = 1 meter, origin at the base center.
2. Put it at `assets/models/<id>.glb`.
3. In `assets/assets.json`, set `"file": "models/<id>.glb"` and `"scale"` on the entry with that `id`.
4. Reload. `loadModel` in `src/render/assets.ts` replaces the placeholder group. `file: null` keeps the primitive.

Scene ids that must exist in the manifest: `water`, `island`, `dock`, `plot`, `tree`, `cottage`, `rock` (`SCENE_ASSETS`). Plots are repeated; one GLB is cloned per plot. A plot GLB may include an empty object named `cropAnchor` at local `(0, 0.25, 0)` for the crop mesh. Missing anchor means crops sit at that default offset (milestone 2).

License and source strings are required. Do not commit a GLB whose license you cannot name.

## Save

- Key: `island-idle-save-v1` (`SAVE_KEY`).
- Adapter: `createSaveAdapter` in `src/platform/storage.ts`. Core never touches `localStorage`.
- `deserialize` returns `null` for corrupt data or a different `version`. The app then starts a new island. Bump `SAVE_VERSION` and write a migration in `src/core/save.ts` when the shape changes. Do not silently ignore unknown fields once milestone 1 lands; unknown upgrade or item ids should be stripped or rejected, and the choice documented in `docs/RULES.md`.

## Debug hook

`window.__ISLAND__` is `{ ready: true }` after the first mount. Milestone 2 extends `IslandDebug` in `src/debug.ts`. Keep the global name. Planned methods: `getState`, `project`, `fish`, `plant`, `harvest`, `sell`, `buy`, `jumpHours`, `reloadJumpHours`, `reset`, `collect`. Playwright should drive the 3D view through `project` plus real clicks, and drive time through `reloadJumpHours`, not by poking private modules.

## Commands

| Script             | What it does                                          |
| ------------------ | ----------------------------------------------------- |
| `npm run dev`      | Vite on port 47321                                    |
| `npm test`         | Vitest, `tests/**/*.test.ts` only                     |
| `npm run lint`     | ESLint and Prettier                                   |
| `npm run build`    | `tsc --noEmit` and Vite build                         |
| `npm run sim`      | 14-day economy curve                                  |
| `npm run shots`    | Playwright screenshots into `artifacts/` (gitignored) |
| `npm run cap:sync` | Production build, then `cap sync` (needs `ios/`)      |

`npm install` needs the repo `.npmrc` (`legacy-peer-deps=true`). npm 10 crashes while resolving Vitest and typescript-eslint peers without it. TypeScript is 6.0 because typescript-eslint does not accept TypeScript 7 yet. Do not bump either "just because".

Shots need a browser once per machine: `npx playwright install chromium`.

## Do not

- Do not import `three` or touch `document` / `localStorage` from `src/core`. A test fails if you do.
- Do not build the Swift Live Activity, widget, or StandBy extension. Read `docs/NATIVE.md` and stop.
- Do not add IAP, accounts, analytics, or a backend in a gameplay milestone.
- Do not retune every JSON number in the same change as a feature. Change numbers, run `npm run sim` once it exists, and update `docs/RULES.md` if a formula changed.
- Do not replace the placeholder scene with a downloaded asset pack.
