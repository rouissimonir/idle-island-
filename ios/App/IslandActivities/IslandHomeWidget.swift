import SwiftUI
import WidgetKit
import IslandShared

struct IslandHomeProvider: TimelineProvider {
    func placeholder(in context: Context) -> IslandHomeEntry {
        IslandHomeEntry(date: Date(), snapshot: .placeholder)
    }

    func getSnapshot(in context: Context, completion: @escaping (IslandHomeEntry) -> Void) {
        completion(IslandHomeEntry(date: Date(), snapshot: IslandWidgetSnapshot.loadFromAppGroup()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<IslandHomeEntry>) -> Void) {
        let snapshot = IslandWidgetSnapshot.loadFromAppGroup()
        let entry = IslandHomeEntry(date: Date(), snapshot: snapshot)
        var entries = [entry]

        if let readyAtMs = snapshot.nextCropReadyAt {
            let readyDate = Date(timeIntervalSince1970: readyAtMs / 1000)
            if readyDate > Date() {
                let ripe = IslandWidgetSnapshot(
                    version: snapshot.version,
                    coins: snapshot.coins,
                    pendingValue: snapshot.pendingValue,
                    pendingItems: snapshot.pendingItems,
                    awayProcessedMs: snapshot.awayProcessedMs,
                    nextCropReadyAt: snapshot.nextCropReadyAt,
                    headline: "A crop is ready to pick"
                )
                entries.append(IslandHomeEntry(date: readyDate, snapshot: ripe))
            }
        }

        let refresh = Calendar.current.date(byAdding: .minute, value: 15, to: Date()) ?? Date().addingTimeInterval(900)
        completion(Timeline(entries: entries, policy: .after(refresh)))
    }
}

struct IslandHomeEntry: TimelineEntry {
    let date: Date
    let snapshot: IslandWidgetSnapshot
}

struct IslandHomeWidget: Widget {
    let kind = "IslandHomeWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: IslandHomeProvider()) { entry in
            IslandHomeWidgetView(entry: entry)
        }
        .configurationDisplayName("Island Idle")
        .description("Coins, pending goods, and the next harvest.")
        .supportedFamilies(Self.supportedFamilies)
    }

    private static var supportedFamilies: [WidgetFamily] {
        var families: [WidgetFamily] = [.systemSmall, .systemMedium]
        if #available(iOS 16.0, *) {
            families.append(contentsOf: [.accessoryInline, .accessoryRectangular, .accessoryCircular])
        }
        return families
    }
}

struct IslandHomeWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: IslandHomeEntry

    private let lagoon = Color(red: 0.43, green: 0.72, blue: 0.78)

    var body: some View {
        content
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .padding(4)
            .background(lagoon)
    }

    @ViewBuilder
    private var content: some View {
        if #available(iOS 16.0, *) {
            switch family {
            case .accessoryInline:
                Text(entry.snapshot.headline)
            case .accessoryCircular:
                VStack(spacing: 2) {
                    Text("\(entry.snapshot.coins)").font(.headline)
                    Text("c").font(.caption2)
                }
            case .accessoryRectangular:
                VStack(alignment: .leading, spacing: 2) {
                    Text("Island Idle").font(.caption2).fontWeight(.semibold)
                    Text(entry.snapshot.headline).font(.caption)
                }
            default:
                standardBody
            }
        } else {
            standardBody
        }
    }

    private var standardBody: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Island Idle")
                .font(.caption)
                .fontWeight(.semibold)
                .foregroundStyle(.white.opacity(0.9))
            Text("\(entry.snapshot.coins) coins")
                .font(.title2)
                .fontWeight(.bold)
                .foregroundStyle(.white)
            Text(entry.snapshot.headline)
                .font(.caption)
                .foregroundStyle(.white.opacity(0.95))
                .lineLimit(3)
            Spacer(minLength: 0)
        }
    }
}
