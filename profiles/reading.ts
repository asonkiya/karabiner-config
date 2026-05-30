import { KarabinerRules, Profile } from "../types";
import { createHyperSubLayers, app, open, switchProfile, chain, key, keyCode, click, drag, scroll, delay, run, nativeKey } from "../utils";

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
                                        modifiers: { optional: ["any"] },
                                },
                                to: [{ set_variable: { name: "hyper", value: 1 } }],
                                to_after_key_up: [{ set_variable: { name: "hyper", value: 0 } }],
                                to_if_alone: [{ key_code: "escape" }],
                        },
                ],
        },

        ...createHyperSubLayers({
                // m = switch back to Normal Mode
                m: switchProfile("Normal"),
        }),

        // Reading mode direct keys (no Hyper needed)
        // Individual steps for now — combine once coordinates are dialed in
        {
                description: "Reading: 1 = Screenshot + Enter",
                manipulators: [{
                        type: "basic",
                        from: { key_code: "1" },
                        ...chain("Screenshot + Enter", [
                                nativeKey("5" as any, ["right_command", "left_shift"]),
                                delay(500),
                                keyCode(36),
                        ]),
                }],
        },
        {
                description: "Reading: 2 = Open Arc",
                manipulators: [{
                        type: "basic",
                        from: { key_code: "2" },
                        ...chain("Open Arc", [
                                run("open -a 'Arc.app'"),
                        ]),
                }],
        },
        {
                description: "Reading: 3 = Drag preview to translate",
                manipulators: [{
                        type: "basic",
                        from: { key_code: "3" },
                        ...chain("Drag screenshot to translate", [
                                run("/opt/homebrew/bin/cliclick dd:1970,1248 dm:1496,327 w:100 du:1496,327"),
                        ]),
                }],
        },
        {
                description: "Reading: 4 = Next chapter + remove old + screenshot + drag to translate",
                manipulators: [{
                        type: "basic",
                        from: { key_code: "right_arrow" },
                        ...chain("Full translate cycle", [
                                // Click next chapter
                                click(974, 681),
                                delay(100),
                                // Click translate tab area
                                click(1547, 77),
                                delay(50),
                                // Scroll to top (Cmd+Up)
                                keyCode(126, ["command"]),
                                delay(200),
                                // Vimium: f then w to remove old chapter
                                key("f"),
                                delay(100),
                                key("w"),
                                // Take screenshot via cliclick key press
                                run("/opt/homebrew/bin/cliclick kd:cmd,shift t:5 ku:cmd,shift"),
                                delay(100),
                                // Press enter to capture
                                keyCode(36),
                                delay(700),
                                // Drag preview to translate
                                run("/opt/homebrew/bin/cliclick dd:1970,1248 dm:1496,327 w:100 du:1496,327"),
                        ]),
                }],
        },
];

export const readingProfile: Profile = {
        name: "Reading",
        complex_modifications: { rules },
};
