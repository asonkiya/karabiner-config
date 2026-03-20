import { KarabinerRules, Profile } from "../types";
import { createHyperSubLayers, app, open, window, shell, doubleTap, switchProfile, claudeCmd, vimCmd } from "../utils";

const rules: KarabinerRules[] = [
        // Define the Hyper key itself
        {
                description: "Hyper Key (⌃⌥⇧⌘)",
                manipulators: [
                        {
                                description: "Caps Lock -> Hyper Key",
                                type: "basic",
                                from: {
                                        key_code: "caps_lock",
                                        modifiers: {
                                                optional: ["any"],
                                        },
                                },
                                to: [
                                        {
                                                set_variable: {
                                                        name: "hyper",
                                                        value: 1,
                                                },
                                        },
                                ],
                                to_after_key_up: [
                                        {
                                                set_variable: {
                                                        name: "hyper",
                                                        value: 0,
                                                },
                                        },
                                ],
                                to_if_alone: [
                                        {
                                                key_code: "escape",
                                        },
                                ],
                        },
                ],
        },

        // iTerm2: Hyper + B -> Ctrl+B (tmux prefix)
        {
                description: "iTerm2: Hyper + B -> Tmux Prefix (Ctrl+B)",
                manipulators: [
                        {
                                type: "basic",
                                from: {
                                        key_code: "b",
                                        modifiers: { optional: ["any"] },
                                },
                                to: [{ key_code: "b", modifiers: ["left_control"] }],
                                conditions: [
                                        { type: "variable_if", name: "hyper", value: 1 },
                                        {
                                                type: "frontmost_application_if",
                                                bundle_identifiers: ["^com\\.googlecode\\.iterm2$"],
                                                description: "iTerm2",
                                        },
                                ],
                        },
                ],
        },

        // Double tap escape to return to Normal Mode
        // Extra condition prevents caps_lock's to_if_alone escape from triggering this
        doubleTap("escape", switchProfile("Normal Mode"), 300, [
                { type: "variable_unless", name: "hyper", value: 1 },
        ]),

        ...createHyperSubLayers({
                // l = Claude "L"LM commands
                l: {
                        r: {
                                description: "Claude: /resume",
                                to: [
                                        {
                                                shell_command: `osascript -e 'tell application "System Events" to keystroke "/resume"' && osascript -e 'tell application "System Events" to key code 36' && osascript -e 'tell application "System Events" to key code 36'`,
                                        },
                                ],
                        },
                        i: claudeCmd("/init"),
                        c: claudeCmd("/clear"),
                        h: claudeCmd("/help"),
                        b: claudeCmd("/bug"),
                        p: claudeCmd("/plan"),
                        k: claudeCmd("/commit"),
                        x: claudeCmd("exit"),
                        m: { description: "Shift+Tab", to: [{ key_code: "tab", modifiers: ["left_shift"] }] },
                },

                // s = "Session" tmux window switching (hjkl -> windows 1-4)
                // Sends Ctrl+B (prefix) then the window number
                s: {
                        j: { description: "Tmux: window 0", to: [{ key_code: "b", modifiers: ["left_control"] }, { key_code: "0" }] },
                        k: { description: "Tmux: window 1", to: [{ key_code: "b", modifiers: ["left_control"] }, { key_code: "1" }] },
                        l: { description: "Tmux: window 2", to: [{ key_code: "b", modifiers: ["left_control"] }, { key_code: "2" }] },
                        semicolon: { description: "Tmux: window 3", to: [{ key_code: "b", modifiers: ["left_control"] }, { key_code: "3" }] },
                        hyphen: {
                                description: "Tmux: kill session",
                                to: [
                                        { key_code: "b", modifiers: ["left_control"] },       // Ctrl+B (prefix)
                                        { key_code: "semicolon", modifiers: ["left_shift"] }, // :
                                        { key_code: "k" },
                                        { key_code: "i" },
                                        { key_code: "l" },
                                        { key_code: "l" },
                                        { key_code: "hyphen" },
                                        { key_code: "s" },
                                        { key_code: "e" },
                                        { key_code: "s" },
                                        { key_code: "s" },
                                        { key_code: "i" },
                                        { key_code: "o" },
                                        { key_code: "n" },
                                        { key_code: "return_or_enter" },
                                ],
                        },
                },
                v: {
                        h: {
                                to: [{ key_code: "left_arrow" }],
                        },
                        j: {
                                to: [{ key_code: "down_arrow" }],
                        },
                        k: {
                                to: [{ key_code: "up_arrow" }],
                        },
                        l: {
                                to: [{ key_code: "right_arrow" }],
                        },
                        // Magicmove via homerow.app
                        m: {
                                to: [{ key_code: "f", modifiers: ["right_control"] }],
                                // TODO: Trigger Vim Easymotion when VSCode is focused
                        },
                        // Scroll mode via homerow.app
                        s: {
                                to: [{ key_code: "j", modifiers: ["right_control"] }],
                        },
                        d: {
                                to: [{ key_code: "d", modifiers: ["right_shift", "right_command"] }],
                        },
                        u: {
                                to: [{ key_code: "page_down" }],
                        },
                        i: {
                                to: [{ key_code: "page_up" }],
                        },
                        // Vim commands
                        w: vimCmd("w"),        // save
                        q: vimCmd("q"),        // quit
                        x: vimCmd("wq"),       // save & quit
                        n: vimCmd("q!"),       // force quit (no save)
                        e: vimCmd("e!"),       // reload / discard changes
                        // Launch nvim in current directory
                        o: {
                                description: "Launch nvim .",
                                to: [{ shell_command: `osascript -e 'tell application "System Events" to keystroke "nvim ." & return'` }],
                        },
                },
        }),
];

export const programmingProfile: Profile = {
        name: "Programming Mode",
        complex_modifications: { rules },
};
