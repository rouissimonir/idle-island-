# Native placeholder

Do not build this until roadmap milestone 6. There is no Swift target in the repo on purpose.

## What it is

A WidgetKit extension on the Capacitor iOS app for:

- Live Activity and Dynamic Island
- Home-screen widget
- StandBy

The extension displays a snapshot. It does not fish, farm, or grant coins. The web game remains the only rules engine.

## Suggested layout, later

```text
ios/App/IslandActivities/        WidgetKit extension
ios/App/IslandActivities/IslandSnapshot.swift
```

App Group id to reserve: `group.app.islandidle.game`. The Capacitor app id is `app.islandidle.game`.

## Snapshot contract

The web side should grow a pure function `toWidgetSnapshot(state, now)` in `src/platform/widgetSnapshot.ts` that returns JSON the extension can decode. Write that function in milestone 6, not before. Shape:

```ts
interface WidgetSnapshot {
  version: 1;
  coins: number;
  pendingValue: number;
  pendingItems: number;
  awayProcessedMs: number;
  nextCropReadyAt: number | null;
  headline: string;
}
```

Headline examples the extension can show as-is:

- `186 coins waiting on the dock` when `pendingItems > 0`
- `A crop is ready to pick` when a plot is ripe
- `Next harvest in 12m` when a crop is growing
- `Cast a line when you are back` otherwise

The JS save key is `island-idle-save-v1`. The native side should read the snapshot file in the App Group, not parse the full save and duplicate `docs/RULES.md`.

## Refresh

The web app writes the snapshot when it persists a save (action, away resolution, background). The extension does not tick the economy. A stale snapshot is acceptable until the next open.

## Not in this file

StoreKit, push notifications, and App Intents. Ask the owner before adding them.
