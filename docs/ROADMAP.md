# Roadmap

Do the lowest milestone that is not done. One milestone per session. Leave later milestones untouched, including anything in `docs/NATIVE.md`.

## Paste this next

```text
Milestone 6 is implemented in the repo. On Apple Developer, enable App Group group.app.islandidle.game on app.islandidle.game, create App ID app.islandidle.game.IslandActivities with that App Group, add App Store profile secret PROVISIONING_PROFILE_WIDGET_BASE64, run the iOS GitHub Actions workflow, then on iPhone: add the Island Idle home-screen widget / check StandBy / confirm Live Activity + Dynamic Island show the snapshot headline after playing. Do not start milestone 7 (StoreKit) until the owner designs the paywall. Do not submit for App Store review.
```

## Milestone 0 — Scaffold

**Done.**

Docs, Vite + TypeScript + Three.js, Capacitor config, ESLint, Prettier, Vitest, Playwright, JSON content, manifest, serializable state, offline cap helper, placeholder island that renders once and sleeps.

## Milestone 1 — Rules

**Done.**

Build the spec in `docs/RULES.md`.

Create:

- `src/core/rng.ts` — the mulberry32 step, with the three locked sample values
- `src/core/formulas.ts` — cast interval, grow time, unit price
- `src/core/fishing.ts` — `tryFish` and the cast resolver used by `advanceTime`
- `src/core/farming.ts` — plant, harvest, helper cycles
- `src/core/upgrades.ts` — `buyUpgrade` and a view model the UI can render without reimplementing costs
- `src/core/economy.ts` — `sellAll`, basket value, pending value
- `src/core/advance.ts` — `advanceTime`, `shiftTimestamps`

Export the public functions from `src/core/index.ts`. Keep `GameState` as it is unless the spec cannot be expressed; if you must change it, bump `SAVE_VERSION` and say why in `docs/RULES.md`.

Tests, at least:

- The worked formula examples and the RNG sample
- Manual cooldown, including a rod level that changes the interval
- Same seed, same fish sequence
- Rod 0 never rolls koi across a few hundred rolls; rod 5 can
- Plant / occupied / harvest too early / harvest on time
- Sprinkler bought after planting does not change that plot's `readyAt`
- Buy succeeds, rejects when poor, rejects at max level
- Away with no auto-fisher produces tide fish and not more than the cap (a 20h gap equals a 4h gap)
- Active play does not backfill the tide
- Helper replants; without it, an away window harvests once and clears the plot
- `collectPending('sell')` does not sell a pre-existing basket
- Save round-trip after these mutations
- `src/core` still has no `three` or DOM imports

**Done when** `npm test`, `npm run lint`, and `npm run build` pass and the list above is covered.

**Do not** wire the scene, add meshes, or write the sim.

## Milestone 2 — Playable shell

**Done.**

Make the browser build playable on top of milestone 1.

- Tap water or dock to fish. Tap a plot to plant the selected crop or harvest if it is ready. Raycast the groups tagged in `mountProps` (`userData.kind`).
- HTML overlay: coins, basket counts, crop chips, sell button, upgrades sheet with the three tracks and the three automation unlocks.
- Away modal after a real backgrounding or a dev jump of at least `summaryMinMs` when pending goods exist. Actions: collect and sell, or stash.
- Dev control, visible, labeled as dev: away 1 hour, away 4 hours, away 8 hours (shows the cap), and reset. Also `?jumpMs=` or `sessionStorage` so a reload applies the jump once, then strips it.
- 1s active `advanceTime` while visible. On hide, stop the loop and persist. On show, resolve away time.
- Extend `window.__ISLAND__` with the methods listed in `AGENTS.md`.
- Short splash when a cast succeeds, then the render loop goes idle again.

**Done when** a person can fish, plant, harvest, earn coins, buy rod, soil, and market once, buy the auto-fisher, reload with a simulated jump, and see the away summary. `npm test`, `npm run lint`, `npm run build`, and `npm run shots` pass. Shots cover a fresh island, a tended island, the upgrades sheet, and the away modal, phone and a desktop width.

**Do not** tune the whole economy in this milestone. **Do not** add the native extension.

## Milestone 3 — Economy sim

**Done.**

Replace the stub in `scripts/sim.ts`. Put the pure runner in `src/sim/` so Vitest can call it.

- 14 simulated days, 2 active sessions of 4 minutes (08:00 and 13:00).
- After the morning session, 2 hours away. After the afternoon session, 18 hours away. Both go through real `advanceTime(..., 'away')` and `collectPending(..., 'sell')`.
- Policy: fish on cooldown, harvest when ripe, plant using the crop rule in `docs/RULES.md`, sell when the basket has value, buy using the suggested order.
- Fixed RNG seed so the printout is stable.
- Print a day table (coins and owned levels) and the first timestamp of every upgrade level.

**Done when** `npm run sim` prints that curve, a unit test runs a shorter sim without throwing, the auto-fisher is not free on the first cast, and the helper is not owned at the end of day 1. If the curve is absurd (everything owned on day 1, or nothing affordable after an hour), adjust JSON **and** `docs/RULES.md` together and say so in the report.

## Milestone 4 — Art swap check

**Done.**

Prove a GLB replaces a placeholder without a code change.

- Add the smallest legal fixture you can generate, or document the exact manual steps if generating a binary is awkward. Prefer a tiny checked-in `assets/models/rock.glb` with a named license if the file is original.
- Set the manifest `file` for `rock`.
- `npm run shots` shows the swapped rock. Clearing `file` restores the primitive.

**Done when** that round-trip is true and `AGENTS.md` still matches the loader.

## Milestone 5 — Device shell

Capacitor 8 uses Swift Package Manager (no CocoaPods). The `ios/` project and `.github/workflows/ios.yml` are in the repo. Web gates for TestFlight (dev clock hidden in production, Reset Island visible) are already done.

On a Mac with Xcode, or via the GitHub Actions macOS runner:

```bash
npm install
npm run build
npx cap add ios   # only if ios/ is missing
npx cap sync ios
open ios/App/App.xcodeproj
```

- `npm run cap:sync` stays the repeat command after `ios/` exists.
- `.github/workflows/ios.yml` archives the App scheme and uploads the IPA to App Store Connect using repository secrets only. Missing secrets fail the job by name.
- Confirm on a real iPhone (Internal TestFlight): force-quit keeps the save, and backgrounding stops the render loop.
- Dev clock is already gated to `import.meta.env.DEV` and hidden in production builds.
- Internal TestFlight only. Do not submit for App Store review yet.
- Do not mark this milestone done until the iPhone checks above pass.

**Do not** add the widget extension in this milestone.

## Milestone 6 — Live Activities, widget, StandBy

**Done in repo** (device wiring still needs Apple Developer App Group + widget provisioning profile).

Read `docs/NATIVE.md`. The web game writes `toWidgetSnapshot` into the App Group; Swift only displays it (home widget, StandBy/Lock Screen accessories, Live Activity / Dynamic Island). Capacitor plugin `@island-idle/widget-bridge`. No StoreKit, push, or App Intents.

## Milestone 7 — Monetization

One premium unlock or a single non-consumable, plus cosmetic packs that only change `assets/assets.json` entries. No ads. Design the paywall with the owner before writing StoreKit code.

## Milestone 8 — App Store

Icons, launch screen, privacy labels, and a pass that the dev clock and debug hook are gone or gated. Not before the game is fun in TestFlight.

## Out of scope until an owner prompt says otherwise

Accounts, cloud save, Android, chat, procedural islands, combat, a second currency, and rebalancing every number on each visit.
