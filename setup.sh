#!/usr/bin/env bash
# One-shot, idempotent installer for this Karabiner + Hammerspoon + iTerm setup.
# Safe to re-run; anything it replaces is backed up with a timestamp suffix.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TS="$(date +%Y%m%d-%H%M%S)"

say()  { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33mwarn:\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31merror:\033[0m %s\n' "$*" >&2; exit 1; }

[ "$(uname -s)" = "Darwin" ] || die "macOS only."

# --- dependencies -----------------------------------------------------------
say "Checking dependencies"
command -v node >/dev/null || die "node not found — install Node.js (brew install node, or nvm)."
command -v yarn >/dev/null || die "yarn not found — corepack enable, or npm install -g yarn."
[ -d "/Applications/Karabiner-Elements.app" ] \
        || warn "Karabiner-Elements.app not found — install from https://karabiner-elements.pqrs.org/"
HAVE_HS=false
[ -d "/Applications/Hammerspoon.app" ] && HAVE_HS=true
$HAVE_HS || warn "Hammerspoon.app not found (which-key HUD, pinch-zoom, mode auto-switching, window centering) — brew install --cask hammerspoon"
command -v cliclick >/dev/null \
        || warn "cliclick not found (Reading-mode screenshot-drag macros) — brew install cliclick"
HAVE_ITERM=false
[ -d "/Applications/iTerm.app" ] && HAVE_ITERM=true
$HAVE_ITERM || warn "iTerm.app not found — the floating scratchpad (Hyper+E) and idea capture (Hyper+I) need it."
command -v nvim >/dev/null || warn "nvim not found — the scratchpad/ideas windows run nvim."

say "Installing node dependencies"
(cd "$REPO" && yarn install --silent --non-interactive >/dev/null)

# --- personalize hardcoded absolute paths -----------------------------------
# The committed files carry the author's repo path and Apple-Silicon brew
# prefix; rewrite them for this machine. No-op when they already match.
OLD_REPO="/Users/aryaman/github/karabiner-config"
OLD_BREW="/opt/homebrew"
BREW_PREFIX="$({ command -v brew >/dev/null && brew --prefix; } || echo /opt/homebrew)"
if [ "$REPO" != "$OLD_REPO" ] || [ "$BREW_PREFIX" != "$OLD_BREW" ]; then
        say "Personalizing paths (repo: $REPO, brew: $BREW_PREFIX)"
        for f in "$REPO"/iterm/*.json "$REPO"/iterm/*.lua "$REPO"/profiles/*.ts "$REPO"/utils.ts; do
                sed -i '' -e "s|$OLD_REPO|$REPO|g" -e "s|$OLD_BREW/bin|$BREW_PREFIX/bin|g" "$f"
        done
fi

# --- symlinks (with backups) ------------------------------------------------
# Backups go to a dedicated folder, NOT next to the original: some link
# destinations are watched directories (e.g. SwiftBar's plugin folder, which
# executes every executable file in it — a sibling backup would show up as a
# duplicate menubar item).
BACKUP_DIR="$HOME/.karabiner-config-backups/$TS"
link() {
        local target="$1" linkpath="$2"
        if [ -L "$linkpath" ] && [ "$(readlink "$linkpath")" = "$target" ]; then
                return # already correct
        fi
        if [ -e "$linkpath" ] || [ -L "$linkpath" ]; then
                mkdir -p "$BACKUP_DIR"
                mv "$linkpath" "$BACKUP_DIR/$(basename "$linkpath")"
                warn "existing $(basename "$linkpath") moved to $BACKUP_DIR/"
        fi
        ln -s "$target" "$linkpath"
        say "Linked $linkpath -> $target"
}

say "Linking configs"
mkdir -p "$HOME/.config"
link "$REPO" "$HOME/.config/karabiner"
link "$REPO/hammerspoon" "$HOME/.hammerspoon"

# The `hs` CLI: Karabiner's one-off chords (zoom, floating-window centering)
# call it over hs.ipc. Hammerspoon ships the binary inside the app bundle and
# normally symlinks it via hs.ipc.cliInstall(); do the same thing here so a
# fresh machine doesn't need a manual step in the Hammerspoon console.
if $HAVE_HS; then
        HS_BIN="/Applications/Hammerspoon.app/Contents/Frameworks/hs/hs"
        if [ -x "$HS_BIN" ] && [ ! -x "$BREW_PREFIX/bin/hs" ]; then
                if mkdir -p "$BREW_PREFIX/bin" 2>/dev/null && [ -w "$BREW_PREFIX/bin" ]; then
                        link "$HS_BIN" "$BREW_PREFIX/bin/hs"
                else
                        warn "$BREW_PREFIX/bin not writable — install the hs CLI from the Hammerspoon console: hs.ipc.cliInstall(\"$BREW_PREFIX\")"
                fi
        fi
fi

if $HAVE_ITERM; then
        DYN="$HOME/Library/Application Support/iTerm2/DynamicProfiles"
        mkdir -p "$DYN"
        for f in "$REPO"/iterm/*.json; do
                link "$f" "$DYN/$(basename "$f")"
        done
fi

# SwiftBar mode indicator (optional)
SWIFTBAR_DIR="$(defaults read com.ameba.SwiftBar PluginDirectory 2>/dev/null || true)"
if [ -n "$SWIFTBAR_DIR" ] && [ -d "$SWIFTBAR_DIR" ]; then
        link "$REPO/indicators/karabiner-profile.2s.sh" "$SWIFTBAR_DIR/karabiner-profile.2s.sh"
else
        say "SwiftBar not detected — skipping menubar indicator (see indicators/)"
fi

# --- login build agent ------------------------------------------------------
# Rebuilds karabiner.json at login so a git pull never leaves Karabiner
# running a stale config.
say "Installing login build LaunchAgent"
PLIST="$HOME/Library/LaunchAgents/com.karabiner-config.build.plist"
NODE_BIN="$(command -v node)"
YARN_BIN="$(command -v yarn)"
mkdir -p "$HOME/Library/LaunchAgents"
cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.karabiner-config.build</string>
    <key>ProgramArguments</key>
    <array>
        <string>$NODE_BIN</string>
        <string>$YARN_BIN</string>
        <string>build</string>
    </array>
    <key>WorkingDirectory</key>
    <string>$REPO</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>$(dirname "$NODE_BIN"):/usr/bin:/bin:/usr/sbin:/sbin</string>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/karabiner-build.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/karabiner-build.log</string>
</dict>
</plist>
EOF
launchctl bootout "gui/$(id -u)" "$PLIST" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"

# --- build ------------------------------------------------------------------
say "Building karabiner.json"
(cd "$REPO" && yarn --silent build)

# Nudge Karabiner to reload if it's running
launchctl kickstart -k "gui/$(id -u)/org.pqrs.karabiner.karabiner_console_user_server" 2>/dev/null || true

# Reload Hammerspoon if it's already running so it picks up the linked config
# (its pathwatcher only fires on .lua edits, not on a new symlink).
if $HAVE_HS && pgrep -xq Hammerspoon && [ -x "$BREW_PREFIX/bin/hs" ]; then
        "$BREW_PREFIX/bin/hs" -t 3 -c "hs.reload()" </dev/null >/dev/null 2>&1 || true
fi

cat <<'EOF'

Done. Remaining manual steps:
  1. Open Karabiner-Elements once and approve its system extension + input
     monitoring prompts (System Settings > Privacy & Security).
  2. Open Hammerspoon, grant Accessibility, and enable "Launch at login".
     It must be running for the which-key HUD (hold Caps Lock or a sublayer
     key ~400ms), pinch-zoom and per-app mode switching.
  3. Optional: add iTerm to Login Items so Hyper+E / Hyper+I work right
     after boot (their hotkeys live in iTerm).
  4. Ideas capture (Hyper+I) writes to "~/Documents/Obsidian Vault/Ideas"
     and the todo list (Hyper+T) to "~/Documents/Obsidian Vault/todo.md" —
     edit VAULT in iterm/ideas.lua / TODO in iterm/todo.lua if yours differ.
  5. tmux users: append indicators/tmux-status.conf to your ~/.tmux.conf
     for the mode readout.

Customize keybindings in profiles/*.ts, then `yarn watch` while iterating.
EOF
