import { readFileSync } from "fs";
import { KarabinerRules, KeyCode } from "../types";
import { bareKey, HudIcon, HyperKeySublayer, LayerCommand, whenMode, hyperNotHeld } from "../utils";

// The daily games. They live in trivia/games.json rather than here so that
// trivia/games.py can add one (the frontmost browser tab, next free key) or
// remove some without anyone touching code; it rebuilds afterwards. An
// optional `icon` covers sites with no favicon on Google's service.
type Game = { key: KeyCode; name: string; url: string; icon?: HudIcon };
export const games: Game[] = JSON.parse(readFileSync(new URL("../trivia/games.json", import.meta.url), "utf8"));

const GAMES_PY = "/Users/aryaman/github/karabiner-config/trivia/games.py";

function play(g: Game): LayerCommand {
        return { description: g.name, icon: g.icon, to: [{ shell_command: `open ${g.url}` }] };
}

// Hyper+G: the games wheel, in every mode but Programming (where G is Git —
// normal.ts gates it). Digits inner ring, letters outer; = adds the current
// tab, - removes games.
export const gamesSublayer: HyperKeySublayer = {
        icon: { symbol: "gamecontroller.fill" },
        order: games.map((g) => g.key),
        ...Object.fromEntries(games.map((g) => [g.key, play(g)])),
        equal_sign: {
                description: "Add current tab as a game",
                icon: { symbol: "plus.circle" },
                to: [{ shell_command: `${GAMES_PY} add` }],
        },
        hyphen: {
                description: "Remove games…",
                icon: { symbol: "minus.circle" },
                to: [{ shell_command: `${GAMES_PY} remove` }],
        },
};

// Trivia mode: active while the `trivia` variable is 1. The same games on
// bare keys (no Hyper), x closes the tab. Gated so they only remap while in
// trivia mode and Hyper isn't held. Assembled into the single unified profile
// in normal.ts. The HUD shows them as the mode's `_keys` wheel the moment
// Trivia is entered — nothing to hold; cheatsheet.ts builds it from these rules.
const triviaConds = [...whenMode("trivia"), hyperNotHeld];

export const triviaRules: KarabinerRules[] = [
        ...games.map((g): KarabinerRules => ({
                description: `Trivia: ${g.key} = ${g.name}`,
                manipulators: [bareKey(g.key, play(g), triviaConds)],
        })),
        {
                description: "Trivia: x = Close tab",
                manipulators: [bareKey("x", { to: [{ key_code: "w", modifiers: ["right_command"] }] }, triviaConds)],
        },
];
