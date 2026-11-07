# Native surfaces (milestone 6)

WidgetKit extension on the Capacitor iOS app:

- Live Activity and Dynamic Island
- Home-screen widget
- StandBy / Lock Screen (accessory families)

The extension displays a snapshot. It does not fish, farm, or grant coins. The web game remains the only rules engine.

## Layout

```text
ios/App/IslandActivities/          WidgetKit extension target
ios/App/IslandShared/              Shared snapshot + ActivityAttributes SPM package
ios/App/App/IslandLiveActivityController.swift
plugins/widget-bridge/             Capacitor plugin that writes the App Group JSON
src/platform/widgetSnapshot.ts     Pure toWidgetSnapshot(state, now)
src/platform/widgetBridge.ts       Calls the plugin on every save persist
```

App Group id: `group.app.islandidle.game`. Capacitor app id: `app.islandidle.game`. Widget extension id: `app.islandidle.game.IslandActivities`.

## Snapshot contract

`toWidgetSnapshot(state, now)` in `src/platform/widgetSnapshot.ts`:

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

Headline rules (shown as-is by the extension):

- `${pendingValue} coins waiting on the dock` when `pendingItems > 0`
- `A crop is ready to pick` when a plot is ripe
- `Next harvest in 12m` when a crop is growing
- `Cast a line when you are back` otherwise

File in the App Group: `widget-snapshot.json`. Native code must not parse the full `island-idle-save-v1` save or duplicate `docs/RULES.md`.

## Refresh

The web app writes the snapshot whenever it persists a save (action, away resolution, background). The Capacitor plugin `IslandWidget.writeSnapshot` writes the App Group file, reloads WidgetKit timelines, and notifies the app to update/start the Live Activity. The extension does not tick the economy. A stale snapshot is acceptable until the next open.

## Apple Developer setup (owner)

1. Enable App Group `group.app.islandidle.game` on the App ID `app.islandidle.game`.
2. Create App ID `app.islandidle.game.IslandActivities` with the same App Group (+ Live Activities if listed separately).
3. Create an App Store provisioning profile for the widget extension and add GitHub secret `PROVISIONING_PROFILE_WIDGET_BASE64`.
4. Rebuild via `.github/workflows/ios.yml` or Xcode.

## Not in this file

StoreKit, push notifications, and App Intents. Ask the owner before adding them.
