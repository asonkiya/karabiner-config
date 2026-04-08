import { KarabinerRules } from "../types";
import { createMode } from "../utils";

export const vimMode = createMode("vim_mode");

export const vimModeRules: KarabinerRules[] = vimMode.apply([
        {
                description: "Vim Mode: hjkl movement",
                manipulators: [
                        { type: "basic", from: { key_code: "h" }, to: [{ key_code: "left_arrow" }] },
                        { type: "basic", from: { key_code: "j" }, to: [{ key_code: "down_arrow" }] },
                        { type: "basic", from: { key_code: "k" }, to: [{ key_code: "up_arrow" }] },
                        { type: "basic", from: { key_code: "l" }, to: [{ key_code: "right_arrow" }] },
                ],
        },
        {
                description: "Vim Mode: w/b word movement",
                manipulators: [
                        { type: "basic", from: { key_code: "w" }, to: [{ key_code: "right_arrow", modifiers: ["left_option"] }] },
                        { type: "basic", from: { key_code: "b" }, to: [{ key_code: "left_arrow", modifiers: ["left_option"] }] },
                ],
        },
        {
                description: "Vim Mode: 0/e line start/end",
                manipulators: [
                        { type: "basic", from: { key_code: "0" }, to: [{ key_code: "left_arrow", modifiers: ["left_command"] }] },
                        { type: "basic", from: { key_code: "e" }, to: [{ key_code: "right_arrow", modifiers: ["left_command"] }] },
                ],
        },
        {
                description: "Vim Mode: [ / ] document start/end",
                manipulators: [
                        { type: "basic", from: { key_code: "open_bracket" }, to: [{ key_code: "up_arrow", modifiers: ["left_command"] }] },
                        { type: "basic", from: { key_code: "close_bracket" }, to: [{ key_code: "down_arrow", modifiers: ["left_command"] }] },
                ],
        },
        {
                description: "Vim Mode: x delete forward, d delete backward, u undo",
                manipulators: [
                        { type: "basic", from: { key_code: "x" }, to: [{ key_code: "delete_forward" }] },
                        { type: "basic", from: { key_code: "d" }, to: [{ key_code: "delete_or_backspace" }] },
                        { type: "basic", from: { key_code: "u" }, to: [{ key_code: "z", modifiers: ["left_command"] }] },
                        { type: "basic", from: { key_code: "y" }, to: [{ key_code: "c", modifiers: ["left_command"] }] },
                        { type: "basic", from: { key_code: "p" }, to: [{ key_code: "v", modifiers: ["left_command"] }] },
                        // Y = yank + paste (duplicate line)
                        {
                                type: "basic",
                                from: { key_code: "y", modifiers: { mandatory: ["left_shift"] } },
                                to: [
                                        { key_code: "left_arrow", modifiers: ["left_command"] },          // beginning of line
                                        { key_code: "right_arrow", modifiers: ["left_command", "left_shift"] }, // select to end
                                        { key_code: "c", modifiers: ["left_command"] },                   // copy
                                        { key_code: "right_arrow", modifiers: ["left_command"] },         // end of line
                                        { key_code: "return_or_enter" },                                  // new line
                                        { key_code: "v", modifiers: ["left_command"] },                   // paste
                                ],
                        },
                ],
        },
        {
                description: "Vim Mode: s select word, v select line",
                manipulators: [
                        { type: "basic", from: { key_code: "s" }, to: [{ key_code: "right_arrow", modifiers: ["left_option", "left_shift"] }] },
                        { type: "basic", from: { key_code: "v" }, to: [{ key_code: "left_arrow", modifiers: ["left_command"] }, { key_code: "right_arrow", modifiers: ["left_command", "left_shift"] }] },
                ],
        },
        {
                description: "Vim Mode: o / O open line below / above",
                manipulators: [
                        // O first (more specific — requires shift) so it takes priority over o
                        {
                                type: "basic",
                                from: { key_code: "o", modifiers: { mandatory: ["left_shift"] } },
                                to: [
                                        { key_code: "left_arrow", modifiers: ["left_command"] }, // beginning of line
                                        { key_code: "return_or_enter" },                          // push line down
                                        { key_code: "up_arrow" },                                 // move up to new line
                                        ...vimMode.disable().to,
                                ],
                        },
                        {
                                type: "basic",
                                from: { key_code: "o" },
                                to: [
                                        { key_code: "right_arrow", modifiers: ["left_command"] }, // end of line
                                        { key_code: "return_or_enter" },                           // new line below
                                        ...vimMode.disable().to,
                                ],
                        },
                ],
        },
        {
                description: "Vim Mode: i / escape exits to insert mode",
                manipulators: [
                        { type: "basic", from: { key_code: "i" }, to: [...vimMode.disable().to] },
                        { type: "basic", from: { key_code: "escape" }, to: [...vimMode.disable().to, { key_code: "escape" }] },
                ],
        },
]);
