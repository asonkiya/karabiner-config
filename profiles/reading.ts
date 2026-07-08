import { KarabinerRules } from "../types";
import { chain, key, keyCode, click, delay, run, nativeKey, whenMode, hyperNotHeld } from "../utils";

// Reading mode: active while the `reading` variable is 1.
// Bare keys (no Hyper) drive a screenshot-translate workflow. Gated so they
// only remap while in reading mode and Hyper isn't held (so Hyper chords still
// work). Assembled into the single unified profile in normal.ts.
const readingConds = [...whenMode("reading"), hyperNotHeld];

export const readingRules: KarabinerRules[] = [
        {
                description: "Reading: 1 = Screenshot + Enter",
                manipulators: [{
                        type: "basic",
                        from: { key_code: "1" },
                        conditions: readingConds,
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
                        conditions: readingConds,
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
                        conditions: readingConds,
                        ...chain("Drag screenshot to translate", [
                                run("/opt/homebrew/bin/cliclick dd:1970,1248 dm:1496,327 w:100 du:1496,327"),
                        ]),
                }],
        },
        {
                description: "Reading: right arrow = Next chapter + remove old + screenshot + drag to translate",
                manipulators: [{
                        type: "basic",
                        from: { key_code: "right_arrow" },
                        conditions: readingConds,
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
