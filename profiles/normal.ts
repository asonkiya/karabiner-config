import { KarabinerRules, Profile } from "../types";
import { createHyperSubLayers, app, open, window, shell, switchProfile, appAndSwitch, doubleTap } from "../utils";

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
                        //            mandatory: ["left_command"],
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
                // l = "L"ookup
                l: {
                        i: open("https://www.instagram.com/direct/t/5082114295174947/"),
                        d: open("https://doordash.com"),
                        y: open("https://youtube.com"),
                        t: open("https://mychtransit.org/map"),
                        n: open("http://localhost:8080/"),
                        s: open("https://twitch.tv"),
                        c: open("https://canvas.unc.edu"),
                        g: open("raycast://extensions/the-browser-company/arc/new-incognito-window"),

                },
                // o = "Open" applications
                o: {
                        g: app("/Applications/Arc"),
                        e: app("Microsoft Outlook"),
                        d: app("Discord"),
                        n: app("Obsidian"),
                        t: appAndSwitch("iTerm", "Programming"),
                        z: app("zoom.us"),
                        r: app("Rstudio"),
                        f: app("Finder"),
                        m: app("Messages"),
                        p: app("iPhone Mirroring"),
                        c: app("Screenshot"),
                        a: app("ChatGPT"),
                        v: app("Surfshark"),
                        // I will never understand why WhatsApp doesn't have a proper Mac app, but this is the best we can do for now
                        w: open("/Applications/WhatsApp.localized/WhatsApp.app"),
                },

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

                // w = "Window"
                w: {
                        semicolon: {
                                description: "Window: Hide",
                                to: [
                                        {
                                                key_code: "h",
                                                modifiers: ["right_command"],
                                        },
                                ],
                        },
                        j: {
                                description: "Window: Ctrl + Left Arrow",
                                to: [
                                        {
                                                key_code: "left_arrow",
                                                modifiers: ["control"],
                                        },
                                ],
                        },
                        k: {
                                description: "Window: Ctrl + Right Arrow",
                                to: [
                                        {
                                                key_code: "right_arrow",
                                                modifiers: ["control"],
                                        },
                                ],
                        },
                        m: window("maximize"),
                        f: {
                                description: "Window: Fullscreen",
                                to: [
                                        {
                                                key_code: "f",
                                                modifiers: ["right_control", "right_command"],
                                        },
                                ],
                        },
                        // Zoom using u and i for shift plus and minus for better ergonomics
                        i: {
                                description: "Window: Zoom In",
                                to: [
                                        {
                                                key_code: "equal_sign",
                                                modifiers: ["right_shift", "right_command"],
                                        },
                                ],
                        },
                        o: {
                                description: "Window: Zoom Out",
                                to: [
                                        {
                                                key_code: "hyphen",
                                                modifiers: ["right_shift", "right_command"],
                                        },
                                ],
                        },
                },

                // s = "System"
                s: {
                        u: {
                                to: [
                                        {
                                                key_code: "volume_increment",
                                        },
                                ],
                        },
                        j: {
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
                        i: {
                                to: [
                                        {
                                                key_code: "display_brightness_increment",
                                        },
                                ],
                        },
                        k: {
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
                        i: {
                                to: [{ key_code: "page_down" }],
                        },
                        o: {
                                to: [{ key_code: "page_up" }],
                        },
                },

                // m = "Modes" profile switching
                m: {
                        c: switchProfile("Programming"),
                        r: switchProfile("Reading"),
                },

                // y/p = copy/paste (vim-style)
                y: { description: "Copy (Cmd+C)", to: [{ key_code: "c", modifiers: ["left_command"] }] },
                p: { description: "Paste (Cmd+V)", to: [{ key_code: "v", modifiers: ["left_command"] }] },

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

                // Quick window actions
                q: { description: "Cmd+Q (Quit)", to: [{ key_code: "q", modifiers: ["left_command"] }] },
                d: { description: "Cmd+W (Close)", to: [{ key_code: "w", modifiers: ["left_command"] }] },
                t: { description: "Cmd+T (New Tab)", to: [{ key_code: "t", modifiers: ["left_command"] }] },
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
