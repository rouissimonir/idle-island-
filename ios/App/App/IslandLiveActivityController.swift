import Foundation
import IslandShared
#if canImport(ActivityKit)
import ActivityKit
#endif

enum IslandLiveActivityController {
    static func startObserving() {
        NotificationCenter.default.addObserver(
            forName: Notification.Name("IslandWidgetSnapshotDidWrite"),
            object: nil,
            queue: .main
        ) { note in
            let json = note.userInfo?["json"] as? String
            sync(json: json)
        }
    }

    static func sync(json: String?) {
        #if canImport(ActivityKit)
        // ActivityContent / content-based request APIs require 16.2+.
        guard #available(iOS 16.2, *) else { return }
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }

        let snapshot: IslandWidgetSnapshot
        if let json, let decoded = IslandWidgetSnapshot.decode(json: json) {
            snapshot = decoded
        } else {
            snapshot = IslandWidgetSnapshot.loadFromAppGroup()
        }

        let state = IslandActivityAttributes.ContentState(snapshot: snapshot)
        Task { @MainActor in
            if let existing = Activity<IslandActivityAttributes>.activities.first {
                await existing.update(ActivityContent(state: state, staleDate: nil))
            } else {
                let attributes = IslandActivityAttributes(startedAt: Date().timeIntervalSince1970 * 1000)
                _ = try? Activity.request(
                    attributes: attributes,
                    content: ActivityContent(state: state, staleDate: nil),
                    pushType: nil
                )
            }
        }
        #endif
    }
}
