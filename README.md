# Island Idle

A small 3D idle island: fish, farm, leave, and come back to collect. Milestones 0–4 are implemented: core rules (`src/core`), playable 3D scene and HTML overlay (`src/render`, `src/ui`), the 14-day economy simulation (`src/sim`), and the GLB art-swap pipeline (`assets/models/rock.glb`). Milestone 5’s web and CI pieces are in place (`ios/`, App Store Connect workflow); device verification on Internal TestFlight is still open.

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
- **Reset Island**: Click **Reset Island** on the status card at any time (including in production builds) to start a fresh island.
- **Away & Dev Clock**: In development (`npm run dev`), use the top-right **Dev** controls (**Away 1h**, **Away 4h**, **Away 8h**, **Reset**) or `?jumpMs=` / `window.__ISLAND__.reloadJumpHours(hours)` to simulate absence up to the 4-hour offline cap and collect or stash pending goods in the **While You Were Away** modal. The **Dev** panel is hidden in production builds.

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

The Capacitor 8 iOS project lives under `ios/` (Swift Package Manager, open `ios/App/App.xcodeproj`). On a Mac with Xcode:

```bash
npm install
npm run build
npx cap add ios   # only if ios/ is missing
npx cap sync ios
open ios/App/App.xcodeproj
```

In Xcode, pick the App target, choose your signing team, and run on a simulator or a phone. After `ios/` exists, later web changes sync with:

```bash
npm run cap:sync
```

Capacitor copies the `dist/` build. The app id is `app.islandidle.game` (`capacitor.config.json`).

### GitHub Actions → App Store Connect

[`.github/workflows/ios.yml`](.github/workflows/ios.yml) runs on `macos-latest`, builds the web app, syncs Capacitor, archives the App scheme, and uploads the IPA to App Store Connect for Internal TestFlight. Signing and upload use repository secrets only — never commit certificates, passwords, or API keys:

- `APP_STORE_CONNECT_API_KEY_ID`
- `APP_STORE_CONNECT_ISSUER_ID`
- `APP_STORE_CONNECT_API_KEY_P8` (contents of the `.p8` key file)
- `APPLE_TEAM_ID`
- `BUILD_CERTIFICATE_BASE64` and `BUILD_CERTIFICATE_PASSWORD`
- `PROVISIONING_PROFILE_BASE64` (app `app.islandidle.game`)
- `PROVISIONING_PROFILE_WIDGET_BASE64` (extension `app.islandidle.game.IslandActivities`)

If a secret is missing, the workflow fails and prints that secret’s name. Milestone 5 stays open until the owner confirms on an iPhone that force-quit keeps the save and backgrounding stops the render loop. Do not submit for App Store review from this path.

### Widgets / Live Activity / StandBy

Milestone 6: the web build writes a tiny snapshot (`toWidgetSnapshot`) on every save. On iOS, `@island-idle/widget-bridge` stores it in App Group `group.app.islandidle.game` as `widget-snapshot.json`. The `IslandActivities` extension shows that headline on the home-screen widget, Lock Screen / StandBy accessories, and Live Activity / Dynamic Island. Swift does not run the economy.

Apple Developer: enable the App Group on `app.islandidle.game`, create `app.islandidle.game.IslandActivities` with the same group, and add GitHub secret `PROVISIONING_PROFILE_WIDGET_BASE64` for the extension’s App Store profile. Details: [docs/NATIVE.md](docs/NATIVE.md).

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
