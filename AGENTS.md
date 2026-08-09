# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Commands

- **Build** (compile TypeScript, write `karabiner.json`, regenerate `CHEATSHEET.md`): `yarn build`
- **Watch** (auto-rebuild on file changes): `yarn watch` — this is always running during development, no need to manually build
- **Cheatsheet** (regenerate `CHEATSHEET.md` only): `yarn cheatsheet` — also runs as part of `yarn build`

## Architecture

This repo generates `karabiner.json` for [Karabiner-Elements](https://karabiner-elements.pqrs.org/) from TypeScript source. The build runs `rules.ts` directly via `tsm` (a TypeScript module runner), which writes `karabiner.json` as a side effect.

### File roles

- **`rules.ts`** — entry point; emits a **single unified profile** (`normalProfile`) and calls `profilesToConfig` to write `karabiner.json`
- **`profiles/`** — `normal.ts` is the assembler; `programming.ts`/`reading.ts`/`trivia.ts` export **mode-gated rule fragments** (not standalone `Profile`s) that `normal.ts` composes into the one profile
- **`utils.ts`** — helper functions:
  - `createHyperSubLayers(subLayers, extraConditions?)` — builds Hyper key sublayer rules from a declarative map. `extraConditions` is injected into every generated manipulator, used to gate a whole sublayer set behind a mode variable. `LayerCommand` values also support a per-command `conditions` field that gets merged in.
  - `app`, `open`, `window`, `shell` — shorthand `LayerCommand` constructors used inside sublayer maps
  - **Modes (instant, variable-based — the fast path):**
    - `MODE_NAMES` / `ModeName` — the mode variables (`programming`, `reading`, `trivia`)
    - `switchMode(target)` — flips the target mode variable to 1 and all others to 0, updates `/tmp/karabiner_mode_<name>` flag files, refreshes tmux, fires a notification. **No config reload — instant.**
    - `whenMode(mode)` — conditions that hold only while `mode` is active (gate a mode's rules)
    - `whenNormal` — conditions that hold only in Normal (all mode vars 0); gates the Normal sublayers
    - `hyperNotHeld` — condition to gate bare-key mode remaps so they don't fire mid Hyper-chord
    - `appAndSwitchMode(appName, mode)` — opens an app and instantly switches into a mode
  - `switchProfile(name)` — legacy profile switch via `karabiner_cli` (slow reload; kept but unused)
  - `doubleTap(key, command, delayMs?, extraConditions?)` — fires a command on double-tap of a key
  - `claudeCmd(command)` — types a Codex slash command into the focused terminal + Enter
  - `vimCmd(command)` — escapes to Vim normal mode then runs `:command` + Enter
  - `profilesToConfig(profiles)` — wraps profiles in a `KarabinerConfig`, applies `keyboard_type_v2: "ansi"` and marks the first profile `selected`
- **`types.ts`** — TypeScript interfaces mirroring the Karabiner JSON schema (`KarabinerConfig`, `Profile`, `KarabinerRules`, `Manipulator`, `KeyCode`, etc.)
- **`cheatsheet.ts`** — walks the assembled `normalProfile` (conditions + descriptions) and renders `CHEATSHEET.md`, grouping bindings by mode. Run via `yarn cheatsheet` or automatically on `yarn build`. `CHEATSHEET.md` is generated output — never edit it by hand.
- **`iterm/`** — floating nvim windows, implemented as iTerm dynamic profiles (symlinked into `~/Library/Application Support/iTerm2/DynamicProfiles/` by `setup.sh`) plus per-window nvim overlay lua:
  - `scratchpad.json`/`scratchpad.lua` — `Hyper+E`: self-clearing scratch buffer on `~/scratch.md` (wipes on open + after 5 idle minutes), diagnostics/spell/lint disabled, autosave on focus loss
  - `ideas.json`/`ideas.lua` — `Hyper+I`: fresh timestamped idea per summon, committed to the Obsidian vault Ideas folder on focus loss; untouched buffers are never written
  - `todo.json`/`todo.lua` — `Hyper+T`: single persistent `todo.md` in the Obsidian vault root, autosaved on focus loss, reloaded from disk on re-summon so Obsidian edits sync in. Not cleared, not per-summon.
  - Karabiner sends F18/F19/F20 to summon; Hammerspoon's `hotkeyCenter(title)` centers the window. **Reload after editing a profile JSON with `touch -h` on its DynamicProfiles symlink** — deleting/recreating the symlink makes iTerm silently drop the hotkey registration.
- **`indicators/`** — mode indicators: `karabiner-profile.2s.sh` (SwiftBar plugin, symlinked by `setup.sh`) and `tmux-status.conf` (snippet to append to `~/.tmux.conf`)
- **`setup.sh`** — idempotent installer: dependency checks, path personalization (repo location + brew prefix), all symlinks (with backups), login-build LaunchAgent (`com.karabiner-config.build`), initial build

### Modes (why one profile, not four)

Profile switching (`karabiner_cli --select-profile`) reloads the entire config and is slow (~1–2s, drops keystrokes). Instead there is **one profile** and "modes" are just variables gated with `variable_if` conditions, so switching is an instant variable flip. Mode-specific keys (including bare keys like Trivia's `1` or Reading's `→`) are gated so they only apply in their mode; when no mode is active, keys behave normally.

Switching conventions (all via the common, ungated `m` sublayer — works from any mode):
- **→ Programming**: `Hyper + M, P`
- **→ Reading**: `Hyper + M, R`
- **→ Trivia**: `Hyper + M, T`
- **→ Normal**: `Hyper + M, N`

Auto-switching by app is handled by Hammerspoon (`hammerspoon/apps.lua` + `init.lua`), which sets the same mode variables (mutually exclusive). Indicators read the `/tmp/karabiner_mode_*` flags: the SwiftBar plugin and tmux status snippet, both in `indicators/`.

### Adding a new mode

1. Add the mode name to `MODE_NAMES` in `utils.ts` (and `MODE_LABELS`)
2. Create `profiles/<mode>.ts` exporting a gated `<mode>Rules: KarabinerRules[]` — wrap Hyper sublayers with `createHyperSubLayers({...}, whenMode("<mode>"))`, and bare-key manipulators with `conditions: [...whenMode("<mode>"), hyperNotHeld]`
3. Import the fragment in `normal.ts`, spread it into the rules array, and add `<key>: switchMode("<mode>")` to the `m` sublayer
4. Add the mode to `allModes` in `hammerspoon/apps.lua` (and an app mapping if it should auto-switch), and to the indicators (`karabiner-profile.2s.sh`, `~/.tmux.conf`)

### Key concept: Hyper Key sublayers

`createHyperSubLayers` takes a map of `KeyCode → HyperKeySublayer` (or a `LayerCommand` directly). Each sublayer is activated by holding Hyper (Caps Lock remapped to ⌃⌥⇧⌘) then pressing the sublayer key, after which a second key triggers the bound command. The function generates all the variable-setting manipulators and conditions automatically.
