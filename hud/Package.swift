// swift-tools-version: 6.0
import PackageDescription

// karabiner-hud: the native which-key weapon wheel. A tiny AppKit agent that
// listens for Karabiner's `send_user_command` datagrams and draws the wheel
// with Core Animation. Built and installed as a LaunchAgent by ../setup.sh.
let package = Package(
    name: "karabiner-hud",
    platforms: [.macOS(.v15)],
    dependencies: [
        .package(
            url: "https://github.com/pqrs-org/Karabiner-Elements-user-command-receiver.git",
            from: "1.2.0"
        ),
    ],
    targets: [
        .executableTarget(
            name: "karabiner-hud",
            dependencies: [
                .product(
                    name: "KarabinerElementsUserCommandReceiver",
                    package: "Karabiner-Elements-user-command-receiver"
                ),
            ],
            path: "Sources/KarabinerHUD",
            swiftSettings: [.swiftLanguageMode(.v5)]
        ),
    ]
)
