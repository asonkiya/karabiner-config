-- init.lua
-- Hammerspoon config — auto-switches Karabiner modes based on the frontmost
-- application. Modes are variable-based (instant), not profiles.
-- Managed from karabiner-config repo.

local config = require("apps")
local karabiner = '"/Library/Application Support/org.pqrs/Karabiner-Elements/bin/karabiner_cli"'

-- Load the IPC message port so the `hs` CLI can drive reloads/queries
-- (e.g. `hs -c "hs.reload()"`) without a manual menubar click.
require("hs.ipc")

-- Persistent holder for watchers/timers. Hammerspoon garbage-collects
-- watchers held only by a file-scope local, which silently stops
-- auto-switching mid-session — stash them on a global so they survive.
_G.karabinerMode = _G.karabinerMode or {}

-- Set a Karabiner mode variable and update the flag file for indicators (tmux,
-- SwiftBar). value is 1 (enable) or 0 (disable).
local function setMode(name, value)
    hs.execute(karabiner .. ' --set-variables \'{"' .. name .. '": ' .. tostring(value) .. "}\'")
    local flag = "/tmp/karabiner_mode_" .. name
    if value == 1 then
        hs.execute("touch " .. flag)
    else
        hs.execute("rm -f " .. flag)
    end
    hs.execute("tmux refresh-client -S 2>/dev/null &")
end

local function contains(list, item)
    for _, v in ipairs(list) do
        if v == item then return true end
    end
    return false
end

-- Enable exactly the given modes, disabling every other known mode.
local function setExclusiveModes(modes)
    for _, mode in ipairs(config.allModes) do
        setMode(mode, contains(modes, mode) and 1 or 0)
    end
end

-- Build lookup table: app name → config entry
local appMap = {}
for _, entry in ipairs(config.apps) do
    appMap[entry.name] = entry
end

-- Apply the correct mode for whatever app is frontmost *right now*. Called on
-- load (and shortly after) so the boot race resolves correctly: if a mapped app
-- was already frontmost when Hammerspoon started, no `activated` event ever
-- fires, so without this the mode would stay wrong until you switch away.
local function syncToFrontmostApp()
    local front = hs.application.frontmostApplication()
    local entry = front and appMap[front:name()]
    if entry and entry.modes then
        setExclusiveModes(entry.modes)
    else
        setExclusiveModes({}) -- no mapped app focused → known-good Normal baseline
    end
end

_G.karabinerMode.appWatcher = hs.application.watcher.new(function(name, event, _app)
    local entry = appMap[name]
    if not entry or not entry.modes then return end

    if event == hs.application.watcher.activated then
        -- Enable this app's modes, clear the rest (mutual exclusion).
        setExclusiveModes(entry.modes)
    elseif event == hs.application.watcher.deactivated then
        -- Leaving the app returns to Normal (all modes off).
        for _, mode in ipairs(entry.modes) do
            setMode(mode, 0)
        end
    end
end)
_G.karabinerMode.appWatcher:start()

-- Auto-reload when any .lua in the config dir changes, so edits to init.lua /
-- apps.lua apply without a manual "Reload Config".
_G.karabinerMode.pathWatcher = hs.pathwatcher.new(hs.configdir, function(paths)
    for _, p in ipairs(paths) do
        if p:sub(-4) == ".lua" then
            hs.reload()
            return
        end
    end
end)
_G.karabinerMode.pathWatcher:start()

-- Center the iTerm nvim scratchpad (the "Scratchpad" hotkey window, see
-- iterm/scratchpad.json). Karabiner's Hyper+E sends F18 (which iTerm listens
-- for) and then calls `hs -c "scratchCenter()"`; we wait a beat for the window
-- to appear and center it on whichever screen the mouse is on — iTerm would
-- otherwise restore its last position. When Hyper+E *dismisses* the window,
-- the find comes up empty, which is harmless. (A window-filter can't do this
-- reliably: the title only becomes "Scratchpad" after nvim starts, racing the
-- filter's creation events.)
function hotkeyCenter(title)
    hs.timer.doAfter(0.35, function()
        -- Scope the title match to iTerm2 windows: a bare hs.window.find()
        -- could hit e.g. an Obsidian window titled "Ideas".
        local w
        local app = hs.application.get("iTerm2")
        for _, win in ipairs(app and app:allWindows() or {}) do
            if (win:title() or ""):find(title, 1, true) then
                w = win
                break
            end
        end
        if w then
            w:centerOnScreen(hs.mouse.getCurrentScreen(), true)
            local f = w:frame()
            _G.karabinerMode.lastScratch = string.format("%s centered @ %.0f,%.0f", title, f.x, f.y)
        else
            _G.karabinerMode.lastScratch = title .. ": hidden (or summon failed)"
        end
    end)
end

-- Kept as a wrapper: the committed karabiner.json calls scratchCenter().
function scratchCenter()
    hotkeyCenter("Scratchpad")
end

-- ---------------------------------------------------------------------------
-- Pinch-to-zoom via synthetic magnify gestures.
--
-- macOS has no public API to inject trackpad gestures, but Hammerspoon's
-- newGesture() builds the private type-29 magnify CGEvent. Delivered to the
-- frontmost app; apps that implement pinch (Preview, Safari, Maps, Photos)
-- zoom, apps that don't silently ignore it. Recipe is begin(0) then
-- end(amount): +zooms in, − zooms out. The unit is undocumented — tune
-- ZOOM_STEP to taste.
-- ---------------------------------------------------------------------------
local ZOOM_STEP = 0.3

-- Apps that ignore synthetic magnify gestures (Chromium/Electron/some pro
-- apps). For these, fall back to the app's own zoom keystroke (⌘=/⌘−), which
-- is far more reliable than gesture or scroll synthesis. Extend as needed.
local GESTURE_BLIND = {
    ["Google Chrome"] = true, ["Brave Browser"] = true, ["Microsoft Edge"] = true,
    ["Arc"] = true, ["Code"] = true, ["Visual Studio Code"] = true,
    ["Slack"] = true, ["Discord"] = true, ["Spotify"] = true,
    ["Obsidian"] = true, ["Notion"] = true, ["Figma"] = true,
}

local function postMagnify(amount)
    hs.eventtap.event.newGesture("beginMagnify", 0):post()
    hs.eventtap.event.newGesture("endMagnify", amount):post()
end

-- dir = "in" | "out". Real pinch gesture for gesture-aware apps; ⌘=/⌘−
-- keystroke fallback for gesture-blind ones. Called from Karabiner via
-- `hs -c "zoom('in')"`.
function zoom(dir)
    local front = hs.application.frontmostApplication()
    local name = front and front:name() or ""
    if GESTURE_BLIND[name] then
        hs.eventtap.keyStroke({ "cmd" }, dir == "out" and "-" or "=", 0)
    else
        postMagnify(dir == "out" and -ZOOM_STEP or ZOOM_STEP)
    end
end

-- ---------------------------------------------------------------------------
-- Radial "which-key" HUD for the Hyper layer — the FALLBACK renderer.
--
-- The default wheel is the native hud/ agent (HUD_RENDERER = "native" in
-- utils.ts); Karabiner only sends events here when that's flipped to
-- "hammerspoon". Kept complete so falling back is a one-line change.
--
-- Hold a sublayer key (Hyper+O) and a weapon-wheel of its commands appears
-- around the screen centre: a thick ring cut into one wedge per command, key
-- letter big, label under it, menu title in the hub. Hold Hyper alone and
-- you get the whole layer (sublayers on the inner ring, direct commands on
-- the outer). Karabiner drives it: every sublayer toggle opens
-- `hammerspoon://hud?show=<key>` on press and `?hide=1` on release (see
-- createHyperSubLayer in utils.ts; the Caps Lock manipulator does the same
-- with '_top').
--
-- Menu contents come from sublayers.json, emitted by cheatsheet.ts on every
-- `yarn build` from the assembled profile — so the HUD can't drift from the
-- real bindings. It's re-read on every show (tiny file) because the
-- pathwatcher only reloads on .lua changes.
--
-- Feel: a HUD_DELAY hold before anything appears, so fast chords never flash
-- it; but if a wheel is already up, switching to a sublayer is instant.
-- Every command also pings `?press=<key>` as it fires, and the matching
-- wedge lights up white for HUD_FLASH seconds (the wheel waits for the
-- flash to finish before hiding, so you always see what you hit).
-- ---------------------------------------------------------------------------
local HUD_DELAY = 0.40
local HUD_FLASH = 0.10
local HUD_FILE = hs.configdir .. "/sublayers.json"

_G.karabinerMode.hud = _G.karabinerMode.hud or {}
local hud = _G.karabinerMode.hud

local HUD_INK = { red = 0.08, green = 0.08, blue = 0.10 }
local HUD_ACCENT = { red = 1.0, green = 0.62, blue = 0.20 }
local HUD_FONT = ".AppleSystemUIFont"
local HUD_FONT_BOLD = ".AppleSystemUIFontBold"

local function withAlpha(c, a)
    return { red = c.red, green = c.green, blue = c.blue, alpha = a }
end

-- Which Karabiner mode is active, from the same flag files the indicators use.
local function currentMode()
    for _, m in ipairs({ "programming", "reading", "trivia" }) do
        if hs.fs.attributes("/tmp/karabiner_mode_" .. m) then return m end
    end
    return "normal"
end

local function hudClear()
    if hud.timer then
        hud.timer:stop()
        hud.timer = nil
    end
    if hud.flashTimer then
        hud.flashTimer:stop()
        hud.flashTimer = nil
    end
    hud.hidePending = false
    hud.lit = nil
    hud.wedges = nil
    if hud.canvas then
        hud.canvas:delete()
        hud.canvas = nil
    end
end

-- Geometry (GTA weapon-wheel proportions). Everything is a fraction of R,
-- the wheel's outer radius, which is HUD_SIZE of the shorter half-screen.
local HUD_SIZE = 0.84          -- outer radius as a fraction of min(cx, cy)
local HUD_HUB = 0.20           -- hub radius / R
local HUD_RING1 = 0.36         -- single ring: inner edge / R (outer edge = R)
local HUD_RING2 = { 0.28, 0.64 } -- two rings: inner ring spans [1]..[2], outer [2]+gap..1
local HUD_RING_GAP = 8         -- px between the two rings
local HUD_WEDGE_GAP = 7        -- px between neighbouring wedges
local HUD_DIM = 0.35           -- full-screen darkening behind the wheel
local HUD_FILL = { white = 0.12, alpha = 0.86 }
local HUD_GROUP_FILL = { red = 0.30, green = 0.22, blue = 0.14, alpha = 0.88 } -- sublayer wedges, warm tint
local HUD_EDGE = { white = 1, alpha = 0.22 }
local HUD_LIT_FILL = { white = 1, alpha = 0.96 } -- wedge of the command just pressed
local HUD_KEY_SIZE = 28
local HUD_LABEL_SIZE = 14

-- Split items into rings. <=10 fits one ring; beyond that, two. For the
-- top-level map the sublayers (group=true) take the inner ring and direct
-- commands the outer; otherwise just split evenly.
local function rings(items)
    if #items <= 10 then return { items } end
    local inner, outer = {}, {}
    local hasGroups = false
    for _, it in ipairs(items) do
        if it.group then hasGroups = true end
    end
    if hasGroups then
        for _, it in ipairs(items) do
            table.insert(it.group and inner or outer, it)
        end
    else
        local half = math.ceil(#items / 2)
        for i, it in ipairs(items) do
            table.insert(i <= half and inner or outer, it)
        end
    end
    return { inner, outer }
end

-- Polygon for an annular sector (outer arc a1->a2, inner arc back), as
-- `segments` coordinates. Done by hand so the result doesn't depend on
-- hs.canvas's arc angle conventions. Angles in radians, y-down screen space
-- (so -pi/2 is straight up and angles grow clockwise).
local function wedge(cx, cy, r0, r1, a1, a2)
    local pts = {}
    local n = math.max(2, math.ceil((a2 - a1) / math.rad(2)))
    for i = 0, n do
        local a = a1 + (a2 - a1) * i / n
        pts[#pts + 1] = { x = cx + r1 * math.cos(a), y = cy + r1 * math.sin(a) }
    end
    for i = n, 0, -1 do
        local a = a1 + (a2 - a1) * i / n
        pts[#pts + 1] = { x = cx + r0 * math.cos(a), y = cy + r0 * math.sin(a) }
    end
    return pts
end

-- Key letter (big) over the label, centred. `lit` swaps to dark-on-white for
-- a wedge that's flashing.
local function wedgeText(it, lit)
    local label = it.label or ""
    if utf8.len(label) > 30 then
        label = label:sub(1, utf8.offset(label, 31) - 1) .. "…"
    end
    return hs.styledtext.new(it.key .. "\n" .. label, {
        font = { name = HUD_FONT, size = HUD_LABEL_SIZE },
        color = lit and withAlpha(HUD_INK, 0.85) or { white = 1, alpha = 0.92 },
        paragraphStyle = { alignment = "center", lineBreak = "wordWrap" },
    }):setStyle({
        font = { name = HUD_FONT_BOLD, size = HUD_KEY_SIZE },
        color = lit and HUD_INK or HUD_ACCENT,
    }, 1, utf8.len(it.key))
end

-- One ring of wedges between radii r0..r1, first wedge centred at 12 o'clock,
-- then clockwise. Each wedge gets its key letter (big, accent) over its label.
-- Records every wedge's canvas elements in hud.wedges[code] so hudPress can
-- restyle it in place.
local function drawRing(c, cx, cy, r0, r1, items)
    local n = #items
    local step = 2 * math.pi / n
    local rm = (r0 + r1) / 2
    local thick = r1 - r0
    local arc = rm * step - HUD_WEDGE_GAP -- arc length available per wedge at mid radius
    for i, it in ipairs(items) do
        local a = -math.pi / 2 + (i - 1) * step
        local half = step / 2 - (HUD_WEDGE_GAP / 2) / rm
        c[#c + 1] = {
            type = "segments", closed = true,
            coordinates = wedge(cx, cy, r0, r1, a - half, a + half),
            action = "strokeAndFill",
            fillColor = it.group and HUD_GROUP_FILL or HUD_FILL,
            strokeColor = HUD_EDGE, strokeWidth = 1,
        }

        -- Horizontal room for text inside this wedge: the arc width when the
        -- wedge points up/down, the ring thickness when it points sideways.
        local x, y = cx + rm * math.cos(a), cy + rm * math.sin(a)
        local w = 0.9 * (math.abs(math.sin(a)) * arc + math.abs(math.cos(a)) * thick)
        w = math.max(90, math.min(260, w))
        c[#c + 1] = {
            type = "text", text = wedgeText(it, false),
            frame = { x = x - w / 2, y = y - 38, w = w, h = 80 },
        }
        if it.code and not hud.wedges[it.code] then
            hud.wedges[it.code] = { fill = #c - 1, text = #c, item = it }
        end
    end
end

-- Karabiner gates some bindings on the frontmost app (frontmost_application_if,
-- a list of bundle-id regexes). sublayers.json carries those regexes as
-- `app`; drop the item unless the frontmost app matches one. The regexes in
-- this repo are plain anchored literals (`^net\.whatsapp\.WhatsApp$`), so
-- turning JS escapes (`\.`) into Lua ones (`%.`) is all the translation needed.
local function jsRegexToLua(re)
    return (re:gsub("\\(%p)", "%%%1"))
end

-- Items that apply to the frontmost app, first match per key — the same
-- resolution Karabiner does (an app-gated rule shadows a later un-gated one
-- only inside its app). cheatsheet.ts keeps every candidate for a key, in
-- rule order, for exactly this reason.
local function visibleItems(items)
    local front = hs.application.frontmostApplication()
    local bid = front and front:bundleID() or ""
    local out, seen = {}, {}
    for _, it in ipairs(items) do
        local ok = not seen[it.key]
        if ok and it.app then
            ok = false
            for _, re in ipairs(it.app) do
                if bid:find(jsRegexToLua(re)) then ok = true; break end
            end
        end
        if ok then
            out[#out + 1] = it
            seen[it.key] = true
        end
    end
    return out
end

local function draw(key)
    local data = hs.json.read(HUD_FILE)
    local menus = data and data[currentMode()]
    local menu = menus and menus[key]
    if not menu or not menu.items then return end
    menu.items = visibleItems(menu.items)
    if #menu.items == 0 then return end

    local screen = hs.mouse.getCurrentScreen() or hs.screen.mainScreen()
    local f = screen:frame()
    local cx, cy = f.w / 2, f.h / 2

    local c = hs.canvas.new(f)
    c:level(hs.canvas.windowLevels.overlay)
    c:behaviorAsLabels({ "canJoinAllSpaces", "stationary" })
    c:clickActivating(false)
    hud.wedges = {}

    local R = math.min(cx, cy) * HUD_SIZE

    -- Dim the screen behind the wheel so it reads against anything.
    c[#c + 1] = {
        type = "rectangle", frame = { x = 0, y = 0, w = f.w, h = f.h },
        action = "fill", fillColor = { black = 1, alpha = HUD_DIM },
    }

    -- Rings of wedges.
    local groups = rings(menu.items)
    if #groups == 1 then
        drawRing(c, cx, cy, R * HUD_RING1, R, groups[1])
    else
        drawRing(c, cx, cy, R * HUD_RING2[1], R * HUD_RING2[2], groups[1])
        drawRing(c, cx, cy, R * HUD_RING2[2] + HUD_RING_GAP, R, groups[2])
    end

    -- Hub: menu title, current mode underneath.
    local rHub = R * HUD_HUB
    c[#c + 1] = {
        type = "circle", center = { x = cx, y = cy }, radius = rHub,
        action = "strokeAndFill",
        fillColor = withAlpha(HUD_INK, 0.90),
        strokeColor = { white = 1, alpha = 0.25 }, strokeWidth = 2,
    }
    c[#c + 1] = {
        type = "text", frame = { x = cx - rHub, y = cy - 24, w = rHub * 2, h = 30 },
        text = hs.styledtext.new(menu.title, {
            font = { name = HUD_FONT_BOLD, size = 22 },
            color = { white = 1 },
            paragraphStyle = { alignment = "center" },
        }),
    }
    local mode = currentMode()
    c[#c + 1] = {
        type = "text", frame = { x = cx - rHub, y = cy + 6, w = rHub * 2, h = 20 },
        text = hs.styledtext.new(mode:sub(1, 1):upper() .. mode:sub(2), {
            font = { name = HUD_FONT, size = 13 },
            color = withAlpha(HUD_ACCENT, 0.9),
            paragraphStyle = { alignment = "center" },
        }),
    }

    hud.canvas = c
    c:show()
end

-- Called from Karabiner on sublayer / Hyper press. `key` is the raw sublayer
-- key_code ('o', 'w', ...) or '_top' for the Hyper layer itself.
function hudShow(key)
    local wasVisible = hud.canvas ~= nil
    hudClear()
    if wasVisible then
        draw(key)
    else
        hud.timer = hs.timer.doAfter(HUD_DELAY, function()
            hud.timer = nil
            draw(key)
        end)
    end
end

-- Restyle one wedge (by raw key_code) lit or unlit, in place.
local function setLit(code, lit)
    local w = hud.canvas and hud.wedges and hud.wedges[code]
    if not w then return end
    hud.canvas[w.fill].fillColor = lit and HUD_LIT_FILL
        or (w.item.group and HUD_GROUP_FILL or HUD_FILL)
    hud.canvas[w.text].text = wedgeText(w.item, lit)
end

-- Called from Karabiner as a command fires (`?press=<key_code>`). If that
-- key has a wedge on the wheel that's up, flash it white for HUD_FLASH;
-- nothing showing (fast chord) means nothing to do.
function hudPress(code)
    if not hud.canvas then return end
    if hud.flashTimer then
        hud.flashTimer:stop()
        hud.flashTimer = nil
    end
    if hud.lit then setLit(hud.lit, false) end
    if not (hud.wedges and hud.wedges[code]) then
        hud.lit = nil
        if hud.hidePending then hudClear() end
        return
    end
    setLit(code, true)
    hud.lit = code
    hud.flashTimer = hs.timer.doAfter(HUD_FLASH, function()
        hud.flashTimer = nil
        if hud.hidePending then
            hudClear()
        else
            setLit(code, false)
            hud.lit = nil
        end
    end)
end

-- Called from Karabiner on release. Safe to call when nothing is showing.
-- If a wedge is mid-flash the wheel lingers until the flash ends, so a
-- quick chord-and-release still shows what was hit.
function hudHide()
    if hud.flashTimer then
        hud.hidePending = true
        return
    end
    hudClear()
end

-- Karabiner reaches the HUD through URL events, not `hs -c`:
--   open -g "hammerspoon://hud?show=<key>"   (sublayer / Hyper press)
--   open -g "hammerspoon://hud?hide=1"       (release)
--   open -g "hammerspoon://hud?press=<key>"  (a command fired; light its wedge)
-- `open -g` is fire-and-forget, so a keystroke never waits on this process.
-- (`hs -c` is a blocking IPC round-trip — fine for one-off chords like
-- zoom(), but the Hyper hook fires on every Escape tap, and clients stuck
-- behind a busy or reloading Hammerspoon pile up.) See hsEvent in utils.ts.
hs.urlevent.bind("hud", function(_, params)
    if params.show then
        hudShow(params.show)
    elseif params.press then
        hudPress(params.press)
    elseif params.hide then
        hudHide()
    end
end)

-- Establish a known-good baseline immediately, then again after a delay:
-- at login Karabiner's server may not be up yet when Hammerspoon loads, so the
-- first --set-variables call can no-op. Re-syncing a few seconds later catches
-- that case without any manual intervention.
syncToFrontmostApp()
_G.karabinerMode.bootTimers = {
    hs.timer.doAfter(3, syncToFrontmostApp),
    hs.timer.doAfter(8, syncToFrontmostApp),
}

print("[karabiner-mode] watcher + auto-reload loaded")
