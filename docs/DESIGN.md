# Island Idle

A tiny 3D fishing-and-farming island that keeps going while the app is closed. The player glances at it, then opens the app to collect, upgrade, and add automation. The tone is cozy and low-intensity, closer to a desktop companion like Rusty's Retirement than to an action game.

The island's name in the shell is Saltglass Isle. The product name is Island Idle.

## Session

A session is short. The player opens the island, taps the water a few times, harvests whatever is ripe, sells the basket, maybe buys one upgrade, and leaves. Between sessions the island works on its own, up to a cap. The phone surfaces (Live Activity, home-screen widget, StandBy) are later. They show the same save; they are not a second game.

## Core loop

1. Tap the water or the dock to fish. Each cast has a cooldown and adds one fish to the basket.
2. Tap an empty plot to plant the selected crop. Tap a ripe plot to harvest. Growing plots wait.
3. Sell the basket for coins. Collection counts stay even after the sale.
4. Spend coins on upgrades. Three level tracks (rod, soil, market) and three unlocks (auto-fisher, sprinkler, helper).
5. Leave. Automation, and a slow tide if the auto-fisher is not owned yet, keeps producing until the offline cap.

Active tapping is the fast income. Automation is slower and is what makes the game move while the player is away.

## Resources

- **Coins.** The only currency. Integer.
- **Fish and crops in the basket.** Unsold stacks, keyed by content id.
- **Collection.** Lifetime counts, used later for a codex. Selling does not clear them.
- **Pending rewards.** Goods produced while away, waiting for the player to collect. Separate from the basket until collected.

There is no energy, no premium currency, and no seed item. Planting is free. Time is the cost.

## Fishing

Manual casts use the rod's manual interval. The auto-fisher uses a slower interval and the same fish table. Fish are picked with the seeded RNG and the weight row for the current rod level. Rod 0 can only catch common and uncommon fish. Higher rods add bream, then koi.

## Farming

Four plots. Three crops: turnip, carrot, pumpkin. Longer crops pay more coins per minute, so a short visit wants a fast crop and an overnight wait wants pumpkin. The helper replants the same crop that was harvested. It does not fill an empty plot. The player plants the first one.

Soil and the sprinkler change grow time for crops planted **after** the purchase. `readyAt` is stored on the plot and does not move when those upgrades are bought. That avoids a burst of free harvests.

## Automation

| Unlock      | What it does                                                         |
| ----------- | -------------------------------------------------------------------- |
| Auto-fisher | Casts on its own while the app is open and while the player is away. |
| Sprinkler   | Multiplies grow time for future plantings.                           |
| Helper      | Harvests ripe crops and replants them, including during away time.   |

Without the auto-fisher, away time still grants a slow **tide** catch so the first night is not empty. The tide does not run while the player is actively watching. Buying the auto-fisher replaces the tide.

## Offline

Away time is the gap since `lastTickAt` when the app was not in the foreground. Only `offlineCapMs` of that gap produces goods (4 hours in the starter numbers). Time past the cap is discarded, not banked. Partial crop growth is frozen across the discarded tail so a plant is not punished for a long absence.

Goods from a long absence go to `pending` and a summary is shown. The player can sell them or stash them in the basket. Short backgrounding (under `summaryMinMs`) should not pop a modal; those goods can land in the basket directly. The exact split is in `docs/RULES.md`.

## Presentation

A small diorama: water, an octagonal island, a dock, four plots, a tree, a cottage, a rock. Orthographic camera, gentle yaw and pinch, not a free-fly camera. Placeholder meshes are boxes, cylinders, and spheres. A GLB with the same manifest id replaces that prop.

The HUD is HTML and CSS over the canvas, not Three.js text. Milestone 2 adds the sell button, crop chips, upgrade sheet, away modal, and a dev clock for simulated absence. The dev clock stays until the TestFlight milestone, then it comes out.

Rendering stays idle when nothing is moving. See `AGENTS.md`.

## Later surfaces

The iOS app is this web build inside Capacitor. Live Activities, the Dynamic Island, a home-screen widget, and StandBy are a Swift extension that reads a tiny snapshot of the same save. They are specified in `docs/NATIVE.md` and are not part of the web prototype.

## Monetization

Not built. The intended shape, so systems are not designed against it:

- One paid unlock (premium app, or free with a single non-consumable), plus optional cosmetic island packs.
- Cosmetics swap looks, not numbers. They go through `assets/assets.json`, not through a second economy.
- No ads, no energy refills, no loot boxes.

## Decisions in force

Change these only if the owner asks.

- Early upgrades are cheap so a playtest can buy a rod, soil, a market level, and the auto-fisher in one sitting. Later levels are expensive so the sim can show a multi-day curve. The JSON values are a first pass, not a final tune.
- Offline efficiency is "full rate, hard time cap", not a percent penalty on top of the cap.
- Coins are integers. Prices use `Math.round`.
- The basket is explicit. Catches are not auto-sold during active play. Away collection can sell in one tap.
- Four plots, all crops available from the start.

## Open questions

None of these block milestone 1.

- Is 4 hours the right cap, or should a longer absence still pay a token amount?
- Should buying soil or a sprinkler speed crops that are already in the ground?
- Is the tide catch (income before any automation) the right first-night feel?
- Which thing is the paid unlock: the whole island, the automation tier, or only cosmetic packs?
- Widget headline: coins waiting, or the next ripe crop?
