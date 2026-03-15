import fs from "fs";
import { KarabinerRules } from "./types";
import { createHyperSubLayers, app, open, window, shell } from "./utils";

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
        ...createHyperSubLayers({
                semicolon: open("raycast://extensions/the-browser-company/arc/search-space-tabs"),
                // b = "B"rowse
                b: {
                        i: open("https://www.instagram.com/direct/t/5082114295174947/"),
                        d: open("https://doordash.com"),
                        y: open("https://youtube.com"),
                        t: open("https://mychtransit.org/map"),
                        n: open("http://localhost:8080/"),
                        s: open("https://twitch.tv"),
                        c: open("https://canvas.unc.edu"),
                },
                // o = "Open" applications
                o: {
                        a: app("/Applications/Arc"),
                        e: app("Microsoft Outlook"),
                        d: app("Discord"),
                        n: app("Obsidian"),
                        t: app("iTerm"),
                        z: app("zoom.us"),
                        r: app("Rstudio"),
                        f: app("Finder"),
                        m: app("Messages"),
                        p: app("iPhone Mirroring"),
                        c: app("ChatGPT"),
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
                        y: window("previous-display"),
                        o: window("next-display"),
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

                        //                         h: {
                        //                                 description: "Window: Left Arrow",
                        //                                 to: [
                        //                                         {
                        //                                                 key_code: "left_arrow",
                        //                                         },
                        //                                 ],
                        //                         },
                        // 
                        //                         l: {
                        //                                 description: "Window: Right Arrow",
                        //                                 to: [
                        //                                         {
                        //                                                 key_code: "right_arrow",
                        //                                         },
                        //                                 ],
                        //                         },
                        f: window("maximize"),
                        u: {
                                description: "Window: Previous Tab",
                                to: [
                                        {
                                                key_code: "tab",
                                                modifiers: ["right_control", "right_shift"],
                                        },
                                ],
                        },
                        i: {
                                description: "Window: Next Tab",
                                to: [
                                        {
                                                key_code: "tab",
                                                modifiers: ["right_control"],
                                        },
                                ],
                        },
                        n: {
                                description: "Window: Next Window",
                                to: [
                                        {
                                                key_code: "grave_accent_and_tilde",
                                                modifiers: ["right_command"],
                                        },
                                ],
                        },
                        b: {
                                description: "Window: Back",
                                to: [
                                        {
                                                key_code: "open_bracket",
                                                modifiers: ["right_command"],
                                        },
                                ],
                        },
                        // Note: No literal connection. Both f and n are already taken.
                        m: {
                                description: "Window: Forward",
                                to: [
                                        {
                                                key_code: "close_bracket",
                                                modifiers: ["right_command"],
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
                        semicolon: {
                                to: [
                                        {
                                                key_code: "fastforward",
                                        },
                                ],
                        },
                        // "D"o not disturb toggle
                        d: open(
                                `raycast://extensions/yakitrak/do-not-disturb/toggle?launchType=background`
                        ),
                        c: open("raycast://extensions/raycast/system/open-camera"),
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
                        u: {
                                to: [{ key_code: "page_down" }],
                        },
                        i: {
                                to: [{ key_code: "page_up" }],
                        },
                },

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

fs.writeFileSync(
        "karabiner.json",
        JSON.stringify(
                {
                        global: {
                                show_in_menu_bar: false,
                        },
                        profiles: [
                                {
                                        name: "Default",
                                        virtual_hid_keyboard: {
                                                keyboard_type_v2: "ansi",
                                        },
                                        complex_modifications: {
                                                rules,
                                        },
                                },
                        ],
                },
                null,
                2
        )
);
