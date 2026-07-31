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
