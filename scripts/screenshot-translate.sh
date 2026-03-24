#!/bin/bash
# Takes a window screenshot and translates any text in it via the
# 'Translate Screenshot' Shortcut (OCR → translate → clipboard + notification).
# Run scripts/create-translate-shortcut.py once to install the Shortcut.

# SCREENSHOT="/tmp/karabiner_translate.png"
# 
# rm -f "$SCREENSHOT"
# 
# # Capture a window (click to select)
# screencapture -W "$SCREENSHOT"
# 
# # Exit silently if user cancelled
# [ ! -f "$SCREENSHOT" ] && exit 0
# 
# Run the Shortcut — result is copied to clipboard and shown as a notification
shortcuts run "Translate Novel" --input-path "$SCREENSHOT"
