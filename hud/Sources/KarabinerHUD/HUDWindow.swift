import AppKit

// A full-screen, click-through, non-activating panel that hosts the wheel's
// layer tree. One instance, moved to the mouse's screen on every show.
final class HUDWindow: NSPanel {
    let host = HostView()
    private(set) var effect: NSVisualEffectView?

    init() {
        super.init(
            contentRect: .zero,
            styleMask: [.borderless, .nonactivatingPanel],
            backing: .buffered,
            defer: false
        )
        isOpaque = false
        backgroundColor = .clear
        hasShadow = false
        ignoresMouseEvents = true
        isFloatingPanel = true
        hidesOnDeactivate = false
        isReleasedWhenClosed = false
        animationBehavior = .none
        // screenSaver level: the overlay level (102) is enough on the desktop
        // but a native full-screen space never shows the panel there.
        level = .screenSaver
        collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .stationary, .ignoresCycle]

        let container = NSView()
        container.autoresizesSubviews = true
        if Theme.material {
            let v = NSVisualEffectView()
            v.material = .hudWindow
            v.blendingMode = .behindWindow
            v.state = .active
            v.autoresizingMask = [.width, .height]
            container.addSubview(v)
            effect = v
        }
        host.autoresizingMask = [.width, .height]
        container.addSubview(host)
        contentView = container
    }

    // Cover `screen`; returns the wheel centre (centre of the visible frame,
    // so the dock/menu bar don't push the wheel off-centre) in host coords.
    func cover(_ screen: NSScreen) -> CGPoint {
        let f = screen.frame
        setFrame(f, display: false)
        host.frame = CGRect(origin: .zero, size: f.size)
        effect?.frame = host.frame
        let v = screen.visibleFrame
        return CGPoint(x: v.midX - f.minX, y: v.midY - f.minY)
    }

    // Blur only behind the ring (Theme.material experiment).
    func setMaterialMask(center: CGPoint, inner: CGFloat, outer: CGFloat) {
        guard let effect else { return }
        let size = host.bounds.size
        let mask = NSImage(size: size, flipped: false) { _ in
            let p = NSBezierPath()
            p.appendArc(withCenter: center, radius: outer, startAngle: 0, endAngle: 360)
            p.appendArc(withCenter: center, radius: inner, startAngle: 360, endAngle: 0, clockwise: true)
            p.windingRule = .evenOdd
            NSColor.black.set()
            p.fill()
            return true
        }
        effect.maskImage = mask
        effect.alphaValue = 1
    }
}

// Layer-hosting view: we own the layer tree, AppKit stays out of it.
final class HostView: NSView {
    init() {
        super.init(frame: .zero)
        layer = CALayer()
        wantsLayer = true
        layerContentsRedrawPolicy = .never
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError() }
}
