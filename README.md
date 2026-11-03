# Island Idle

A small 3D idle island: fish, farm, leave, and come back to collect. Milestones 0–3 are implemented: core rules (`src/core`), playable 3D scene and HTML overlay (`src/render`, `src/ui`), and the 14-day economy simulation (`src/sim`).

The owner does not hand-write the code. Agents should start at [AGENTS.md](AGENTS.md) and [docs/ROADMAP.md](docs/ROADMAP.md).

## Run it in a browser

```bash
npm install
npm run dev
```

Open http://127.0.0.1:47321 .

### How to play

- **Fish**: Tap the water or the dock in the 3D view (or click **Cast Line**) to catch fish into your basket. Each cast starts a manual cooldown and triggers a short water splash.
- **Plant & Harvest**: Pick a crop chip (**Turnip**, **Carrot**, or **Pumpkin**) in the bottom dock, then tap an empty 3D plot (or its plot button) to plant. When a crop is ripe, tap the plot to harvest it into your basket.
- **Sell**: Click **Sell** to convert everything in your basket into coins at current market prices.
- **Upgrades**: Open **Upgrades** to spend coins on the three level tracks (**Better Rod**, **Fertile Soil**, **Market Stall**) and the three automation unlocks (**Auto-fisher**, **Sprinkler**, **Farm Helper**).
- **Away & Dev Clock**: Use the top-right **Dev** controls (**Away 1h**, **Away 4h**, **Away 8h**, **Reset**) or `?jumpMs=` / `window.__ISLAND__.reloadJumpHours(hours)` to simulate absence up to the 4-hour offline cap and collect or stash pending goods in the **While You Were Away** modal.

Other commands:

```bash
npm test          # unit tests (Vitest)
npm run lint      # ESLint and Prettier
npm run build     # typecheck and production bundle
npm run sim       # prints the 14-day economy curve and upgrade timestamps
npm run shots     # screenshots into artifacts/ (needs Playwright's Chromium)
```

The first time you run shots:

```bash
npx playwright install chromium
npm run shots
```

Screenshots land in `artifacts/`, which is gitignored.

`npm install` uses `.npmrc` (`legacy-peer-deps=true`). Leave that file in place. npm 10 can crash without it while resolving Vitest's peer dependencies.

## Run it on an iPhone

The iOS project is not generated here. On a Mac, with Xcode installed:

```bash
npm install
npm run build
npx cap add ios
npx cap sync ios
open ios/App/App.xcworkspace
```

In Xcode, pick the App target, choose your signing team, and run on a simulator or a phone. After `ios/` exists, later web changes sync with:

```bash
npm run cap:sync
```

Capacitor copies the `dist/` build. The app id is `app.islandidle.game` (`capacitor.config.json`).

Live Activities, the Dynamic Island, the home-screen widget, and StandBy are not in this repo. The placeholder is [docs/NATIVE.md](docs/NATIVE.md). Do not add that Swift target until the roadmap says so.

## Add a 3D model

1. Export a GLB. Y-up, meters, origin at the base center.
2. Save it as `assets/models/<id>.glb`. The ids the scene already mounts are `water`, `island`, `dock`, `plot`, `tree`, `cottage`, and `rock`.
3. Edit that id in `assets/assets.json` and set `"file"` to `models/<id>.glb`. Set `scale` if the mesh is huge or tiny. Fill in `license` and `source`.
4. Reload the dev server. The placeholder for that id is replaced. Set `"file"` back to `null` to restore the primitive.

A plot model can include an empty node named `cropAnchor` where crops will sit. Details are in [AGENTS.md](AGENTS.md).

## Where the design lives

- [docs/DESIGN.md](docs/DESIGN.md) — loop, automation, offline play, monetization intent
- [docs/RULES.md](docs/RULES.md) — numbers and formulas
- [docs/ROADMAP.md](docs/ROADMAP.md) — what to build next
