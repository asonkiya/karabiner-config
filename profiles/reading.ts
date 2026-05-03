import { KarabinerRules, Profile } from "../types";
import { createHyperSubLayers, app, open, switchProfile } from "../utils";

const TRANSLATE_SCRIPT = `${process.env.HOME}/github/karabiner-config/scripts/screenshot-translate.sh`;

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

                // s = Screenshot (area selection, saves to Desktop)
                s: {
                        description: "Screenshot: app selection",
                        to: [{ key_code: "5", modifiers: ["right_command", "left_shift"] }],
                },

                // a = open Arc
                a: app("Arc"),

                // t = screenshot → Google Translate image translation
                t: {
                        description: "Screenshot → Google Translate",
                        to: [{ shell_command: `bash "${TRANSLATE_SCRIPT}"` }],
                },

                // c = type cereal aisle question
                c: {
                        description: "Type cereal aisle question",
                        to: [{ shell_command: `python3 -c "import time,subprocess;msg='Whats the interactions in the cereal aisle been like'
for c in msg:
 subprocess.run(['osascript','-e','tell application \"System Events\" to keystroke \"'+c+'\"']);time.sleep(0.02)"` }],
                },
        }),
];

export const readingProfile: Profile = {
        name: "Reading",
        complex_modifications: { rules },
};
