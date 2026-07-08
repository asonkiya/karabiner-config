-- init.lua
-- Hammerspoon config — auto-switches Karabiner modes based on the frontmost
-- application. Modes are variable-based (instant), not profiles.
-- Managed from karabiner-config repo.

local config = require("apps")
local karabiner = '"/Library/Application Support/org.pqrs/Karabiner-Elements/bin/karabiner_cli"'

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

local watcher = hs.application.watcher.new(function(name, event, _app)
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

watcher:start()
