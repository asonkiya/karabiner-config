# Which-key HUD redesign — Claude Code handoff

Oct 25, 2026 · design done on a canvas with Aryaman; this file carries every number you need.

## Goal

Rework the Hyper weapon-wheel HUD in four ways, in this order:

1. **Icons** — SF Symbols and app icons in the wedges, generated into `hammerspoon/sublayers.json` at build time.
2. **Native renderer** — move the wheel out of Hammerspoon into a small Swift agent app that draws it with AppKit / Core Animation.
3. **Calm look** — a softer, lower-glare visual system (tokens below).
4. **Quiet state** — after the first command fires on a wheel, the wheel steps back until the sublayer key is released.

Hammerspoon keeps everything else it does today: zoom, mode auto-switching, floating-window centering.

## Read first

- `CLAUDE.md` — architecture, generated-file rules. `yarn watch` is always running; don't run `yarn build` by hand, and never hand-edit `CHEATSHEET.md` or `hammerspoon/sublayers.json`.
- `memory/feedback_yarn_watch.md`
- `utils.ts` — `hsEvent` (~L40), `withHudPress` (~L78), the sublayer toggle's `hudShow` / `hudHide` pings (~L116–133), the `hud?: false` opt-out (~L63).
- `cheatsheet.ts` — the HUD data emitter (~L298–512) and the line that skips `hammerspoon://hud` pings when humanizing (~L153).
- `hammerspoon/init.lua` — the HUD block (from ~L170): `HUD_*` constants, `rings()`, `wedge()`, `wedgeText()`, `drawRing()`, `visibleItems`, `hudShow` / `hudPress` / `hudHide`. Port its behaviour faithfully; it is the reference implementation.
- `profiles/normal.ts` — the actual layers (System `s`, Open apps `o`, etc.).
- `setup.sh` — already installs a login LaunchAgent (`com.karabiner-config.build`); follow the same pattern for the HUD app.

## Working rules

- Don't commit or push unless Aryaman asks.
- Don't delete the Hammerspoon HUD block. Leave it in place, switchable, until he has used the native one for a while and says to remove it.
- Ask before adding dependencies beyond the Karabiner receiver package named below.
- Check the "Verify before building on it" list first; stop and report if any of it fails.

---

## Phase 1 — icon data (renderer-agnostic)

Add an optional `icon` to every HUD item in `sublayers.json`:

```json
{ "key": "I", "code": "i", "label": "Vol +", "icon": { "symbol": "speaker.wave.3.fill" } }
{ "key": "G", "code": "g", "label": "Arc",   "icon": { "app": "/Applications/Arc" } }
```

Resolution, first match wins:

1. **Explicit** `icon` on a `LayerCommand` (new optional field in `utils.ts` types), and on a `HyperKeySublayer` (next to `hud?: false`) so group wedges on the top-level wheel get one.
2. **Known key_code / shortcut → symbol**, a table in `cheatsheet.ts` (below).
3. **Opens an app** → `{ "app": <name or path> }`. Detect `open -a '<X>.app'` (from `app()`), `open -a` inside `appAndSwitchMode`, and `open /path/To.app`. Pass what the source says (e.g. `Discord`, `/Applications/Arc`, `/Applications/WhatsApp.localized/WhatsApp.app`); the renderer resolves it. `raycast://…` URLs → `{ "app": "com.raycast.macos", "bundle": true }` (or a separate `bundleId` key — your call, keep it simple).
4. **Opens a web URL** (`open https://…`, bare domains in the Lookup layer) → `{ "symbol": "globe" }`.
5. Otherwise no `icon` (e.g. Cmd passthrough).

When an item gets an app icon, drop the leading `Open ` from its label ("Open Arc" → "Arc"; "Open iTerm & switch to programming mode" → "iTerm · Programming" or similar). Labels stay as-is otherwise.

Symbol table (names are SF Symbols; check each exists, see Verify):

| Command | Symbol |
|---|---|
| volume_increment / volume_decrement | `speaker.wave.3.fill` / `speaker.wave.1.fill` |
| mute | `speaker.slash.fill` |
| display_brightness_increment / _decrement | `sun.max.fill` / `sun.min.fill` |
| play_or_pause | `playpause.fill` |
| mission_control | `rectangle.3.group` |
| ⌘C / ⌘V / ⌘Z / ⌘F | `doc.on.doc` / `doc.on.clipboard` / `arrow.uturn.backward` / `magnifyingglass` |
| ⌘W / ⌘Q / ⌘T | `xmark` / `xmark.square` / `plus.square.on.square` |

Explicit icons to add in `profiles/normal.ts`:

| Binding | Symbol |
|---|---|
| `s.c` open camera | `video.fill` |
| `s.h` AirPods noise control | `airpodspro` |
| `s.v` ⌥Space (voice) | `mic.fill` |
| Hyper `=` / `-` zoom | `plus.magnifyingglass` / `minus.magnifyingglass` |
| Hyper `E` / `I` / `T` | `square.and.pencil` / `lightbulb` / `checklist` |
| Groups: O / L / W / S / A / C / M | `square.grid.2x2` / `globe` / `macwindow` / `slider.horizontal.3` / `sparkles` / `command` / `switch.2` |
| Group R (Raycast) | Raycast app icon |

Also: the comment above `s.c` in `normal.ts` says "Do not disturb toggle" but the binding opens the camera. Fix the comment.

**Done when:** `sublayers.json` regenerates with `icon` on every item above, `CHEATSHEET.md` is unchanged apart from the cleaned-up "Open" labels (if the cheatsheet shares those labels — your call whether to keep the cheatsheet's original wording), and the Hammerspoon HUD still works (it ignores the new field).

---

## Phase 2 — native HUD app

A Swift Package executable in a new `hud/` folder. AppKit, no Dock icon (`NSApp.setActivationPolicy(.accessory)`), no menu bar item. Its only job is drawing the wheel.

### Input

Karabiner's `send_user_command` sends a JSON payload over a UNIX datagram socket. Use Karabiner's Swift package **Karabiner-Elements-user-command-receiver** (pqrs), or a plain datagram socket if the package is awkward. Default socket path per Karabiner's docs: `/Library/Application Support/org.pqrs/tmp/user/{UID}/user_command_receiver.sock`. A custom `endpoint` is allowed if the default is contended.

Payloads (replace today's URL query params one-for-one):

```json
{ "hud": "show",  "layer": "s" }      // "_top" for Caps Lock alone
{ "hud": "press", "code":  "u" }
{ "hud": "hide" }
```

### Data

- Read `hammerspoon/sublayers.json` on every show, as today (path via the repo location `setup.sh` already personalises; don't hardcode `/Users/aryaman`).
- Mode: same `/tmp/karabiner_mode_*` flag files Hammerspoon reads.
- App-gated items (`app` = bundle-id regexes): filter against `NSWorkspace.shared.frontmostApplication?.bundleIdentifier`, first match per key, same as `visibleItems`.
- Rings: port `rings()` exactly. ≤10 items → one ring; more → two. Top-level: `group` items inner, others outer. Otherwise `ceil(n/2)` inner.

### Window

- Borderless, non-activating `NSPanel`; `ignoresMouseEvents = true`; clear background; never takes focus.
- Level above normal windows and full-screen apps; `collectionBehavior` includes `.canJoinAllSpaces`, `.fullScreenAuxiliary`, `.stationary`, `.ignoresCycle`.
- On the screen under the mouse (`NSEvent.mouseLocation`), covering that screen.

### Drawing

- One `CAShapeLayer` per wedge, using the same annular-sector math as `wedge()` in `init.lua`.
- Text: key letter and label in system font (regular / bold).
- Symbols: `NSImage(systemSymbolName:accessibilityDescription:)` with a symbol configuration (28 pt), tinted.
- App icons: resolve the `app` string. Absolute path → add `.app` if missing. Bare name → search `/Applications`, `/System/Applications`, `/System/Applications/Utilities` (Screenshot lives there), `~/Applications`. Bundle id → `NSWorkspace.shared.urlForApplication(withBundleIdentifier:)`. Then `NSWorkspace.shared.icon(forFile:)`. Cache per path for the process lifetime. Missing app → no icon, no crash.
- Backdrop: build the Calm tokens below first, flat, so the result matches the mocks. Then add an optional `NSVisualEffectView` (`.hudWindow` material, `.behindWindow` blending) masked to the wheel shape behind the wedges, behind a constant (`HUD_MATERIAL = false` by default), so Aryaman can compare. With the material on, wedge fill alpha probably drops to ~40% and the vignette may go.

### Animation

Core Animation, not timers. For the quiet step-back, scale a root layer about the wheel centre. Text inside scales with it, so counter-scale the key-letter layers to land on the quiet letter size (e.g. 24 pt → 18 pt under a 0.6 parent = letter layer scale 1.25). Or animate paths and positions directly; your choice, as long as it hits the numbers below.

---

## Phase 3 — switch Karabiner to the native app

- In `utils.ts`, introduce one `hudEvent(params)` used by the sublayer toggle and `withHudPress`. It emits `{ send_user_command: { payload: {...} } }`. Keep `hsEvent` itself — zoom etc. still use it.
- **Keep the press ping first in `to`**: Karabiner only auto-repeats the last event.
- Make the switch a single constant (e.g. `HUD_RENDERER: "native" | "hammerspoon"`), so falling back is a one-line change.
- `cheatsheet.ts` ~L153 skips `hammerspoon://hud` pings when humanizing; skip the new `send_user_command` HUD pings too, or every command's description gains plumbing.
- Update `CLAUDE.md` and `AGENTS.md` (both describe the HUD path) and the README's HUD bullet.

## Phase 4 — install

- `setup.sh`: build `hud/` (`swift build -c release`) and install a LaunchAgent (e.g. `com.karabiner-config.hud`, `KeepAlive` true, `RunAtLoad` true), following the existing build-agent pattern, with backups and idempotence.
- No special permissions should be needed just to draw a panel. If something prompts for Accessibility or Screen Recording, stop and report.

---

## Visual spec

R = outer radius = `HUD_SIZE × min(screen half-width, half-height)`. All px are points, at R ≈ 420 on a 1440-tall display.

### Calm tokens (full wheel)

| Element | Today | Calm |
|---|---|---|
| Size | `HUD_SIZE` 0.84 | **0.70**. The full wheel's bottom edge clears Apple's volume/brightness bezel |
| Backdrop | Black 35%, whole screen | Radial vignette centred on the wheel: black 40% at the centre, 28% at ~R, 0 by ~2.1 R |
| Single ring | 0.36 R – R, 7 px gap | 0.36 R – R, **4 px** gap |
| Two rings | Inner 0.28–0.64 R, outer +8 px to R | Same radii, 8 px ring gap, 4 px wedge gap |
| Wedge, command | Grey 12% at 86%, 1 px white 22% edge | Ink (0.11, 0.11, 0.13) at **84%**, **no edge** |
| Wedge, group | Warm (0.30, 0.22, 0.14) at 88% | Same ink as commands; group is marked by an amber key letter |
| Key letter | 28 pt bold, #FF9E33 | **24 pt** bold, white 90% (amber #F5B26B on groups). **22 pt** when the wedge has an icon |
| Label | 14 pt, white 92%, cut at 30 chars | **13 pt**, white **62%**; wraps to 2 lines, then the 30-char cut |
| Icon (symbol) | — | 28 pt, white 85%, centred ~26 pt above mid-radius; letter and label stack below it |
| Icon (app) | — | 36 pt, full colour, same position |
| Accent | #FF9E33 | **#F5B26B**. Only on: lit wedge, group letters, hub mode |
| Wedge, lit | White 96% fill, ink text, 100 ms | Lift: white **14%** over the wedge, **2 px #F5B26B** edge, letter and symbol amber, label to 88%. App icon unchanged. 100 ms |
| Hub | 0.20 R, 2 px white 25% edge, title 22 pt, mode 13 pt | 0.20 R, same ink, **no edge**, title 20 pt bold white 90%, mode 12 pt amber |
| Appear | Instant after the 400 ms hold | **120 ms**: alpha 0 → 1, scale 0.96 → 1.00. A sublayer switch while a wheel is up stays instant |
| Hide | Cut | Cut (unchanged) |

### Quiet state

After the first command fires on a wheel, the wheel steps back and stays quiet until the sublayer key is released.

| Element | Quiet |
|---|---|
| Geometry | Scaled **0.60** about the wheel centre. Single ring 0.216 R – 0.60 R; two rings: inner 0.168–0.384 R, outer to 0.60 R. Gap 4 px |
| Vignette, hub | Alpha 0 |
| Wedge fill | Ink at **70%** (group same) |
| Key letter | **18 pt** bold, white **78%** |
| Labels, icons | Hidden, cut on the first frame, not faded |
| Lit (repeat press) | White 14% lift, 2 px amber edge, amber letter, 100 ms, then back to quiet |

### Timing and behaviour

| Case | Behaviour |
|---|---|
| Hold before showing | 400 ms, unchanged. A chord finished inside it shows nothing |
| Trigger for quiet | The first `press` on a full wheel |
| Step-back | 140 ms, ease-out. Vignette and hub to 0 over the first 90 ms, linear. Labels and icons cut on frame 1 |
| First-press flash | Lights (Calm lit style) and rides the step-back: eases into the quiet wedge over the same 140 ms, instead of holding 100 ms and snapping back |
| Repeat press | Lit-quiet immediately, at whatever scale the wheel is at; a running step-back continues |
| Command during the 400 ms hold | If the chord is still held at 400 ms, the wheel appears directly in quiet: no full state, no step-back |
| Key not on the wheel | Nothing visible |
| Sublayer switch | The new layer's full wheel, instantly; quiet re-arms for its first press |
| Release (`hide`) | Cut, everything removed. Still waits for a running 100 ms lit flash, as today. A running step-back is cancelled, not waited for |
| Top-level Hyper wheel | Same rule. Its direct commands include repeated ones (=, −, U, Y, P, X). A group key opens that sublayer's full wheel |
| `hud: false` layers (`v`) | Never show a wheel, as today |

Suggested constants (Swift, or `HUD_*` in Lua if falling back):

```
SIZE 0.70 · WEDGE_GAP 4 · RING_GAP 8 · FILL ink(0.11,0.11,0.13) a0.84 · ACCENT #F5B26B
KEY_PT 24 (22 with icon) · KEY_A 0.90 · LABEL_PT 13 · LABEL_A 0.62 · SYMBOL_PT 28 · APPICON_PT 36
LIT_LIFT 0.14 · LIT_EDGE 2 · LIT_MS 100 · APPEAR_MS 120 · APPEAR_SCALE 0.96
VIGNETTE 0.40 / 0.28 at R / 0 at 2.1R
QUIET_SCALE 0.60 · QUIET_FILL_A 0.70 · QUIET_KEY_PT 18 · QUIET_KEY_A 0.78 · QUIET_MS 140 · QUIET_FADE_MS 90
HOLD_MS 400
```

---

## Verify before building on it

1. `send_user_command` exists in Aryaman's installed Karabiner-Elements version, and the receiver gets payloads at the default path. Test with `socat` on a custom `endpoint` first, as Karabiner's docs suggest.
2. Every SF Symbol name above exists on his macOS version (`airpodspro`, `switch.2`, `rectangle.3.group` are the likeliest to have changed). Pick the nearest replacement and say which.
3. Where Apple's volume/brightness bezel actually appears on his macOS (the design brief said bottom centre; recent macOS may show it top-right). Either way the Calm full wheel and the quiet wheel stay clear of bottom centre; just report it.
4. App resolution for the real `o` layer: Arc (`/Applications/Arc`), Microsoft Outlook, Discord, ZenNotes, iTerm, zoom.us, Rstudio, Finder, Messages, iPhone Mirroring, Screenshot, Surfshark, WhatsApp (`/Applications/WhatsApp.localized/WhatsApp.app`). List any that resolve to no icon.

## Fallback: staying on Hammerspoon

If Phase 2 is shelved, apply the Calm and Quiet specs to the `init.lua` HUD block instead:

- Everything except blur and true SF Symbols is doable there. Use a radial `fillGradient` on the backdrop rectangle for the vignette (check `hs.canvas` supports it), and change attributes in place.
- Animate with an `hs.timer` at ~60 Hz, recomputing wedge polygons per frame for the 140 ms step-back (9 frames).
- App icons: `hs.image.iconForFile`.
- SF Symbols have no Hammerspoon API. The only route is putting the symbol's private-use character into a text element in the system font. Test that it renders before committing to it; otherwise ship app icons only and leave symbols for the native app.

## Out of scope

- Changing any keybinding, mode logic, zoom, or the iTerm floating windows.
- Favicons for Lookup URLs.
- Removing the Hammerspoon HUD (wait for Aryaman).
