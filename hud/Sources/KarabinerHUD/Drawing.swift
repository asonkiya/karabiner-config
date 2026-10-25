import AppKit

// Core Animation primitives shared by every overlay: cuts vs. explicit
// animations, colours, text layers, annular-sector paths.

// Run `body` with implicit animations off (a cut, not a fade).
func cut(_ body: () -> Void) {
    CATransaction.begin()
    CATransaction.setDisableActions(true)
    body()
    CATransaction.commit()
}

// Explicit animation of one property, model value set to `to` underneath.
func animate(_ layer: CALayer, _ keyPath: String, from: Any? = nil, to: Any, ms: Int,
             timing: CAMediaTimingFunctionName = .easeOut) {
    let a = CABasicAnimation(keyPath: keyPath)
    a.fromValue = from ?? layer.presentation()?.value(forKeyPath: keyPath) ?? layer.value(forKeyPath: keyPath)
    a.toValue = to
    a.duration = Double(ms) / 1000
    a.timingFunction = CAMediaTimingFunction(name: timing)
    cut { layer.setValue(to, forKeyPath: keyPath) }
    layer.add(a, forKey: keyPath)
}

func scaleTransform(_ s: CGFloat) -> CATransform3D { CATransform3DMakeScale(s, s, 1) }

func rgba(_ c: NSColor, _ alpha: CGFloat) -> CGColor { c.withAlphaComponent(alpha).cgColor }

// Annular sector between radii r0..r1 from angle a1 to a2 (radians, y up).
func wedgePath(center c: CGPoint, r0: CGFloat, r1: CGFloat, a1: CGFloat, a2: CGFloat) -> CGPath {
    let p = CGMutablePath()
    p.addArc(center: c, radius: r1, startAngle: a1, endAngle: a2, clockwise: false)
    p.addArc(center: c, radius: r0, startAngle: a2, endAngle: a1, clockwise: true)
    p.closeSubpath()
    return p
}

func textLayer(_ text: String, font: NSFont, color: CGColor, scale: CGFloat, wrapped: Bool = false) -> CATextLayer {
    let t = CATextLayer()
    t.string = text
    t.font = font
    t.fontSize = font.pointSize
    t.foregroundColor = color
    t.alignmentMode = .center
    t.isWrapped = wrapped
    t.truncationMode = .end
    t.contentsScale = scale
    return t
}

