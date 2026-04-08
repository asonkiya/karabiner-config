-- apps.lua
-- Declarative app → profile/mode mappings.
-- Mirrors the structure of the karabiner-config TypeScript files.
--
-- Fields per entry:
--   name     (string)   - exact app name as reported by macOS
--   profile  (string?)  - Karabiner profile to switch to on activation
--   modes    (string[]?) - karabiner mode variables to enable on activation
--
-- On deactivation: profile reverts to defaultProfile, modes are disabled.

return {
    defaultProfile = "Normal",

    apps = {
        -- Programming
        { name = "iTerm2",   profile = "Programming" },
        { name = "Godot",    profile = "Programming" },

        -- Reading
        -- { name = "Kindle",   profile = "Reading" },

        -- Vim mode (auto-enter on activation, exit on deactivation)
        -- { name = "Obsidian", modes = { "vim_mode" } },
        -- { name = "Notes",    modes = { "vim_mode" } },
    },
}
