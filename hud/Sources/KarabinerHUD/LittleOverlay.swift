import AppKit
import WebKit

// The "little" overlay: a small floating web card, Arc's Little Arc. A page
// opens in a panel over whatever is in front — a native full-screen app
// included, which no browser window can do (a browser's own windows either
// join the full-screen Space or drag you off it). The panel takes the
// keyboard without activating this agent, so closing it hands focus straight
// back to the app underneath.
//
//   {"little": {"open": "<url>"}}   show the card on that page; sent again for
//                                   the page it is showing while it has focus,
//                                   close it (a toggle)
//   {"little": "close"}             close it
//   {"little": "promote"}           open its page in the default browser, close
//
// Keys while the card has focus:
//   ⌘W         close (so Hyper+D works)
//   ⌘O         promote: open the current page in the default browser, close
//   ⌘R         reload          ⌘[ ⌘]   back / forward
//   ⇧⌘C        copy the page's address
//   ⌘C ⌘V ⌘X ⌘A ⌘Z ⇧⌘Z  the usual, forwarded by hand (an agent has no menu)
//
// The card is WebKit with its own persistent cookie store. Each time it opens
// it first copies the browser's cookies in (BrowserCookies), so it is signed
// in wherever the browser is; a sign-in made in the card stays in the card.
enum Little {
    static let width: CGFloat = 0.55  // fraction of the screen's visible frame
    static let height: CGFloat = 0.75
    // Safari's, so sites (Google sign-in above all) treat the card as a browser.
    static let userAgent =
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15"
}

final class LittlePanel: NSPanel {
    var onKey: ((NSEvent) -> Bool)?

    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { false }

    override func performKeyEquivalent(with event: NSEvent) -> Bool {
        if onKey?(event) == true { return true }
        return super.performKeyEquivalent(with: event)
    }
}

final class LittleOverlay: NSObject, Overlay, NSWindowDelegate, WKUIDelegate, WKNavigationDelegate {
    private var panel: LittlePanel?
    private var web: WKWebView?
    private var titleWatch: NSKeyValueObservation?
    private var requested: URL? // what `open` last asked for; the page may redirect

    func handle(command: Any, message: [String: Any]) {
        if let c = command as? [String: Any], let s = c["open"] as? String, let url = URL(string: s) {
            open(url)
        } else if command as? String == "close" {
            close()
        } else if command as? String == "promote" {
            promote()
        } else {
            log("little: bad command \(command)")
        }
    }

    private func open(_ url: URL) {
        if let panel, let web {
            // Already up: the same page toggles (closes when focused, else
            // takes focus back), another page replaces it.
            if requested == url {
                if panel.isKeyWindow { return close() }
            } else {
                requested = url
                web.load(URLRequest(url: url))
            }
            panel.orderFrontRegardless()
            panel.makeKey()
            return
        }
        // A fresh panel per card: one reused across Spaces can stay bound to
        // the Space it was last shown on (see HUDWindow).
        let mouse = NSEvent.mouseLocation
        let screen = NSScreen.screens.first { $0.frame.contains(mouse) } ?? NSScreen.main ?? NSScreen.screens[0]
        let v = screen.visibleFrame
        let size = CGSize(width: v.width * Little.width, height: v.height * Little.height)
        let frame = CGRect(x: v.midX - size.width / 2, y: v.midY - size.height / 2,
                           width: size.width, height: size.height)

        let p = LittlePanel(
            contentRect: frame,
            styleMask: [.titled, .closable, .resizable, .nonactivatingPanel],
            backing: .buffered,
            defer: false
        )
        p.isFloatingPanel = true
        p.level = .floating
        p.hidesOnDeactivate = false
        p.isReleasedWhenClosed = false
        p.becomesKeyOnlyIfNeeded = false
        p.animationBehavior = .utilityWindow
        p.collectionBehavior = [.moveToActiveSpace, .fullScreenAuxiliary, .ignoresCycle]
        p.title = url.host ?? ""
        p.delegate = self
        p.onKey = { [weak self] e in self?.key(e) ?? false }

        let config = WKWebViewConfiguration()
        config.preferences.isElementFullscreenEnabled = true
        let w = WKWebView(frame: CGRect(origin: .zero, size: frame.size), configuration: config)
        w.customUserAgent = Little.userAgent
        w.allowsBackForwardNavigationGestures = true
        w.autoresizingMask = [.width, .height]
        w.uiDelegate = self
        w.navigationDelegate = self
        titleWatch = w.observe(\.title) { [weak p] w, _ in
            p?.title = w.title.flatMap { $0.isEmpty ? nil : $0 } ?? w.url?.host ?? ""
        }
        p.contentView = w

        panel = p
        web = w
        requested = url
        p.setFrame(frame, display: true)
        // The page waits for the browser's cookies; the panel does not.
        let started = Date()
        let cookies = BrowserCookies.load()
        let store = config.websiteDataStore.httpCookieStore
        let group = DispatchGroup()
        for c in cookies {
            group.enter()
            store.setCookie(c) { group.leave() }
        }
        group.notify(queue: .main) { [weak self, weak w] in
            log("little: \(cookies.count) cookies in \(Int(Date().timeIntervalSince(started) * 1000)) ms")
            // Closed or pointed elsewhere while the cookies went in.
            guard let self, let w, self.web === w, let target = self.requested else { return }
            w.load(URLRequest(url: target))
        }
        p.orderFrontRegardless()
        p.makeKey()
        p.makeFirstResponder(w)
        log("little: open \(url.absoluteString)")
    }

    // Tear the page down with the panel, so nothing keeps playing unseen.
    private func close() {
        guard let p = panel else { return }
        titleWatch = nil
        web?.stopLoading()
        web?.removeFromSuperview()
        web = nil
        panel = nil
        requested = nil
        p.delegate = nil
        p.orderOut(nil)
        log("little: close")
    }

    func windowWillClose(_ notification: Notification) { close() } // the red button

    private func promote() {
        if let url = web?.url { NSWorkspace.shared.open(url) }
        close()
    }

    private func key(_ e: NSEvent) -> Bool {
        let mods = e.modifierFlags.intersection([.command, .shift, .option, .control])
        guard mods.contains(.command), !mods.contains(.option), !mods.contains(.control),
              let ch = e.charactersIgnoringModifiers?.lowercased() else { return false }
        let shift = mods.contains(.shift)
        switch (ch, shift) {
        case ("w", false): close()
        case ("o", false): promote()
        case ("r", false): web?.reload()
        case ("[", false): web?.goBack()
        case ("]", false): web?.goForward()
        case ("c", true):
            if let url = web?.url {
                NSPasteboard.general.clearContents()
                NSPasteboard.general.setString(url.absoluteString, forType: .string)
            }
        case ("c", false): edit(#selector(NSText.copy(_:)))
        case ("v", false): edit(#selector(NSText.paste(_:)))
        case ("x", false): edit(#selector(NSText.cut(_:)))
        case ("a", false): edit(#selector(NSText.selectAll(_:)))
        case ("z", false): edit(Selector(("undo:")))
        case ("z", true): edit(Selector(("redo:")))
        default: return false
        }
        return true
    }

    private func edit(_ action: Selector) {
        NSApp.sendAction(action, to: nil, from: panel)
    }

    // target=_blank and window.open: stay in the card.
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if navigationAction.targetFrame == nil { webView.load(navigationAction.request) }
        return nil
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        log("little: \(error.localizedDescription)")
    }
}
