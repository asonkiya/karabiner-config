-- init.lua
-- Hammerspoon config — auto-switches Karabiner profiles and modes
-- based on frontmost application. Managed from karabiner-config repo.

local config = require("apps")
local karabiner = '"/Library/Application Support/org.pqrs/Karabiner-Elements/bin/karabiner_cli"'

-- Switch Karabiner profile and refresh tmux status bar
local function switchProfile(name)
    hs.execute(karabiner .. ' --select-profile "' .. name .. '"')
    hs.execute("tmux refresh-client -S 2>/dev/null &")
end

-- Set a Karabiner mode variable and update the flag file for tmux
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

-- Build lookup table: app name → config entry
local appMap = {}
for _, entry in ipairs(config.apps) do
    appMap[entry.name] = entry
end

local watcher = hs.application.watcher.new(function(name, event, _app)
    local entry = appMap[name]

    if event == hs.application.watcher.activated then
        if entry then
            if entry.profile then
                switchProfile(entry.profile)
            end
            if entry.modes then
                for _, mode in ipairs(entry.modes) do
                    setMode(mode, 1)
                end
            end
        end

    elseif event == hs.application.watcher.deactivated then
        if entry then
            if entry.profile then
                switchProfile(config.defaultProfile)
            end
            if entry.modes then
                for _, mode in ipairs(entry.modes) do
                    setMode(mode, 0)
                end
            end
        end
    end
end)

watcher:start()
