# @asonkiya's Karabiner Elements configuration

This repo is a fork of @mxstbr's config, fine tuned for my own needs.

## Installation

1. Install & start [Karabiner Elements](https://karabiner-elements.pqrs.org/)
1. Clone this repository
1. Delete the default `~/.config/karabiner` folder
1. Create a symlink with `ln -s ~/github/asonkiya/karabiner-config ~/.config/karabiner` (adjust path to where you cloned it)
1. [Restart karabiner_console_user_server](https://karabiner-elements.pqrs.org/docs/manual/misc/configuration-file-path/) with `` launchctl kickstart -k gui/`id -u`/org.pqrs.karabiner.karabiner_console_user_server ``

## Development

```
yarn install
```

Install dependencies (one-time only).

```
yarn run build
```

Builds `karabiner.json` from the TypeScript source.

```
yarn run watch
```

Watches TypeScript files and rebuilds on change.

## Architecture

Profiles live in `profiles/`. Each profile exports a `Profile` object and is registered in `rules.ts`. Shared helpers (`createHyperSubLayers`, `doubleTap`, `switchProfile`, etc.) live in `utils.ts`.

## Profiles

### Normal Mode (default)

The main everyday profile. Caps Lock is remapped to the **Hyper key** (⌃⌥⇧⌘). Tapping Caps Lock alone sends `Escape`. Double-tapping `Tab` in iTerm2 switches to **Programming Mode**.

#### Hyper sublayers

| Sublayer | Key | Action |
|----------|-----|--------|
| **L** — Links | `i` | Instagram DMs |
| | `d` | DoorDash |
| | `y` | YouTube |
| | `t` | CHT Transit map |
| | `n` | localhost:8080(personal project, remove for personal configurations) |
| | `s` | Twitch |
| | `c` | Canvas |
| | `g` | Arc incognito window |
| **O** — Open apps | `g` | Arc |
| | `e` | Microsoft Outlook |
| | `d` | Discord |
| | `n` | Obsidian |
| | `t` | iTerm2 → switches to Programming Mode |
| | `z` | Zoom |
| | `r` | RStudio |
| | `f` | Finder |
| | `m` | Messages |
| | `p` | iPhone Mirroring |
| | `c` | ChatGPT |
| | `v` | Surfshark |
| | `w` | WhatsApp |
| **W** — Window | `m` | Maximize |
| | `f` | Fullscreen |
| | `j` | Mission Control left |
| | `k` | Mission Control right |
| | `u` | Zoom in |
| | `i` | Zoom out |
| | `;` | Hide window |
| **S** — System | `u` | Volume up |
| | `j` | Volume down |
| | `m` | Mute |
| | `i` | Brightness up |
| | `k` | Brightness down |
| | `p` | Play/pause |
| | `;` | Fast forward |
| | `c` | Open camera |
| | `h` | AirPods noise control |
| | `v` | Push to talk |
| **V** — Vim motions | `h/j/k/l` | Arrow keys |
| | `m` | Homerow MagicMove |
| | `s` | Homerow scroll mode |
| | `u` | Page down |
| | `i` | Page up |
| **P** — Profiles | `p` | Switch to Programming Mode |
| | `t` | Switch to Test |
| **R** — Raycast | `e` | Emoji picker |
| | `p` | Confetti |
| | `h` | Clipboard history |

---

### Programming Mode

Activated from Normal Mode via `Hyper + O + T` (opens iTerm2) or double-tapping `Tab` in iTerm2. Double-tapping `Escape` returns to Normal Mode. A macOS notification fires on every profile switch.

Caps Lock → Hyper key (same as Normal Mode). `Hyper + B` in iTerm2 sends the tmux prefix (`Ctrl+B`).

#### Hyper sublayers

| Sublayer | Key | Action |
|----------|-----|--------|
| **L** — Claude Code | `r` | `/resume` + Enter×2 |
| | `i` | `/init` |
| | `c` | `/clear` |
| | `h` | `/help` |
| | `b` | `/bug` |
| | `p` | `/plan` |
| | `k` | `/commit` |
| | `x` | `exit` |
| | `m` | Shift+Tab (navigate Claude suggestions) |
| **G** — Git | `s` | `git status` |
| | `a` | `git add .` |
| | `c` | `git commit -m ""` (cursor inside quotes) |
| | `p` | `git push` |
| | `u` | `git pull` |
| | `l` | `git log --oneline` |
| | `d` | `git diff` |
| | `b` | `git branch` |
| | `z` | `git stash` |
| | `r` | `git stash pop` |
| **S** — tmux Sessions | `j` | Switch to window 0 |
| | `k` | Switch to window 1 |
| | `l` | Switch to window 2 |
| | `;` | Switch to window 3 |
| | `-` | Kill current session |
| **V** — Vim motions + commands | `h/j/k/l` | Arrow keys |
| | `m` | Homerow MagicMove |
| | `s` | Homerow scroll mode |
| | `u` | Page down |
| | `i` | Page up |
| | `w` | `:w` — save |
| | `q` | `:q` — quit |
| | `x` | `:wq` — save & quit |
| | `n` | `:q!` — force quit |
| | `e` | `:e!` — reload / discard changes |
| | `o` | Type `nvim .` + Enter |

---

### Test

A sample profile. Double-tapping `T` opens YouTube.

## Key utilities

- **`doubleTap(key, command, delayMs?, extraConditions?)`** — fires a command only when a key is pressed twice within the delay window. Supports extra conditions (e.g. restrict to a specific app).
- **`switchProfile(name)`** — switches the active Karabiner profile and shows a macOS notification.
- **`appAndSwitch(appName, profileName)`** — opens an app and switches profile simultaneously.
- **`claudeCmd(command)`** — types a Claude Code slash command into the focused terminal and hits Enter.
- **`vimCmd(command)`** — escapes to Vim normal mode and runs a `:command`.

## License

Copyright (c) 2022 Maximilian Stoiber, licensed under the [MIT license](./LICENSE.md).
