import { KeyCode } from "../types";
import { HyperKeySublayer } from "../utils";

// Hyper+J: the live tmux sessions as a wheel, one key each, computed when the
// wheel is shown by tmux/sessions.py (which also answers the key presses, so
// the keys it shows are the keys that work). J N steps into "new session":
// the projects (dirs with a .envrc under its ROOTS) that have no session
// yet; one opens an iTerm2 window there and the .envrc does the rest.
// normal.ts offers it inside iTerm2 in any mode, and anywhere in Programming.
const SESSIONS_PY = "/Users/aryaman/github/karabiner-config/tmux/sessions.py";

// The keys sessions.py hands out (KEYS there), in the same order: no j
// (held) and no n (the step).
const KEYS = [..."abcdefghiklmopqrstuvwxyz1234567890"] as KeyCode[];

export const sessionsSublayer: HyperKeySublayer = {
        icon: { symbol: "rectangle.split.3x1" },
        dynamic: {
                list: `${SESSIONS_PY} list`,
                run: `${SESSIONS_PY} go`,
                keys: KEYS,
                description: "Switch to that tmux session (its iTerm2 window, or a new one)",
        },
        steps: {
                n: {
                        description: "New session…",
                        icon: { symbol: "plus.rectangle.on.folder" },
                        dynamic: {
                                list: `${SESSIONS_PY} projects`,
                                run: `${SESSIONS_PY} new`,
                                keys: KEYS,
                                description: "Open that project in a new iTerm2 window (its .envrc starts the session)",
                        },
                },
        },
};
