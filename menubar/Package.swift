// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "StudioBar",
    platforms: [.macOS(.v13)],
    targets: [
        .executableTarget(name: "StudioBar", path: "Sources/StudioBar")
    ]
)
