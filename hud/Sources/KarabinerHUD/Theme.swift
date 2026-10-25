import AppKit

// Every number the wheel is drawn from. Geometry is a fraction of R, the
// outer radius (R = size × min(half-width, half-height) of the screen's
// visible frame); times are milliseconds. See "Visual spec" in
// ../../../Claude outputs/hud-redesign-handoff.md.
enum Theme {
    // Geometry
    static let size: CGFloat = 0.70            // R as a fraction of min(cx, cy)
    static let hub: CGFloat = 0.20             // hub radius / R
    static let ring1: CGFloat = 0.36           // single ring: inner edge / R (outer = R)
    static let ring2: (CGFloat, CGFloat) = (0.28, 0.64) // two rings: inner spans [0]..[1], outer [1]+gap..1
    static let ringGap: CGFloat = 8            // px between the two rings
    static let wedgeGap: CGFloat = 4           // px between neighbouring wedges

    // Colour
    static let ink = NSColor(red: 0.11, green: 0.11, blue: 0.13, alpha: 1)
    static let fillAlpha: CGFloat = 0.84
    static let accent = NSColor(red: 0xF5 / 255, green: 0xB2 / 255, blue: 0x6B / 255, alpha: 1) // #F5B26B
    static let vignetteCenter: CGFloat = 0.40  // backdrop alpha at the wheel centre
    static let vignetteAtR: CGFloat = 0.28     // ... at R
    static let vignetteEnd: CGFloat = 2.1      // ... 0 by this × R

    // Type
    static let keyPt: CGFloat = 24
    static let keyPtWithIcon: CGFloat = 22
    static let keyAlpha: CGFloat = 0.90
    static let labelPt: CGFloat = 13
    static let labelAlpha: CGFloat = 0.62
    static let labelMaxChars = 30
    static let labelLines = 2
    static let hubTitlePt: CGFloat = 20
    static let hubModePt: CGFloat = 12

    // Icons
    static let symbolPt: CGFloat = 40
    static let symbolAlpha: CGFloat = 0.85
    static let appIconPt: CGFloat = 54         // app icons and site favicons
    static let iconLift: CGFloat = 38          // icon centre this far outside mid-radius

    // Lit wedge (the command that just fired)
    static let litLift: CGFloat = 0.14         // white overlay alpha
    static let litEdge: CGFloat = 2            // accent stroke, px
    static let litLabelAlpha: CGFloat = 0.88
    static let litMs = 100

    // Appear
    static let holdMs = 400                    // hold before anything shows
    static let appearMs = 120
    static let appearScale: CGFloat = 0.96

    // Quiet state (after the first command fires)
    static let quietScale: CGFloat = 0.60
    static let quietFillAlpha: CGFloat = 0.70
    static let quietKeyPt: CGFloat = 18
    static let quietKeyAlpha: CGFloat = 0.78
    static let quietMs = 140                   // step-back, ease-out
    static let quietFadeMs = 90                // vignette + hub to 0, linear

    // Experiment: a blurred `.hudWindow` material behind the wheel instead of
    // the flat vignette. Off by default; with it on, drop fillAlpha to ~0.40.
    static let material = false
}
