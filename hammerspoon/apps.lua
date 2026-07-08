-- apps.lua
-- Declarative app → mode mappings.
-- Mirrors the structure of the karabiner-config TypeScript files.
--
-- Fields per entry:
--   name     (string)    - exact app name as reported by macOS
--   modes    (string[]?) - karabiner mode variables to enable on activation
--
-- Modes are mutually exclusive: activating an app's modes clears every other
-- mode in `allModes` (so focusing a terminal in Trivia mode doesn't leave the
-- bare-key game bindings hijacking your typing). On deactivation, the app's
-- modes are disabled (back to Normal).

return {
    -- All mutually-exclusive modes. Activating one clears the others.
    allModes = { "programming", "reading", "trivia" },

    apps = {
        -- Programming
        { name = "iTerm2",   modes = { "programming" } },
        { name = "Godot",    modes = { "programming" } },

        -- Reading
        -- { name = "Kindle",   modes = { "reading" } },

        -- Vim mode (auto-enter on activation, exit on deactivation)
        -- { name = "Obsidian", modes = { "vim_mode" } },
        -- { name = "Notes",    modes = { "vim_mode" } },
    },
}
