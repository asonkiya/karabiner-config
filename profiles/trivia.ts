import { KarabinerRules, Profile } from "../types";
import { createHyperSubLayers, switchProfile } from "../utils";

const games: [string, string][] = [
        ["Catfishing",    "https://catfishing.net"],
        ["Thrice",        "https://thrice.geekswhodrink.com"],
        ["Wordle",        "https://www.nytimes.com/games/wordle"],
        ["Connections",   "https://www.nytimes.com/games/connections"],
        ["Strands",       "https://www.nytimes.com/games/strands"],
        ["FoodGuessr",    "https://www.foodguessr.com"],
        ["TimeGuessr",    "https://timeguessr.com"],
        ["Mini Crossword","https://www.nytimes.com/crosswords/game/mini"],
        ["Spelling Bee",  "https://www.nytimes.com/puzzles/spelling-bee"],
        ["Globle",        "https://globle-game.com"],
];

const gameKeys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"] as const;

const gameRules: KarabinerRules[] = games.map(([name, url], i) => ({
        description: `Trivia: ${gameKeys[i]} = ${name}`,
        manipulators: [{
                type: "basic" as const,
                from: { key_code: gameKeys[i] as any },
                to: [{ shell_command: `open ${url}` }],
        }],
}));

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

        // x = close tab (Cmd+W)
        {
                description: "Trivia: x = Close tab",
                manipulators: [{
                        type: "basic",
                        from: { key_code: "x" },
                        to: [{ key_code: "w", modifiers: ["right_command"] }],
                }],
        },

        // Direct key bindings for each game
        ...gameRules,
];

export const triviaProfile: Profile = {
        name: "Trivia",
        complex_modifications: { rules },
};
