import AppKit

// A wedge icon, ready for a CALayer: the normal rendering plus the lit
// (accent-tinted) one for symbols. App icons are the same image both ways.
struct Icon {
    let normal: NSImage
    let lit: NSImage
    let size: CGFloat
}

enum Icons {
    private static var appCache: [String: NSImage?] = [:]
    private static var symbolCache: [String: Icon?] = [:]

    static let appDirs = [
        "/Applications",
        "/System/Applications",
        "/System/Applications/Utilities",   // Screenshot
        NSHomeDirectory() + "/Applications",
        "/System/Library/CoreServices",     // Finder
        "/System/Library/CoreServices/Applications",
    ]

    static func icon(for spec: IconSpec) -> Icon? {
        if let name = spec.symbol { return symbol(name) }
        if let url = spec.url { return favicon(url) ?? symbol("globe") }
        if let app = spec.app, let img = appIcon(app) {
            return Icon(normal: img, lit: img, size: Theme.appIconPt)
        }
        if let id = spec.bundle,
           let url = NSWorkspace.shared.urlForApplication(withBundleIdentifier: id),
           let img = appIcon(url.path) {
            return Icon(normal: img, lit: img, size: Theme.appIconPt)
        }
        return nil
    }

    private static func symbol(_ name: String) -> Icon? {
        if let cached = symbolCache[name] { return cached }
        var result: Icon? = nil
        if let base = NSImage(systemSymbolName: name, accessibilityDescription: nil)?
            .withSymbolConfiguration(.init(pointSize: Theme.symbolPt, weight: .regular)) {
            result = Icon(
                normal: tinted(base, NSColor.white.withAlphaComponent(Theme.symbolAlpha)),
                lit: tinted(base, Theme.accent),
                size: Theme.symbolPt
            )
        } else {
            log("unknown SF Symbol \(name)")
        }
        symbolCache[name] = result
        return result
    }

    // `app` is what the source said: an absolute path (".app" optional), or
    // a bare name searched through appDirs. Cached per string for the
    // process lifetime; a missing app just means no icon.
    private static func appIcon(_ app: String) -> NSImage? {
        if let cached = appCache[app] { return cached }
        var result: NSImage? = nil
        if let path = resolve(app) {
            let img = NSWorkspace.shared.icon(forFile: path)
            img.size = NSSize(width: Theme.appIconPt, height: Theme.appIconPt)
            result = img
        } else {
            log("no app found for \(app)")
        }
        appCache[app] = result
        return result
    }

    private static func resolve(_ app: String) -> String? {
        let fm = FileManager.default
        if app.hasPrefix("/") {
            let p = app.hasSuffix(".app") ? app : app + ".app"
            return fm.fileExists(atPath: p) ? p : nil
        }
        for dir in appDirs {
            let p = "\(dir)/\(app).app"
            if fm.fileExists(atPath: p) { return p }
        }
        return nil
    }

    // Site icons: Google's favicon service, cached as PNG under
    // ~/Library/Caches/karabiner-hud/favicons/<host>.png. The first show of
    // a site falls back to the globe while the fetch runs; the next one has
    // the real icon. One fetch per host per process; failures just stay globe.
    private static let faviconDir = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
        .appendingPathComponent("karabiner-hud/favicons", isDirectory: true)
    private static var faviconCache: [String: NSImage] = [:]
    private static var faviconFetching = Set<String>()

    private static func favicon(_ urlString: String) -> Icon? {
        guard let host = URL(string: urlString)?.host, host != "localhost", !host.hasPrefix("127.") else { return nil }
        if let img = faviconCache[host] { return Icon(normal: img, lit: img, size: Theme.appIconPt) }
        let file = faviconDir.appendingPathComponent(host + ".png")
        if let img = NSImage(contentsOf: file) {
            img.size = NSSize(width: Theme.appIconPt, height: Theme.appIconPt)
            faviconCache[host] = img
            return Icon(normal: img, lit: img, size: Theme.appIconPt)
        }
        fetchFavicon(host: host, to: file)
        return nil
    }

    private static func fetchFavicon(host: String, to file: URL) {
        guard !faviconFetching.contains(host) else { return }
        faviconFetching.insert(host)
        guard let src = URL(string: "https://www.google.com/s2/favicons?sz=128&domain=\(host)") else { return }
        URLSession.shared.dataTask(with: src) { data, response, error in
            guard let data, (response as? HTTPURLResponse)?.statusCode == 200,
                  let img = NSImage(data: data), img.size.width >= 32 else {
                log("favicon for \(host): \(error.map { "\($0)" } ?? "no usable image")")
                return
            }
            do {
                try FileManager.default.createDirectory(at: faviconDir, withIntermediateDirectories: true)
                try data.write(to: file)
                log("favicon cached for \(host)")
            } catch {
                log("favicon cache write failed for \(host): \(error)")
            }
        }.resume()
    }

    // Resolution-independent tint: the drawing handler re-runs at whatever
    // scale the layer asks for.
    private static func tinted(_ image: NSImage, _ color: NSColor) -> NSImage {
        let size = image.size
        return NSImage(size: size, flipped: false) { rect in
            image.draw(in: rect)
            color.set()
            rect.fill(using: .sourceAtop)
            return true
        }
    }
}
