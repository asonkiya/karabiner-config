import { KarabinerRules, KeyCode } from "../types";
import { bareKey, HudIcon, whenMode, hyperNotHeld } from "../utils";

// Trivia mode: active while the `trivia` variable is 1.
// Bare keys open a daily game; x closes the tab. Gated so they only remap
// while in trivia mode and Hyper isn't held. Assembled into the single unified
// profile in normal.ts. The HUD shows them as the mode's `_keys` wheel the
// moment Trivia is entered (digits inner ring, letters outer, favicons) —
// nothing to hold; cheatsheet.ts builds it from these rules.
const triviaConds = [...whenMode("trivia"), hyperNotHeld];

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

// Sites with no favicon on Google's service get a symbol instead of the globe.
const gameIcons: Partial<Record<KeyCode, HudIcon>> = {
        f: { symbol: "music.note" },      // Heardle
        e: { symbol: "text.redaction" },  // Redactle
};

export const triviaRules: KarabinerRules[] = [
        // Direct key bindings for each game
        ...games.map(([key, name, url]): KarabinerRules => ({
                description: `Trivia: ${key} = ${name}`,
                manipulators: [bareKey(key as KeyCode, {
                        to: [{ shell_command: `open ${url}` }],
                        icon: gameIcons[key as KeyCode],
                }, triviaConds)],
        })),
        // x = close tab (Cmd+W)
        {
                description: "Trivia: x = Close tab",
                manipulators: [bareKey("x", { to: [{ key_code: "w", modifiers: ["right_command"] }] }, triviaConds)],
        },
];
