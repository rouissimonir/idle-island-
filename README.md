# Island Idle

A small 3D idle island: fish, farm, leave, and come back to collect. This repository is the starter shell. The rules are written down. The fishing and farming actions are the next milestone, not this one.

The owner does not hand-write the code. Agents should start at [AGENTS.md](AGENTS.md) and [docs/ROADMAP.md](docs/ROADMAP.md).

## Run it in a browser

```bash
npm install
npm run dev
```

Open http://127.0.0.1:47321 . You should see a low-poly island, water, a dock, and four empty plots. The coin line stays at 0. Tapping the water does nothing yet.

Other commands:

```bash
npm test          # unit tests
npm run lint      # ESLint and Prettier
npm run build     # typecheck and production bundle
npm run sim       # prints a stub until the economy sim exists
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
