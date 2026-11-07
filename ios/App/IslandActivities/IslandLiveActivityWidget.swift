import SwiftUI
import WidgetKit
import IslandShared
#if canImport(ActivityKit)
import ActivityKit
#endif

@available(iOS 16.1, *)
struct IslandLiveActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: IslandActivityAttributes.self) { context in
            IslandLiveActivityBanner(state: context.state)
                .padding()
                .activityBackgroundTint(Color(red: 0.43, green: 0.72, blue: 0.78))
                .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Text("\(context.state.coins)c")
                        .font(.headline)
                        .foregroundStyle(.white)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    if context.state.pendingItems > 0 {
                        Text("+\(context.state.pendingValue)")
                            .font(.headline)
                            .foregroundStyle(.white)
                    }
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Text(context.state.headline)
                        .font(.caption)
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            } compactLeading: {
                Text("\(context.state.coins)c")
                    .font(.caption2)
            } compactTrailing: {
                Image(systemName: context.state.pendingItems > 0 ? "fish" : "leaf")
            } minimal: {
                Image(systemName: "fish")
            }
        }
    }
}

@available(iOS 16.1, *)
struct IslandLiveActivityBanner: View {
    let state: IslandActivityAttributes.ContentState

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text("Island Idle")
                    .font(.caption)
                    .fontWeight(.semibold)
                Spacer()
                Text("\(state.coins) coins")
                    .font(.caption)
                    .fontWeight(.bold)
            }
            Text(state.headline)
                .font(.subheadline)
        }
        .foregroundStyle(.white)
    }
}
