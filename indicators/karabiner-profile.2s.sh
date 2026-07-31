#!/bin/bash

# SwiftBar plugin: shows the active Karabiner *mode* (variable-based, instant),
# not the profile. Modes live in a single profile and are toggled via variables
# that write /tmp/karabiner_mode_<name> flag files (see karabiner-config
# utils.ts). Symlinked into the SwiftBar plugin folder by setup.sh.

if [ -f /tmp/karabiner_mode_trivia ]; then
    MODE="Trivia"
elif [ -f /tmp/karabiner_mode_reading ]; then
    MODE="Reading"
elif [ -f /tmp/karabiner_mode_programming ]; then
    MODE="Programming"
else
    MODE="Normal"
fi

[ -f /tmp/karabiner_mode_vim_mode ] && MODE="${MODE} · VIM"

echo "⌨ ${MODE}"
