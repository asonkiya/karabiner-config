import fs from "fs";
import { normalProfile } from "./profiles/normal";
import { Manipulator, To, KarabinerRules } from "./types";

// ---------------------------------------------------------------------------
// Cheatsheet generator
//
// Walks the assembled `normalProfile` (the same object `yarn build` emits) and
// renders CHEATSHEET.md: every Hyper sublayer, direct Hyper binding, and
// bare-key mode remap, grouped by mode. The TypeScript source stays the single
// source of truth — run `yarn cheatsheet` after changing keybindings.
// ---------------------------------------------------------------------------

type Mode = "All modes" | "Normal" | "Programming" | "Reading" | "Trivia" | "Vim Mode";

const MODE_ORDER: Mode[] = ["All modes", "Normal", "Programming", "Reading", "Trivia", "Vim Mode"];

// Best-effort human labels for sublayer keys. Some keys mean different things
// in different modes (s = System in Normal, Session/tmux in Programming), so
// these are keyed by "mode:key" first, then a generic fallback.
const SUBLAYER_LABELS: Record<string, string> = {
        o: "Open apps",
        l: "Lookup",
        w: "Window",
        v: "Movement",
        c: "Cmd passthrough",
        r: "Raycast",
        a: "AI tools",
        m: "Modes",
        g: "Git",
        k: "Claude",
        s: "System",
        "Programming:s": "Session (tmux)",
        "Programming:v": "Movement / Vim",
        "Programming:k": "Claude / Git",
};

function sublayerLabel(mode: Mode, key: string): string {
        return SUBLAYER_LABELS[`${mode}:${key}`] ?? SUBLAYER_LABELS[key] ?? "";
}

// ---- key / action humanization -------------------------------------------

const MOD_SYMBOL: Record<string, string> = {
        left_control: "⌃", right_control: "⌃", control: "⌃",
        left_option: "⌥", right_option: "⌥", option: "⌥", left_alt: "⌥", right_alt: "⌥",
        left_shift: "⇧", right_shift: "⇧", shift: "⇧",
        left_command: "⌘", right_command: "⌘", command: "⌘",
        fn: "fn",
};
const MOD_ORDER = ["⌃", "⌥", "⇧", "⌘", "fn"];

const KEY_SYMBOL: Record<string, string> = {
        left_arrow: "←", right_arrow: "→", up_arrow: "↑", down_arrow: "↓",
        return_or_enter: "⏎", escape: "⎋", delete_or_backspace: "⌫", delete_forward: "⌦",
        tab: "⇥", spacebar: "Space",
        page_up: "⇞", page_down: "⇟", home: "↖", end: "↘",
        semicolon: ";", slash: "/", comma: ",", period: ".", quote: "'", hyphen: "-",
        open_bracket: "[", close_bracket: "]", equal_sign: "=", grave_accent_and_tilde: "`",
        backslash: "\\",
        volume_increment: "Vol +", volume_decrement: "Vol −", mute: "Mute",
        display_brightness_increment: "Bright +", display_brightness_decrement: "Bright −",
        play_or_pause: "Play/Pause", mission_control: "Mission Control",
        f18: "F18", f19: "F19",
        left_command: "⌘", right_command: "⌘",
        left_control: "⌃", right_control: "⌃",
        left_option: "⌥", right_option: "⌥",
        left_shift: "⇧", right_shift: "⇧",
};

function keyLabel(key: string): string {
        if (KEY_SYMBOL[key]) return KEY_SYMBOL[key];
        if (/^[a-z0-9]$/.test(key)) return key.toUpperCase();
        return key;
}

function modSymbols(mods?: string[]): string {
        if (!mods) return "";
        const syms = Array.from(new Set(mods.map((m) => MOD_SYMBOL[m]).filter(Boolean)));
        syms.sort((a, b) => MOD_ORDER.indexOf(a) - MOD_ORDER.indexOf(b));
        return syms.join("");
}

// The from-key of a manipulator, including any mandatory modifier (so shift+Y
// renders as ⇧Y, disambiguating it from plain Y).
function keyForManip(m: Manipulator): string {
        const base = m.from?.key_code ? keyLabel(m.from.key_code) : "?";
        const mand = m.from?.modifiers?.mandatory;
        return (mand ? modSymbols(mand) : "") + base;
}

function pretty(v: string): string {
        if (v === "vim_mode") return "Vim";
        return v.charAt(0).toUpperCase() + v.slice(1);
}

// "Enable vim_mode mode" -> "Enter Vim mode", etc.
function normalizeLabel(s: string): string {
        let m = s.match(/^Enable (\w+) mode$/);
        if (m) return `Enter ${pretty(m[1])} mode`;
        m = s.match(/^Disable (\w+) mode$/);
        if (m) return `Exit ${pretty(m[1])} mode`;
        return s;
}

function humanizeShell(cmd: string): string | null {
        let m: RegExpMatchArray | null;

        // open -a '.../Name.app'
        m = cmd.match(/open\s+(?:-g\s+)?-a\s+'?([^']+?\.app)'?/);
        if (m) {
                const base = m[1].split("/").pop()!.replace(/\.app$/, "");
                return `Open ${base}`;
        }
        // raycast://extensions/<pub>/<ext>[/<command>]
        m = cmd.match(/raycast:\/\/extensions\/[^/]+\/([^/'"?\s]+)(?:\/([^/'"?\s]+))?/);
        if (m) {
                const parts = [m[1], m[2]].filter(Boolean).map((s) => s!.replace(/-/g, " "));
                return `Raycast: ${parts.join(" · ")}`;
        }
        m = cmd.match(/raycast:\/\/([^'"?\s]+)/);
        if (m) return `Raycast: ${m[1].replace(/-/g, " ")}`;
        // open <url>
        m = cmd.match(/open\s+(?:-g\s+)?['"]?(https?:\/\/[^'"\s]+)/);
        if (m) return `Open ${m[1].replace(/^https?:\/\//, "")}`;
        // open some/path or /Applications/…
        m = cmd.match(/open\s+(?:-g\s+)?['"]?(\/[^'"\s]+|[A-Za-z][^'"\s]*)/);
        if (m && !cmd.includes("osascript")) {
                const base = m[1].split("/").pop()!.replace(/\.app$/, "");
                return `Open ${base}`;
        }
        // osascript keystroke "text" [& return]
        m = cmd.match(/keystroke\s+"([^"]*)"/);
        if (m) {
                const ret = /&\s*return|key code 36/.test(cmd) ? " ⏎" : "";
                return `Type “${m[1]}”${ret}`;
        }
        return null;
}

// Turn a list of `to` events into a readable action, or "" if nothing readable.
function humanizeTo(events?: To[]): string {
        if (!events) return "";
        const pieces: string[] = [];
        for (const e of events) {
                if (e.set_variable) continue; // plumbing
                if (e.key_code) {
                        pieces.push(modSymbols(e.modifiers) + keyLabel(e.key_code));
                } else if (e.shell_command) {
                        const s = humanizeShell(e.shell_command);
                        if (s) pieces.push(s);
                }
        }
        return pieces.join(" ");
}

// Descriptions the source auto-generates from shell commands are ugly; prefer
// humanizing the actual events in those cases.
function isUglyDesc(d: string): boolean {
        return (
                d.length > 60 ||
                d.startsWith("Open -a") ||
                d.includes("osascript") ||
                d.includes("&&") ||
                d.includes("shell_command") ||
                d.includes("://") ||
                d.includes(".app")
        );
}

function stripModePrefix(d: string): string {
        // "Trivia: 1 = Catfishing" -> "Catfishing"; "Reading: 2 = Open Arc" -> "Open Arc"
        const m = d.match(/^[A-Za-z ]+:\s*\S+\s*=\s*(.+)$/);
        return m ? m[1] : d;
}

function actionLabel(rule: KarabinerRules, m: Manipulator): string {
        const desc = m.description;
        if (desc && !isUglyDesc(desc)) return normalizeLabel(desc);

        // dual-role (App Switcher): tap / hold
        if (!m.to && (m.to_if_alone || m.to_if_held_down)) {
                const tap = humanizeTo(m.to_if_alone);
                const hold = humanizeTo(m.to_if_held_down);
                const parts: string[] = [];
                if (tap) parts.push(`tap → ${tap}`);
                if (hold) parts.push(`hold → ${hold}`);
                if (parts.length) return parts.join(", ");
        }

        // Vim-mode exits (the `to` is just the vim_mode=0 flip, sometimes plus keys).
        if (m.to?.some((t) => t.set_variable?.name === "vim_mode" && t.set_variable.value === 0)) {
                const extra = humanizeTo(m.to);
                return extra ? `${extra} (exit Vim)` : "Exit to insert mode";
        }

        // Bare-key mode rule with a "Mode: KEY = Name" description (e.g. Trivia).
        if (!desc && rule.description) {
                const stripped = stripModePrefix(rule.description);
                if (stripped !== rule.description && !stripped.includes("://"))
                        return normalizeLabel(stripped);
        }

        const humanized = humanizeTo(m.to);
        if (humanized) return humanized;
        if (desc) return normalizeLabel(desc);
        if (rule.description) return normalizeLabel(stripModePrefix(rule.description));
        return "(action)";
}

// ---- condition inspection -------------------------------------------------

type Cond = NonNullable<Manipulator["conditions"]>[number];

function varCond(conds: Cond[] | undefined, name: string): number | undefined {
        const c = conds?.find(
                (c) => (c as any).type?.startsWith("variable_") && (c as any).name === name
        ) as any;
        return c ? c.value : undefined;
}

function hasSublayer(conds: Cond[] | undefined): string | null {
        const c = conds?.find(
                (c) => (c as any).type === "variable_if" && String((c as any).name).startsWith("hyper_sublayer_") && (c as any).value === 1
        ) as any;
        return c ? String(c.name).replace("hyper_sublayer_", "") : null;
}

function detectMode(conds: Cond[] | undefined): Mode {
        if (varCond(conds, "vim_mode") === 1) return "Vim Mode";
        if (varCond(conds, "programming") === 1) return "Programming";
        if (varCond(conds, "reading") === 1) return "Reading";
        if (varCond(conds, "trivia") === 1) return "Trivia";
        if (
                varCond(conds, "programming") === 0 &&
                varCond(conds, "reading") === 0 &&
                varCond(conds, "trivia") === 0
        )
                return "Normal";
        return "All modes";
}

function appNote(conds: Cond[] | undefined): string {
        const c = conds?.find((c) => (c as any).type === "frontmost_application_if") as any;
        if (!c) return "";
        if (c.description) return ` _(${c.description} only)_`;
        const bundle = c.bundle_identifiers?.[0] as string | undefined;
        if (bundle) {
                const name = bundle.replace(/[\\^$]/g, "").split(".").pop() ?? bundle;
                return ` _(${name} only)_`;
        }
        return "";
}

// ---- walk the profile -----------------------------------------------------

interface Row {
        key: string;
        action: string;
}
interface ModeData {
        sublayers: Map<string, Row[]>; // sublayer key -> rows
        direct: Row[]; // Hyper + key (no sublayer)
        bare: Row[]; // bare-key remaps (reading/trivia/vim)
}

const modes = new Map<Mode, ModeData>();
function modeData(m: Mode): ModeData {
        if (!modes.has(m)) modes.set(m, { sublayers: new Map(), direct: [], bare: [] });
        return modes.get(m)!;
}

let hyperNote = "";

for (const rule of normalProfile.complex_modifications!.rules) {
        for (const m of rule.manipulators ?? []) {
                const conds = m.conditions;

                // Skip sublayer toggle plumbing.
                if (m.description?.startsWith("Toggle Hyper sublayer")) continue;

                // The Hyper key definition itself.
                if (m.to?.some((t) => t.set_variable?.name === "hyper")) {
                        hyperNote = "Tap Caps Lock alone = **Escape**.";
                        continue;
                }

                const mode = detectMode(conds);
                const sublayer = hasSublayer(conds);
                const action = actionLabel(rule, m) + appNote(conds);
                const fromKey = m.from?.key_code;
                const fromLabel = keyForManip(m);

                if (sublayer) {
                        // Command inside a Hyper sublayer.
                        if (!fromKey) continue;
                        const data = modeData(mode);
                        if (!data.sublayers.has(sublayer)) data.sublayers.set(sublayer, []);
                        data.sublayers.get(sublayer)!.push({ key: fromLabel, action });
                } else if (varCond(conds, "hyper") === 1) {
                        // Direct Hyper + key.
                        if (!fromKey) continue;
                        modeData(mode).direct.push({ key: fromLabel, action });
                } else if (fromKey) {
                        // Bare-key remap (mode-gated: reading, trivia, vim).
                        modeData(mode).bare.push({ key: fromLabel, action });
                }
        }
}

// ---- render markdown ------------------------------------------------------

const SUBLAYER_ORDER = ["o", "l", "w", "v", "s", "a", "g", "k", "r", "c", "m"];
function sortSublayers(keys: string[]): string[] {
        return keys.sort((a, b) => {
                const ia = SUBLAYER_ORDER.indexOf(a);
                const ib = SUBLAYER_ORDER.indexOf(b);
                if (ia !== -1 && ib !== -1) return ia - ib;
                if (ia !== -1) return -1;
                if (ib !== -1) return 1;
                return a.localeCompare(b);
        });
}

function table(rows: Row[]): string {
        const out = ["| Key | Action |", "| --- | --- |"];
        for (const r of rows) out.push(`| \`${r.key}\` | ${r.action} |`);
        return out.join("\n");
}

const lines: string[] = [];
lines.push("# Keybinding Cheatsheet");
lines.push("");
lines.push("> Auto-generated by `yarn cheatsheet` from `profiles/`. **Do not edit by hand** — change the TypeScript source and regenerate.");
lines.push("");
lines.push("Caps Lock is the **Hyper** key (⌃⌥⇧⌘). Hold Hyper, tap a sublayer key, then a command key — e.g. `Hyper O G` opens a browser. " + hyperNote);
lines.push("");

for (const mode of MODE_ORDER) {
        const data = modes.get(mode);
        if (!data) continue;
        const hasContent =
                data.direct.length > 0 || data.bare.length > 0 || data.sublayers.size > 0;
        if (!hasContent) continue;

        lines.push(`## ${mode}`);
        lines.push("");

        if (data.bare.length > 0) {
                lines.push(`### Bare keys`);
                lines.push("");
                lines.push(table(data.bare));
                lines.push("");
        }

        if (data.direct.length > 0) {
                lines.push(`### Direct (\`Hyper\` + key)`);
                lines.push("");
                lines.push(table(data.direct.map((r) => ({ key: `Hyper ${r.key}`, action: r.action }))));
                lines.push("");
        }

        for (const sub of sortSublayers([...data.sublayers.keys()])) {
                const rows = data.sublayers.get(sub)!;
                const label = sublayerLabel(mode, sub);
                const heading = label
                        ? `### \`Hyper ${keyLabel(sub)}\` — ${label}`
                        : `### \`Hyper ${keyLabel(sub)}\``;
                lines.push(heading);
                lines.push("");
                lines.push(table(rows.map((r) => ({ key: `${keyLabel(sub)} ${r.key}`, action: r.action }))));
                lines.push("");
        }
}

const total = [...modes.values()].reduce(
        (n, d) =>
                n + d.direct.length + d.bare.length + [...d.sublayers.values()].reduce((s, r) => s + r.length, 0),
        0
);

fs.writeFileSync("CHEATSHEET.md", lines.join("\n"));
console.log(`Wrote CHEATSHEET.md (${total} bindings)`);
