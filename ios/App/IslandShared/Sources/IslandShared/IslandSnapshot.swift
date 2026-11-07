import Foundation
#if canImport(ActivityKit)
import ActivityKit
#endif

public let islandAppGroupId = "group.app.islandidle.game"
public let islandSnapshotFileName = "widget-snapshot.json"

public struct IslandWidgetSnapshot: Codable, Hashable {
    public var version: Int
    public var coins: Int
    public var pendingValue: Int
    public var pendingItems: Int
    public var awayProcessedMs: Int
    public var nextCropReadyAt: Double?
    public var headline: String

    public init(
        version: Int,
        coins: Int,
        pendingValue: Int,
        pendingItems: Int,
        awayProcessedMs: Int,
        nextCropReadyAt: Double?,
        headline: String
    ) {
        self.version = version
        self.coins = coins
        self.pendingValue = pendingValue
        self.pendingItems = pendingItems
        self.awayProcessedMs = awayProcessedMs
        self.nextCropReadyAt = nextCropReadyAt
        self.headline = headline
    }

    public static let placeholder = IslandWidgetSnapshot(
        version: 1,
        coins: 0,
        pendingValue: 0,
        pendingItems: 0,
        awayProcessedMs: 0,
        nextCropReadyAt: nil,
        headline: "Cast a line when you are back"
    )

    public static func loadFromAppGroup() -> IslandWidgetSnapshot {
        guard let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: islandAppGroupId) else {
            return .placeholder
        }
        let url = container.appendingPathComponent(islandSnapshotFileName)
        guard let data = try? Data(contentsOf: url),
              let decoded = try? JSONDecoder().decode(IslandWidgetSnapshot.self, from: data) else {
            return .placeholder
        }
        return decoded
    }

    public static func decode(json: String) -> IslandWidgetSnapshot? {
        guard let data = json.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(IslandWidgetSnapshot.self, from: data)
    }
}

#if canImport(ActivityKit)
@available(iOS 16.1, *)
public struct IslandActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        public var coins: Int
        public var pendingValue: Int
        public var pendingItems: Int
        public var headline: String
        public var nextCropReadyAt: Double?

        public init(coins: Int, pendingValue: Int, pendingItems: Int, headline: String, nextCropReadyAt: Double?) {
            self.coins = coins
            self.pendingValue = pendingValue
            self.pendingItems = pendingItems
            self.headline = headline
            self.nextCropReadyAt = nextCropReadyAt
        }

        public init(snapshot: IslandWidgetSnapshot) {
            self.init(
                coins: snapshot.coins,
                pendingValue: snapshot.pendingValue,
                pendingItems: snapshot.pendingItems,
                headline: snapshot.headline,
                nextCropReadyAt: snapshot.nextCropReadyAt
            )
        }
    }

    public var startedAt: Double

    public init(startedAt: Double) {
        self.startedAt = startedAt
    }
}
#endif
