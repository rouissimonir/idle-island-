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

1. Enable App Group `group.app.islandidle.game` on App ID `app.islandidle.game`.
2. Create App ID `app.islandidle.game.IslandActivities` with the **same App Group** (and Live Activities if listed).
3. **Regenerate** the App Store provisioning profile for the **main app** after enabling App Groups (old profiles lack the capability). Update GitHub secret `PROVISIONING_PROFILE_BASE64`.
4. Create an App Store provisioning profile for the **widget** App ID (with App Groups). Add GitHub secret `PROVISIONING_PROFILE_WIDGET_BASE64`.
5. Rebuild via `.github/workflows/ios.yml` or Xcode.

CI error `"doesn't include the App Groups capability"` / `"doesn't support the group.app.islandidle.game App Group"` means the **secret bytes** are still an old profile. Editing the App ID alone does not update `PROVISIONING_PROFILE_BASE64`.

### Replace `PROVISIONING_PROFILE_BASE64` (main app)

Apple Developer → Certificates, Identifiers & Profiles:

1. Identifiers → `app.islandidle.game` → confirm **App Groups** is on and includes `group.app.islandidle.game` → Save.
2. Profiles → open the existing App Store profile for `app.islandidle.game` (e.g. "Island Idle App Store") → Edit → regenerate/save so it picks up App Groups → **Download** the new `.mobileprovision`.
   - Or Profiles → **+** → App Store → select `app.islandidle.game` → select your Distribution cert → name it → Generate → Download.
3. On Windows PowerShell, Base64-encode the downloaded file (one line, no wrapping):

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("$env:USERPROFILE\Downloads\Island_Idle_App_Store.mobileprovision")) | Set-Clipboard
```

Adjust the path/filename to match the download. Paste the clipboard into GitHub → Settings → Secrets and variables → Actions → update secret **`PROVISIONING_PROFILE_BASE64`** (replace the value; do not create a second secret). 4. Optional local check that the new profile lists the group (macOS):

```bash
security cms -D -i ~/Downloads/Island_Idle_App_Store.mobileprovision | plutil -extract Entitlements xml -o - - | plutil -p -
```

You must see `com.apple.security.application-groups` and `group.app.islandidle.game`. 5. Only then re-run the iOS workflow (`workflow_dispatch` or a push to `main`). Retrying CI without updating the secret will fail the same way.

Do the same for `PROVISIONING_PROFILE_WIDGET_BASE64` if the widget profile was created before App Groups was enabled on `app.islandidle.game.IslandActivities`.

## Not in this file

StoreKit, push notifications, and App Intents. Ask the owner before adding them.
