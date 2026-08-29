// swift-tools-version: 6.0

import PackageDescription

let package = Package(
    name: "NitroGeolocationSPM",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "NitroGeolocationSPM",
            targets: ["NitroGeolocationSPMLinker"]
        ),
    ],
    targets: [
        .binaryTarget(
            name: "NitroModulesBinary",
            path: "prebuilds/spm/NitroModules.xcframework"
        ),
        .binaryTarget(
            name: "NitroGeolocationBinary",
            path: "prebuilds/spm/NitroGeolocation.xcframework"
        ),
        .target(
            name: "NitroGeolocationSPMLinker",
            dependencies: [
                "NitroModulesBinary",
                "NitroGeolocationBinary",
            ],
            path: "spm/Sources/NitroGeolocationSPMLinker",
            linkerSettings: [
                .unsafeFlags(["-ObjC"]),
            ]
        ),
    ]
)
