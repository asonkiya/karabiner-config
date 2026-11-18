import Foundation
import SQLite3

// The web card (LittleOverlay) is WebKit with a cookie store of its own, so
// on its own it is signed out of everything. Zen, like every Firefox, keeps
// its persistent cookies unencrypted in <profile>/cookies.sqlite; copying
// them into the card each time it opens makes the card signed in wherever
// Zen is. One way, Zen -> card: Zen stays the source of truth.
//
// What does not come across: session-only cookies (Firefox keeps those in its
// session file, not the database), cookies from container tabs
// (originAttributes userContextId) and partitioned third-party cookies.
enum BrowserCookies {
    static let root = FileManager.default.homeDirectoryForCurrentUser
        .appendingPathComponent("Library/Application Support/zen")

    // The profile the installed Zen starts by default: installs.ini's
    // Default=, else the profiles.ini section flagged Default=1.
    static func profile() -> URL? {
        for (file, wantsFlag) in [("installs.ini", false), ("profiles.ini", true)] {
            guard let text = try? String(contentsOf: root.appendingPathComponent(file), encoding: .utf8) else { continue }
            var path: String?
            var flagged = false
            func settled() -> URL? {
                guard let path, flagged || !wantsFlag else { return nil }
                return path.hasPrefix("/") ? URL(fileURLWithPath: path) : root.appendingPathComponent(path)
            }
            for line in text.split(whereSeparator: \.isNewline) {
                if line.hasPrefix("[") {
                    if let url = settled() { return url }
                    path = nil
                    flagged = false
                } else if !wantsFlag, line.hasPrefix("Default=") {
                    path = String(line.dropFirst("Default=".count))
                } else if wantsFlag, line.hasPrefix("Path=") {
                    path = String(line.dropFirst("Path=".count))
                } else if wantsFlag, line == "Default=1" {
                    flagged = true
                }
            }
            if let url = settled() { return url }
        }
        return nil
    }

    // Every unexpired default-container cookie. The database is read from a
    // copy (with its write-ahead log, where the newest cookies live): the
    // running browser holds the original.
    static func load() -> [HTTPCookie] {
        guard let profile = profile() else {
            log("cookies: no Zen profile under \(root.path)")
            return []
        }
        let fm = FileManager.default
        let dir = fm.temporaryDirectory.appendingPathComponent("karabiner-hud-cookies-\(getpid())")
        try? fm.removeItem(at: dir)
        defer { try? fm.removeItem(at: dir) }
        do {
            try fm.createDirectory(at: dir, withIntermediateDirectories: true)
            try fm.copyItem(at: profile.appendingPathComponent("cookies.sqlite"),
                            to: dir.appendingPathComponent("cookies.sqlite"))
        } catch {
            log("cookies: cannot copy the database: \(error.localizedDescription)")
            return []
        }
        try? fm.copyItem(at: profile.appendingPathComponent("cookies.sqlite-wal"),
                         to: dir.appendingPathComponent("cookies.sqlite-wal"))

        var db: OpaquePointer?
        guard sqlite3_open(dir.appendingPathComponent("cookies.sqlite").path, &db) == SQLITE_OK else {
            log("cookies: cannot open the database copy")
            sqlite3_close(db)
            return []
        }
        defer { sqlite3_close(db) }
        var stmt: OpaquePointer?
        let sql = """
            SELECT name, value, host, path, expiry, isSecure, isHttpOnly, sameSite
            FROM moz_cookies WHERE originAttributes = ''
            """
        guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else {
            log("cookies: \(String(cString: sqlite3_errmsg(db)))")
            return []
        }
        defer { sqlite3_finalize(stmt) }

        func text(_ i: Int32) -> String { sqlite3_column_text(stmt, i).map { String(cString: $0) } ?? "" }
        let now = Date()
        var cookies: [HTTPCookie] = []
        while sqlite3_step(stmt) == SQLITE_ROW {
            // Milliseconds since Firefox 138, seconds before.
            let raw = Double(sqlite3_column_int64(stmt, 4))
            let expires = Date(timeIntervalSince1970: raw > 1e11 ? raw / 1000 : raw)
            if expires <= now { continue }
            var p: [HTTPCookiePropertyKey: Any] = [
                .name: text(0), .value: text(1), .domain: text(2), .path: text(3), .expires: expires,
            ]
            if sqlite3_column_int(stmt, 5) != 0 { p[.secure] = "TRUE" }
            if sqlite3_column_int(stmt, 6) != 0 { p[HTTPCookiePropertyKey("HttpOnly")] = "TRUE" }
            switch sqlite3_column_int(stmt, 7) {
            case 1: p[.sameSitePolicy] = "lax"
            case 2: p[.sameSitePolicy] = "strict"
            default: break
            }
            if let c = HTTPCookie(properties: p) { cookies.append(c) }
        }
        return cookies
    }
}
