import { KarabinerRules, Profile } from "../types";
import { createHyperSubLayers, switchProfile } from "../utils";

const games: [string, string, string][] = [
        // Number keys
        ["1", "Catfishing",     "https://catfishing.net"],
        ["2", "Thrice",         "https://thrice.geekswhodrink.com"],
        ["3", "Wordle",         "https://www.nytimes.com/games/wordle"],
        ["4", "Connections",    "https://www.nytimes.com/games/connections"],
        ["5", "Strands",        "https://www.nytimes.com/games/strands"],
        ["6", "FoodGuessr",     "https://www.foodguessr.com"],
        ["7", "TimeGuessr",     "https://timeguessr.com"],
        ["8", "Mini Crossword", "https://www.nytimes.com/crosswords/game/mini"],
        ["9", "Spelling Bee",   "https://www.nytimes.com/puzzles/spelling-bee"],
        ["0", "GeoGuessr",      "https://www.geoguessr.com/daily-challenge"],
        // Letter keys
        ["a", "Bandle",         "https://bandle.app"],
        ["s", "Costcodle",      "https://costcodle.com"],
        ["d", "Tradle",         "https://oec.world/en/tradle"],
        ["f", "Heardle",        "https://www.heardle.app"],
        ["g", "Framed",         "https://framed.wtf"],
        ["q", "Pokedoku",       "https://pokedoku.com"],
        ["w", "Contexto",       "https://contexto.me"],
        ["e", "Redactle",       "https://www.redactle.com"],
        ["r", "Worldle",        "https://worldle.teuteuf.fr"],
];

const gameRules: KarabinerRules[] = games.map(([key, name, url]) => ({
        description: `Trivia: ${key} = ${name}`,
        manipulators: [{
                type: "basic" as const,
                from: { key_code: key as any },
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
