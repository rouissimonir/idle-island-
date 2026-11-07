import SwiftUI
import WidgetKit

@main
struct IslandActivitiesBundle: WidgetBundle {
    var body: some Widget {
        IslandHomeWidget()
        if #available(iOS 16.1, *) {
            IslandLiveActivityWidget()
        }
    }
}
