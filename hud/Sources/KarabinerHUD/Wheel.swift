import AppKit

// Layer tree for one wheel: vignette, rings of wedges, hub. Built fresh on
// every show; the controller animates it (appear, step-back, lit) and throws
// it away on hide. Coordinates are AppKit's (y up), with 12 o'clock at +π/2
// and wedges running clockwise. Drawing primitives live in Drawing.swift.

final class WedgeLayer {
    let item: Item
    let root = CALayer()
    let fill = CAShapeLayer()
    let lift = CAShapeLayer()     // white lift + accent edge while lit
    let key: CATextLayer
    let label: CATextLayer
    let icon: CALayer?
    let iconImages: Icon?
    let restKeyColor: CGColor
    let quietKeyColor: CGColor
    let quietKeyScale: CGFloat
    private let scale: CGFloat

    init(item: Item, path: CGPath, at p: CGPoint, textWidth w: CGFloat, scale: CGFloat) {
        self.item = item
        self.scale = scale
        iconImages = item.icon.flatMap(Icons.icon)
        let hasIcon = iconImages != nil

        fill.path = path
        fill.fillColor = rgba(Theme.ink, Theme.fillAlpha)
        fill.contentsScale = scale
        lift.path = path
        lift.fillColor = rgba(.white, Theme.litLift)
        lift.strokeColor = Theme.accent.cgColor
        lift.lineWidth = Theme.litEdge
        lift.opacity = 0
        lift.contentsScale = scale
        root.addSublayer(fill)
        root.addSublayer(lift)

        // Groups (sublayers on the top-level wheel) are marked by an amber letter.
        restKeyColor = item.isGroup ? rgba(Theme.accent, 0.95) : rgba(.white, Theme.keyAlpha)
        quietKeyColor = item.isGroup ? rgba(Theme.accent, Theme.quietKeyAlpha) : rgba(.white, Theme.quietKeyAlpha)
        let keyPt = hasIcon ? Theme.keyPtWithIcon : Theme.keyPt
        quietKeyScale = Theme.quietKeyPt / (keyPt * Theme.quietScale)

        // Layout down the wedge: [icon] / key letter / label (2 lines).
        let keyH = keyPt * 1.3
        let labelH = Theme.labelPt * 1.25 * CGFloat(Theme.labelLines)
        let keyMidY: CGFloat
        let labelTop: CGFloat
        if let img = iconImages {
            let l = CALayer()
            l.contents = img.normal.layerContents(forContentsScale: scale)
            l.contentsScale = scale
            l.contentsGravity = .resizeAspect
            l.frame = CGRect(x: p.x - img.size / 2, y: p.y + Theme.iconLift - img.size / 2, width: img.size, height: img.size)
            root.addSublayer(l)
            icon = l
            keyMidY = p.y - 6
            labelTop = p.y - 22
        } else {
            icon = nil
            keyMidY = p.y + 10
            labelTop = p.y - 6
        }

        key = textLayer(item.key, font: .systemFont(ofSize: keyPt, weight: .bold), color: restKeyColor, scale: scale)
        key.frame = CGRect(x: p.x - w / 2, y: keyMidY - keyH / 2, width: w, height: keyH)
        root.addSublayer(key)

        var text = item.label
        if text.count > Theme.labelMaxChars {
            text = String(text.prefix(Theme.labelMaxChars)) + "…"
        }
        label = textLayer(text, font: .systemFont(ofSize: Theme.labelPt), color: rgba(.white, Theme.labelAlpha), scale: scale, wrapped: true)
        label.frame = CGRect(x: p.x - w / 2, y: labelTop - labelH, width: w, height: labelH)
        root.addSublayer(label)
    }

    // Lit: white lift + amber edge, amber letter and symbol, label to 88%.
    // A cut both ways; the controller animates the first-press fade itself.
    func setLit(_ on: Bool, quiet: Bool) {
        cut {
            lift.opacity = on ? 1 : 0
            key.foregroundColor = on ? Theme.accent.cgColor : (quiet ? quietKeyColor : restKeyColor)
            label.foregroundColor = rgba(.white, on ? Theme.litLabelAlpha : Theme.labelAlpha)
            if let icon, let img = iconImages {
                icon.contents = (on ? img.lit : img.normal).layerContents(forContentsScale: scale)
            }
        }
    }

    // Step back: labels and icons cut, fill and letter ease to the quiet
    // values; a lit wedge eases out of lit over the same span.
    func enterQuiet(ms: Int, wasLit: Bool) {
        cut {
            label.isHidden = true
            icon?.isHidden = true
        }
        if ms == 0 {
            cut {
                fill.fillColor = rgba(Theme.ink, Theme.quietFillAlpha)
                key.foregroundColor = quietKeyColor
                key.transform = scaleTransform(quietKeyScale)
                lift.opacity = 0
            }
            return
        }
        animate(fill, "fillColor", to: rgba(Theme.ink, Theme.quietFillAlpha), ms: ms)
        animate(key, "foregroundColor", from: wasLit ? Theme.accent.cgColor : restKeyColor, to: quietKeyColor, ms: ms)
        animate(key, "transform.scale", from: 1.0, to: quietKeyScale, ms: ms)
        if wasLit { animate(lift, "opacity", from: 1.0, to: 0.0, ms: ms) }
    }
}

final class Wheel {
    let root = CALayer()
    let vignette = CAGradientLayer()
    let hub = CALayer()
    private(set) var wedges: [WedgeLayer] = []
    private(set) var byCode: [String: WedgeLayer] = [:]
    let center: CGPoint
    let R: CGFloat
    let innerRadius: CGFloat
    private var currentScale: CGFloat = 1

    init(title: String, mode: String, items: [Item], center: CGPoint, bounds: CGSize, scale: CGFloat) {
        self.center = center
        R = min(center.x, center.y) * Theme.size

        // Root scales about the wheel centre (anchor there, not at the view centre).
        root.bounds = CGRect(origin: .zero, size: bounds)
        root.anchorPoint = CGPoint(x: center.x / bounds.width, y: center.y / bounds.height)
        root.position = center

        // Backdrop: radial vignette centred on the wheel.
        let vr = R * Theme.vignetteEnd
        vignette.type = .radial
        vignette.colors = [rgba(.black, Theme.vignetteCenter), rgba(.black, Theme.vignetteAtR), rgba(.black, 0)]
        vignette.locations = [0, NSNumber(value: Double(1 / Theme.vignetteEnd)), 1]
        vignette.startPoint = CGPoint(x: 0.5, y: 0.5)
        vignette.endPoint = CGPoint(x: 1, y: 1)
        vignette.frame = CGRect(x: center.x - vr, y: center.y - vr, width: 2 * vr, height: 2 * vr)
        root.addSublayer(vignette)

        // Rings.
        let groups = Model.rings(items)
        if groups.count == 1 {
            innerRadius = R * Theme.ring1
            addRing(groups[0], r0: innerRadius, r1: R, scale: scale)
        } else {
            innerRadius = R * Theme.ring2.0
            addRing(groups[0], r0: innerRadius, r1: R * Theme.ring2.1, scale: scale)
            addRing(groups[1], r0: R * Theme.ring2.1 + Theme.ringGap, r1: R, scale: scale)
        }

        // Hub: title over the mode.
        let rHub = R * Theme.hub
        let disc = CAShapeLayer()
        disc.path = CGPath(ellipseIn: CGRect(x: center.x - rHub, y: center.y - rHub, width: 2 * rHub, height: 2 * rHub), transform: nil)
        disc.fillColor = rgba(Theme.ink, Theme.fillAlpha)
        disc.contentsScale = scale
        hub.addSublayer(disc)
        let t = textLayer(title, font: .systemFont(ofSize: Theme.hubTitlePt, weight: .bold), color: rgba(.white, 0.90), scale: scale)
        t.frame = CGRect(x: center.x - rHub, y: center.y - 2, width: 2 * rHub, height: Theme.hubTitlePt * 1.3)
        hub.addSublayer(t)
        let m = textLayer(mode.prefix(1).uppercased() + mode.dropFirst(), font: .systemFont(ofSize: Theme.hubModePt), color: Theme.accent.cgColor, scale: scale)
        m.frame = CGRect(x: center.x - rHub, y: center.y - 4 - Theme.hubModePt * 1.3, width: 2 * rHub, height: Theme.hubModePt * 1.3)
        hub.addSublayer(m)
        root.addSublayer(hub)
    }

    // One ring of wedges between r0..r1: first wedge centred at 12 o'clock,
    // then clockwise. Text width is the room inside the wedge: the arc when
    // it points up/down, the ring thickness when it points sideways.
    private func addRing(_ items: [Item], r0: CGFloat, r1: CGFloat, scale: CGFloat) {
        let n = CGFloat(items.count)
        let step = 2 * .pi / n
        let rm = (r0 + r1) / 2
        let thick = r1 - r0
        let arc = rm * step - Theme.wedgeGap
        let half = step / 2 - (Theme.wedgeGap / 2) / rm
        for (i, it) in items.enumerated() {
            let a = .pi / 2 - CGFloat(i) * step
            let path = wedgePath(center: center, r0: r0, r1: r1, a1: a - half, a2: a + half)
            let p = CGPoint(x: center.x + rm * cos(a), y: center.y + rm * sin(a))
            let w = min(260, max(90, 0.9 * (abs(sin(a)) * arc + abs(cos(a)) * thick)))
            let wedge = WedgeLayer(item: it, path: path, at: p, textWidth: w, scale: scale)
            root.addSublayer(wedge.root)
            wedges.append(wedge)
            if let code = it.code, byCode[code] == nil { byCode[code] = wedge }
        }
    }

    // Fade and grow in from appearScale × target.
    func appear(targetScale: CGFloat) {
        currentScale = targetScale
        animate(root, "opacity", from: 0.0, to: 1.0, ms: Theme.appearMs)
        animate(root, "transform.scale", from: Theme.appearScale * targetScale, to: targetScale, ms: Theme.appearMs)
    }

    // The quiet state: wheel at quietScale, no vignette or hub, wedges
    // reduced to their key letters. `lit` is the wedge of the press that
    // triggered it; `animated` false draws straight into quiet.
    func enterQuiet(animated: Bool, lit: WedgeLayer?) {
        let ms = animated ? Theme.quietMs : 0
        if animated {
            animate(root, "transform.scale", from: currentScale, to: Theme.quietScale, ms: ms)
            animate(vignette, "opacity", to: 0.0, ms: Theme.quietFadeMs, timing: .linear)
            animate(hub, "opacity", to: 0.0, ms: Theme.quietFadeMs, timing: .linear)
        } else {
            cut {
                root.transform = scaleTransform(Theme.quietScale)
                vignette.opacity = 0
                hub.opacity = 0
            }
        }
        currentScale = Theme.quietScale
        for w in wedges { w.enterQuiet(ms: ms, wasLit: w === lit) }
    }
}
