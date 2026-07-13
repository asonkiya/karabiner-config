import { KarabinerRules, Profile } from "../types";
import { createHyperSubLayers, app, open, window, shell, doubleTap, cmdSublayer, switchMode, appAndSwitchMode, whenNormal, whenMode } from "../utils";
import { vimMode, vimModeRules } from "./vim-mode";
import { programmingRules } from "./programming";
import { readingRules } from "./reading";
import { triviaRules } from "./trivia";

const rules: KarabinerRules[] = [
        // Define the Hyper key itself
        {
                description: "Hyper Key (⌃⌥⇧⌘)",
                manipulators: [
                        {
                                description: "Caps Lock -> Hyper Key",
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
                                type: "basic",
                        },
                        //      {
                        //        type: "basic",
                        //        description: "Disable CMD + Tab to force Hyper Key usage",
                        //        from: {
                        //          key_code: "tab",
                        //          modifiers: {
                        //            mandatory: ["right_command"],
                        //          },
                        //        },
                        //        to: [
                        //          {
                        //            key_code: "tab",
                        //          },
                        //        ],
                        //      },
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
                                        modifiers: {
                                                optional: ["any"],
                                        },
                                },
                                to: [
                                        {
                                                key_code: "b",
                                                modifiers: ["left_control"],
                                        },
                                ],
                                conditions: [
                                        {
                                                type: "variable_if",
                                                name: "hyper",
                                                value: 1,
                                        },
                                        {
                                                type: "frontmost_application_if",
                                                bundle_identifiers: ["^com\\.googlecode\\.iterm2$"],
                                                description: "iTerm2",
                                        },
                                ],
                        },
                ],
        },
        ...createHyperSubLayers({
                semicolon: open("raycast://extensions/the-browser-company/arc/search-space-tabs"),
                spacebar: app("Raycast"),
                //                escape: shell`
                //                                "/Library/Application Support/org.pqrs/Karabiner-Elements/bin/karabiner_cli" --select-profile "test"
                //                             `,
                // l (lookup), o (open apps) and w (window) are now GLOBAL — see
                // globalNavLayers below, spread after the mode fragments so they
                // work in every mode (and mode overrides can win where needed).

                // TODO: This doesn't quite work yet.
                // l = "Layouts" via Raycast's custom window management
                // l: {
                //   // Coding layout
                //   c: shell`
                //     open -a "Visual Studio Code.app"
                //     sleep 0.2
                //     open -g "raycast://customWindowManagementCommand?position=topLeft&relativeWidth=0.5"

                //     open -a "Terminal.app"
                //     sleep 0.2
                //     open -g "raycast://customWindowManagementCommand?position=topRight&relativeWidth=0.5"
                //   `,
                // },

                // s = "System"
                s: {
                        i: {
                                to: [
                                        {
                                                key_code: "volume_increment",
                                        },
                                ],
                        },
                        k: {
                                to: [
                                        {
                                                key_code: "volume_decrement",
                                        },
                                ],
                        },
                        m: {
                                to: [
                                        {
                                                key_code: "mute",
                                        },
                                ],
                        },
                        u: {
                                to: [
                                        {
                                                key_code: "display_brightness_increment",
                                        },
                                ],
                        },
                        j: {
                                to: [
                                        {
                                                key_code: "display_brightness_decrement",
                                        },
                                ],
                        },
                        p: {
                                to: [
                                        {
                                                key_code: "play_or_pause",
                                        },
                                ],
                        },
                        // "D"o not disturb toggle
                        c: open("raycast://extensions/raycast/system/open-camera"),
                        // "H"earbuds control via Raycast's Airpods Noise Control extension
                        h: open("raycast://extensions/chrahe/airpods-noise-control/index"),

                        // 'v'oice
                        v: {
                                to: [
                                        {
                                                key_code: "spacebar",
                                                modifiers: ["left_option"],
                                        },
                                ],
                        },

                },

                // v = "moVe" which isn't "m" because we want it to be on the left hand
                // so that hjkl work like they do in vim
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
                        w: { description: "Move word forward", to: [{ shell_command: `osascript -e 'tell application "System Events" to key code 124 using option down'` }] },
                        b: { description: "Move word backward", to: [{ shell_command: `osascript -e 'tell application "System Events" to key code 123 using option down'` }] },
                        close_bracket: {
                                to: [{ key_code: "page_down" }],
                        },
                        open_bracket: {
                                to: [{ key_code: "page_up" }],
                        },
                },

                // WhatsApp: Hyper+hjk; -> Cmd+1234 (chat switching)
                // Note: l is taken by the lookup sublayer, so ; is used for Cmd+4
                h: { to: [{ key_code: "1", modifiers: ["right_command"] }], conditions: [{ type: "frontmost_application_if", bundle_identifiers: ["^net\\.whatsapp\\.WhatsApp$"] }] },
                j: { to: [{ key_code: "2", modifiers: ["right_command"] }], conditions: [{ type: "frontmost_application_if", bundle_identifiers: ["^net\\.whatsapp\\.WhatsApp$"] }] },
                k: { to: [{ key_code: "3", modifiers: ["right_command"] }], conditions: [{ type: "frontmost_application_if", bundle_identifiers: ["^net\\.whatsapp\\.WhatsApp$"] }] },

                // a = "AI" tools
                a: {
                        c: app("Claude"),
                        g: app("ChatGPT"),
                },

                // i = "Ideas" quick capture via Raycast
                i: open("raycast://extensions/asonkiya/idea-capture/capture"),

                // m = "Modes" — enter a mode from Normal. (From within a mode,
                // bare Hyper+M jumps back to Normal; see the escape hatches below.)
                m: {
                        p: switchMode("programming"),
                        r: switchMode("reading"),
                        t: switchMode("trivia"),
                },

                // c = Cmd + key passthrough
                c: cmdSublayer(),

                // y/p/u = copy/paste/undo (vim-style)
                y: { description: "Copy (Cmd+C)", to: [{ key_code: "c", modifiers: ["right_command"] }] },
                p: { description: "Paste (Cmd+V)", to: [{ key_code: "v", modifiers: ["right_command"] }] },
                u: { description: "Undo (Cmd+Z)", to: [{ shell_command: `osascript -e 'tell application "System Events" to keystroke "z" using command down'` }] },

                // r = "Raycast"
                r: {
                        e: open(
                                "raycast://extensions/raycast/emoji-symbols/search-emoji-symbols"
                        ),
                        p: open("raycast://extensions/raycast/raycast/confetti"),
                        h: open(
                                "raycast://extensions/raycast/clipboard-history/clipboard-history"
                        ),
                },

                slash: { description: "Find (Cmd+F)", to: [{ key_code: "f", modifiers: ["right_command"] }] },

                // f -> Cmd+L
                f: { description: "Cmd+L", to: [{ key_code: "l", modifiers: ["left_command"] }] },

                // Quick window actions
                q: { description: "Cmd+Q (Quit)", to: [{ key_code: "q", modifiers: ["right_command"] }] },
                d: { description: "Cmd+W (Close)", to: [{ key_code: "w", modifiers: ["right_command"] }] },
                n: { description: "Cmd+T (New Tab)", to: [{ key_code: "t", modifiers: ["right_command"] }] },
        }, whenNormal),

        // Escape hatch: from within ANY mode, bare Hyper+M jumps back to Normal
        // (one per mode since Karabiner conditions can't OR). Gated to each mode
        // so in Normal, Hyper+M is the mode-enter sublayer above instead.
        ...createHyperSubLayers({ m: switchMode("normal") }, whenMode("programming")),
        ...createHyperSubLayers({ m: switchMode("normal") }, whenMode("reading")),
        ...createHyperSubLayers({ m: switchMode("normal") }, whenMode("trivia")),

        // Vim mode toggle — available in every mode (Hyper+Enter to enter,
        // i or Escape to exit; see vimModeRules).
        ...createHyperSubLayers({ return_or_enter: vimMode.enable() }),

        // Mode-specific rules, each gated behind its own mode variable.
        ...programmingRules,
        ...readingRules,
        ...triviaRules,

        // Global navigation: lookup (l), open apps (o), window (w) — available
        // in EVERY mode so you can always jump to another app / manage windows.
        // Spread AFTER the mode fragments so a mode's per-key override (e.g.
        // Programming's O+G = Godot) wins over the global default here.
        ...createHyperSubLayers({
                // l = "L"ookup
                l: {
                        i: open("https://www.instagram.com/direct/t/5082114295174947/"),
                        d: app("Photo Booth"),
                        y: open("https://youtube.com"),
                        m: open("https://music.youtube.com"),
                        t: open("https://mychtransit.org/map"),
                        n: open("http://localhost:8080/"),
                        s: open("https://twitch.tv"),
                        c: open("https://canvas.unc.edu"),
                        g: open("https://github.com"),
                },
                // o = "Open" applications
                o: {
                        g: app("/Applications/Arc"),
                        e: app("Microsoft Outlook"),
                        d: app("Discord"),
                        n: app("ZenNotes"),
                        t: appAndSwitchMode("iTerm", "programming"),
                        z: app("zoom.us"),
                        r: app("Rstudio"),
                        f: app("Finder"),
                        m: app("Messages"),
                        p: app("iPhone Mirroring"),
                        c: app("Screenshot"),
                        v: app("Surfshark"),
                        // I will never understand why WhatsApp doesn't have a proper Mac app, but this is the best we can do for now
                        w: open("/Applications/WhatsApp.localized/WhatsApp.app"),
                },
                // w = "Window"
                w: {
                        semicolon: { description: "Window: Hide", to: [{ key_code: "h", modifiers: ["right_command"] }] },
                        j: { description: "Window: Ctrl + Left Arrow", to: [{ key_code: "left_arrow", modifiers: ["control"] }] },
                        k: { description: "Window: Ctrl + Right Arrow", to: [{ key_code: "right_arrow", modifiers: ["control"] }] },
                        m: window("maximize"),
                        f: { description: "Window: Fullscreen", to: [{ key_code: "f", modifiers: ["right_control", "right_command"] }] },
                        // Zoom using u and i for shift plus and minus for better ergonomics
                        i: { description: "Window: Zoom In", to: [{ key_code: "equal_sign", modifiers: ["right_shift", "right_command"] }] },
                        o: { description: "Window: Zoom Out", to: [{ key_code: "hyphen", modifiers: ["right_shift", "right_command"] }] },
                        // u = Mission Control (3-finger swipe up), n = App Exposé (3-finger down)
                        u: { description: "Mission Control", to: [{ key_code: "mission_control" }] },
                        n: { description: "App Exposé", to: [{ key_code: "down_arrow", modifiers: ["control"] }] },
                        // l = Cmd+Tab app switcher
                        l: { description: "App Switcher (Cmd+Tab)", to: [{ key_code: "tab", modifiers: ["right_command"] }] },
                },
        }),
        //        {
        //                description: "Change Backspace to Spacebar when Minecraft is focused",
        //                manipulators: [
        //                        {
        //                                type: "basic",
        //                                from: {
        //                                        key_code: "delete_or_backspace",
        //                                },
        //                                to: [
        //                                        {
        //                                                key_code: "spacebar",
        //                                        },
        //                                ],
        //                                conditions: [
        //                                        {
        //                                                type: "frontmost_application_if",
        //                                                file_paths: [
        //                                                        "^/Users/mxstbr/Library/Application Support/minecraft/runtime/java-runtime-gamma/mac-os-arm64/java-runtime-gamma/jre.bundle/Contents/Home/bin/java$",
        //                                                ],
        //                                        },
        //                                ],
        //                        },
        //                ],
        //        },

        // Vim mode (Hyper+Enter to enter, I or Escape to exit)
        ...vimModeRules,
];

export const normalProfile: Profile = {
        name: "Normal",
        virtual_hid_keyboard: {
                keyboard_type_v2: "ansi",
        },
        complex_modifications: {
                rules,
        },
};
