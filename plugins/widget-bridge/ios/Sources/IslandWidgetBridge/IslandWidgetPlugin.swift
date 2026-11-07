import Foundation
import Capacitor
import WidgetKit

public enum IslandWidgetStore {
    public static let appGroupId = "group.app.islandidle.game"
    public static let fileName = "widget-snapshot.json"
    public static let didWriteNotification = Notification.Name("IslandWidgetSnapshotDidWrite")

    public static func containerURL() -> URL? {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupId)
    }

    public static func snapshotURL() -> URL? {
        containerURL()?.appendingPathComponent(fileName)
    }

    @discardableResult
    public static func write(json: String) -> Bool {
        guard let url = snapshotURL() else { return false }
        do {
            try json.data(using: .utf8)?.write(to: url, options: [.atomic])
            return true
        } catch {
            return false
        }
    }
}

@objc(IslandWidgetPlugin)
public class IslandWidgetPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "IslandWidgetPlugin"
    public let jsName = "IslandWidget"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "writeSnapshot", returnType: CAPPluginReturnPromise)
    ]

    @objc func writeSnapshot(_ call: CAPPluginCall) {
        guard let json = call.getString("json") else {
            call.reject("Missing json")
            return
        }

        guard IslandWidgetStore.write(json: json) else {
            call.reject("App Group container unavailable (group.app.islandidle.game)")
            return
        }

        WidgetCenter.shared.reloadAllTimelines()
        NotificationCenter.default.post(
            name: IslandWidgetStore.didWriteNotification,
            object: nil,
            userInfo: ["json": json]
        )
        call.resolve()
    }
}
