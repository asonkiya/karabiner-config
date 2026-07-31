# karabiner-config

One unified [Karabiner-Elements](https://karabiner-elements.pqrs.org/) profile,
generated from TypeScript. Caps Lock becomes a **Hyper key** (⌃⌥⇧⌘) that opens
declarative sublayers; "modes" (Programming / Reading / Trivia) are instant
variable flips instead of slow profile switches; and two floating nvim windows
give one-keystroke scratch space and idea capture from anywhere — including
over fullscreen apps.

Forked from [@mxstbr's config](https://github.com/mxstbr/karabiner) and heavily
restructured.

## Highlights

- **Hyper sublayers** — hold Caps Lock, tap a sublayer key, tap a command key.
  Declared as plain TypeScript maps in `profiles/`. Tap Caps Lock alone = Escape.
- **Instant modes** — one profile, mode-gated rules behind `variable_if`
  conditions. Switching (`Hyper+M, P/R/T/N`) is a variable flip: no config
  reload, no dropped keystrokes. Hammerspoon auto-switches modes per app;
  SwiftBar and tmux show the active mode.
- **`Hyper+E` — scratchpad**: a small floating nvim window (iTerm hotkey
  window), centered on your screen, self-clearing after 5 idle minutes. Real
  vim, not an emulation.
- **`Hyper+I` — idea capture**: same floating treatment; every summon starts a
  fresh timestamped markdown note that lands in an Obsidian vault folder when
  the window loses focus. Empty summons write nothing.
- **`Hyper+T`** — dual-role app switcher: tap = Cmd+Tab, hold = browse the
  switcher with Cmd held for you.
- **Vim mode** (`Hyper+Enter`) — vim-style navigation/editing anywhere.

The full keymap lives in the source — `profiles/normal.ts` is the assembler
and the place to look first. The tables in code are the source of truth;
nothing here will drift out of date.

## Requirements

- macOS
- [Karabiner-Elements](https://karabiner-elements.pqrs.org/)
- Node.js + yarn (build tooling)
- Optional but recommended:
  - [Hammerspoon](https://www.hammerspoon.org/) — per-app mode auto-switching,
    scratchpad centering
  - [iTerm2](https://iterm2.com/) + [Neovim](https://neovim.io/) — the
    scratchpad / idea-capture floating windows
  - [SwiftBar](https://swiftbar.app/) and/or tmux — mode indicators

## Install

```sh
git clone https://github.com/asonkiya/karabiner-config.git
cd karabiner-config
./setup.sh
```

`setup.sh` is idempotent and backs up anything it replaces
(`*.backup.<timestamp>`). It:

1. Checks dependencies and installs node modules
2. Rewrites the author's hardcoded paths (repo location, Homebrew prefix) for
   your machine
3. Symlinks `~/.config/karabiner` → the repo and `~/.hammerspoon` →
   `hammerspoon/`
4. Symlinks the iTerm dynamic profiles (`iterm/*.json`) into
   `~/Library/Application Support/iTerm2/DynamicProfiles/`
5. Installs the SwiftBar indicator if SwiftBar is present
6. Installs a LaunchAgent that rebuilds `karabiner.json` at login (so a
   `git pull` never leaves Karabiner on a stale config)
7. Runs the initial build

Then follow the printed manual steps (permission grants, optional Login
Items). The ideas vault path is personal — edit `VAULT` in `iterm/ideas.lua`.

## Customizing

```sh
yarn watch   # rebuilds karabiner.json on every save
```

- **Keybindings**: `profiles/normal.ts` (everyday bindings + global
  sublayers), `profiles/programming.ts` / `reading.ts` / `trivia.ts`
  (mode-gated fragments).
- **Adding a mode**: add it to `MODE_NAMES` in `utils.ts`, create a gated
  fragment in `profiles/`, spread it in `normal.ts`, map an app in
  `hammerspoon/apps.lua`, add it to the indicators. (Step-by-step in
  `AGENTS.md`.)
- **Floating windows**: size/behavior in `iterm/*.json` (rows, columns,
  hotkey); nvim-side behavior in `iterm/*.lua`. After editing a profile JSON,
  reload it with `touch -h` on its symlink in `DynamicProfiles/` — deleting
  and recreating the symlink makes iTerm silently drop the hotkey.
- **Indicators**: `indicators/karabiner-profile.2s.sh` (SwiftBar),
  `indicators/tmux-status.conf` (append to `~/.tmux.conf`).

## Architecture

`yarn build` runs `rules.ts` via `tsm`, which writes `karabiner.json`. Since
`~/.config/karabiner` is a symlink to the repo, Karabiner hot-reloads on every
build.

Why one profile instead of several: `karabiner_cli --select-profile` reloads
the whole config (~1–2 s, drops keystrokes). Modes here are just variables
gated with `variable_if` conditions — switching is instantaneous, and
mode-specific bare keys (e.g. Reading's arrow remaps) simply don't apply
outside their mode. Mode state is mirrored to `/tmp/karabiner_mode_*` flag
files, which the indicators read.

| Path | Role |
|---|---|
| `rules.ts` | entry point — emits the single profile |
| `profiles/` | `normal.ts` assembles everything; other files are mode-gated fragments |
| `utils.ts` | sublayer generator, mode machinery, command helpers |
| `types.ts` | Karabiner JSON schema types |
| `hammerspoon/` | per-app mode auto-switching, floating-window centering, boot resilience |
| `iterm/` | dynamic profiles + nvim overlays for the scratchpad and idea-capture windows |
| `indicators/` | SwiftBar plugin + tmux status snippet |
| `setup.sh` | idempotent installer |

## License

Copyright (c) 2022 Maximilian Stoiber, licensed under the
[MIT license](./LICENSE.md).
