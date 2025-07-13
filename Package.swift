// swift-tools-version:5.3
import PackageDescription

let package = Package(
    name: "TreeSitterCSharp",
    products: [
        .library(name: "TreeSitterCSharp", targets: ["TreeSitterCSharp"]),
    ],
    dependencies: [
        .package(name: "SwiftTreeSitter", url: "https://github.com/tree-sitter/swift-tree-sitter", from: "0.8.0"),
    ],
    targets: [
        .target(
            name: "TreeSitterCSharp",
            dependencies: [],
            path: ".",
            sources: [
                "src/parser.c",
                "src/scanner.c",
            ],
            resources: [
                .copy("queries")
            ],
            publicHeadersPath: "bindings/swift",
            cSettings: [.headerSearchPath("src")]
        ),
        .testTarget(
            name: "TreeSitterCSharpTests",
            dependencies: [
                "SwiftTreeSitter",
                "TreeSitterCSharp",
            ],
            path: "bindings/swift/TreeSitterCSharpTests"
        )
    ],
    cLanguageStandard: .c11
)
