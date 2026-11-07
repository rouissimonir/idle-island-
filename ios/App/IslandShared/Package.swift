// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "IslandShared",
    platforms: [.iOS(.v15)],
    products: [
        .library(name: "IslandShared", targets: ["IslandShared"])
    ],
    targets: [
        .target(
            name: "IslandShared",
            path: "Sources/IslandShared"
        )
    ]
)
