import AppKit

// The HUD's state machine. Driven by three messages from Karabiner (see
// hudEvent in ../../../utils.ts):
//   {"hud":"show","layer":"s"}   sublayer key / Hyper went down ("_top" = Hyper alone)
//   {"hud":"press","code":"u"}   a command fired
//   {"hud":"hide"}               the key came back up
//
//   hidden --show--> pending --(400 ms)--> full --press--> quiet --hide--> hidden
//                       |                   |                 |
//                       +--press: remember--+-- (a press during the hold means
//                                               the wheel appears already quiet)
//
// All calls happen on the main thread.
final class HUDController {
    enum State { case hidden, pending, full, quiet }

    private(set) var state: State = .hidden
    private let window = HUDWindow()
    private let dataPath: String
    private var wheel: Wheel?
    private var lit: WedgeLayer?        // wedge currently lit in quiet
    private var hold: DispatchWorkItem?
    private var flash: DispatchWorkItem?
    private var pendingQuiet = false    // a press arrived during the hold
    private var hidePending = false     // hide arrived mid-flash

    init(dataPath: String) {
        self.dataPath = dataPath
    }

    func handle(_ json: Any) {
        guard let d = json as? [String: Any], let cmd = d["hud"] as? String else {
            log("ignored payload: \(json)")
            return
        }
        switch cmd {
        case "show":
            if let layer = d["layer"] as? String { show(layer) }
        case "press":
            if let code = d["code"] as? String { press(code) }
        case "hide":
            hide()
        default:
            log("unknown hud command \(cmd)")
        }
    }

    // Sublayer / Hyper press. A wheel already up switches instantly;
    // otherwise nothing shows until the key has been held for holdMs.
    func show(_ layer: String) {
        cancel(&hold)
        cancel(&flash)
        hidePending = false
        lit = nil
        if state == .full || state == .quiet {
            draw(layer, quiet: false, appear: false)
            return
        }
        clear()
        state = .pending
        pendingQuiet = false
        hold = after(Theme.holdMs) { [self] in
            hold = nil
            draw(layer, quiet: pendingQuiet, appear: true)
        }
    }

    // A command fired. On a full wheel this is the first press: light the
    // wedge and step back. In quiet, a short lit flash. During the hold,
    // remember it so the wheel appears already quiet.
    func press(_ code: String) {
        switch state {
        case .hidden:
            break
        case .pending:
            pendingQuiet = true
        case .full:
            guard let wheel else { return }
            let w = wheel.byCode[code]
            w?.setLit(true, quiet: false)
            state = .quiet
            wheel.enterQuiet(animated: true, lit: w)
        case .quiet:
            guard let wheel, let w = wheel.byCode[code] else { return }
            cancel(&flash)
            lit?.setLit(false, quiet: true)
            w.setLit(true, quiet: true)
            lit = w
            flash = after(Theme.litMs) { [self] in
                flash = nil
                w.setLit(false, quiet: true)
                lit = nil
                if hidePending { hideNow() }
            }
        }
    }

    // Key released: everything goes, except that a running lit flash gets
    // to finish first (a running step-back does not).
    func hide() {
        if flash != nil {
            hidePending = true
            return
        }
        hideNow()
    }

    private func hideNow() {
        cancel(&hold)
        cancel(&flash)
        clear()
        state = .hidden
    }

    private func draw(_ layer: String, quiet: Bool, appear: Bool) {
        guard let data = Model.load(dataPath) else { hideNow(); return }
        let mode = Model.currentMode()
        guard let menu = data[mode]?[layer] else {
            log("no menu \(mode)/\(layer)")
            hideNow()
            return
        }
        let items = Model.visible(menu.items)
        guard !items.isEmpty else { hideNow(); return }

        let screen = screenUnderMouse()
        let center = window.cover(screen)
        log("draw \(layer): screen \(screen.frame) visible \(screen.visibleFrame) center \(center) window \(window.frame) host \(window.host.frame)")
        cut { self.wheel?.root.removeFromSuperlayer() }   // a cut: no implicit fade-out
        let wheel = Wheel(title: menu.title, mode: mode, items: items, center: center,
                          bounds: window.host.bounds.size, scale: screen.backingScaleFactor)
        window.host.layer!.addSublayer(wheel.root)
        window.setMaterialMask(center: center, inner: wheel.innerRadius, outer: wheel.R)
        self.wheel = wheel
        lit = nil
        window.orderFrontRegardless()
        if quiet {
            wheel.enterQuiet(animated: false, lit: nil)
            window.effect?.alphaValue = 0
        }
        if appear { wheel.appear(targetScale: quiet ? Theme.quietScale : 1) }
        state = quiet ? .quiet : .full
    }

    private func clear() {
        cut { wheel?.root.removeFromSuperlayer() }
        wheel = nil
        lit = nil
        hidePending = false
        pendingQuiet = false
        window.orderOut(nil)
    }

    private func screenUnderMouse() -> NSScreen {
        let mouse = NSEvent.mouseLocation
        return NSScreen.screens.first { NSMouseInRect(mouse, $0.frame, false) }
            ?? NSScreen.main
            ?? NSScreen.screens[0]
    }

    private func after(_ ms: Int, _ body: @escaping () -> Void) -> DispatchWorkItem {
        let item = DispatchWorkItem(block: body)
        DispatchQueue.main.asyncAfter(deadline: .now() + .milliseconds(ms), execute: item)
        return item
    }

    private func cancel(_ item: inout DispatchWorkItem?) {
        item?.cancel()
        item = nil
    }
}
