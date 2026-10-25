import AppKit
import Foundation

// hammerspoon/sublayers.json, as cheatsheet.ts writes it: per runtime mode,
// every Hyper sublayer plus `_top` (the Hyper layer itself).
struct IconSpec: Decodable {
    let symbol: String?   // SF Symbols name
    let app: String?      // app name or path; resolved by Icons
    let bundle: String?   // bundle id
    let url: String?      // a web page; its favicon, fetched and cached by Icons
}

struct Item: Decodable {
    let key: String       // humanized key ("U", "⏎", ";")
    let code: String?     // raw key_code, what `press` names
    let label: String
    let group: Bool?      // a sublayer on the top-level wheel
    let app: [String]?    // frontmost-app bundle-id regexes gating this item
    let icon: IconSpec?
    var isGroup: Bool { group ?? false }
}

struct Menu: Decodable {
    let title: String
    let items: [Item]
}

typealias HudData = [String: [String: Menu]]

enum Model {
    static func load(_ path: String) -> HudData? {
        guard let data = FileManager.default.contents(atPath: path) else {
            log("no data file at \(path)")
            return nil
        }
        do {
            return try JSONDecoder().decode(HudData.self, from: data)
        } catch {
            log("cannot parse \(path): \(error)")
            return nil
        }
    }

    // Same flag files the indicators and Hammerspoon read.
    static func currentMode() -> String {
        for m in ["programming", "reading", "trivia"]
        where FileManager.default.fileExists(atPath: "/tmp/karabiner_mode_\(m)") {
            return m
        }
        return "normal"
    }

    // Items that apply to the frontmost app, first match per key — the same
    // resolution Karabiner does (an app-gated rule shadows a later un-gated
    // one only inside its app).
    static func visible(_ items: [Item]) -> [Item] {
        let bid = NSWorkspace.shared.frontmostApplication?.bundleIdentifier ?? ""
        var out: [Item] = []
        var seen = Set<String>()
        for it in items where !seen.contains(it.key) {
            if let gates = it.app, !gates.contains(where: { matches($0, bid) }) { continue }
            out.append(it)
            seen.insert(it.key)
        }
        return out
    }

    private static func matches(_ pattern: String, _ s: String) -> Bool {
        guard let re = try? NSRegularExpression(pattern: pattern) else { return false }
        return re.firstMatch(in: s, range: NSRange(s.startIndex..., in: s)) != nil
    }

    // ≤10 items fit one ring; beyond that, two. On the top-level map the
    // sublayers (group) take the inner ring and direct commands the outer;
    // otherwise an even split.
    static func rings(_ items: [Item]) -> [[Item]] {
        if items.count <= 10 { return [items] }
        if items.contains(where: { $0.isGroup }) {
            return [items.filter { $0.isGroup }, items.filter { !$0.isGroup }]
        }
        let half = (items.count + 1) / 2
        return [Array(items[..<half]), Array(items[half...])]
    }
}

func log(_ message: String) {
    let f = DateFormatter()
    f.locale = Locale(identifier: "en_US_POSIX")
    f.dateFormat = "HH:mm:ss.SSS"
    FileHandle.standardError.write("\(f.string(from: Date())) \(message)\n".data(using: .utf8)!)
}
