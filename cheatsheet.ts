import fs from "fs";
import { normalProfile } from "./profiles/normal";
import { Manipulator, To, KarabinerRules } from "./types";
import { HUD_ICONS, HudIcon } from "./utils";

// ---------------------------------------------------------------------------
// Cheatsheet generator
//
// Walks the assembled `normalProfile` (the same object `yarn build` emits) and
// renders CHEATSHEET.md: every Hyper sublayer, direct Hyper binding, and
// bare-key mode remap, grouped by mode. The TypeScript source stays the single
// source of truth — run `yarn cheatsheet` after changing keybindings.
//
// It ALSO emits hammerspoon/sublayers.json: for each runtime mode (normal /
// programming / reading / trivia) the *effective* contents of every sublayer
// plus a `_top` map of the Hyper layer itself. Hammerspoon's radial which-key
// HUD (hudShow in hammerspoon/init.lua) renders that, so the on-screen menu
// can never drift from the real bindings.
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
        f18: "F18", f19: "F19", f20: "F20",
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
                if (e.send_user_command) continue; // HUD ping, plumbing
                if (e.shell_command?.includes("hammerspoon://hud")) continue; // HUD ping (Hammerspoon renderer), plumbing
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

// The frontmost_application_if condition on a manipulator, if any.
function appCond(conds: Cond[] | undefined): any {
        return conds?.find((c) => (c as any).type === "frontmost_application_if");
}

// Name of the app a manipulator is gated to (frontmost_application_if), or "".
function appName(conds: Cond[] | undefined): string {
        const c = appCond(conds);
        if (!c) return "";
        if (c.description) return c.description;
        const bundle = c.bundle_identifiers?.[0] as string | undefined;
        if (bundle) return bundle.replace(/[\\^$]/g, "").split(".").pop() ?? bundle;
        return "";
}

// The raw bundle-id regexes a manipulator is gated to, for the HUD to match
// against the frontmost app at draw time (so WhatsApp's ⌘1-3 only show up in
// WhatsApp). Undefined when the binding isn't app-gated.
function appBundles(conds: Cond[] | undefined): string[] | undefined {
        const ids = appCond(conds)?.bundle_identifiers as string[] | undefined;
        return ids && ids.length > 0 ? ids : undefined;
}

function appNote(conds: Cond[] | undefined): string {
        const name = appName(conds);
        return name ? ` _(${name} only)_` : "";
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

// Flat, rule-ordered record of every Hyper binding, used to build the HUD
// JSON. Rule order == Karabiner precedence (first match wins), so resolving
// per-mode "effective" bindings is just a first-seen-per-key walk.
interface Entry {
        mode: Mode;
        sublayer: string | null; // raw sublayer key_code, or null for direct
        key: string; // humanized from-key (e.g. "G", "⇧Y", "⏎")
        code: string; // raw from key_code, what Karabiner sends as hud?press=<code>
        label: string; // plain-text action (no markdown)
        app?: string[]; // bundle-id regexes when gated with frontmost_application_if
        icon?: HudIcon;
}
const entries: Entry[] = [];
// Pseudo-sublayer for a runtime mode's bare keys: its `_keys` wheel, which the
// HUD shows unprompted when the mode is entered.
const KEYS = "_keys";
const KEYS_MODES: Mode[] = ["Programming", "Reading", "Trivia"];
// Sublayer group icons for the top-level wheel, keyed "<mode>:<sublayer key>"
// (explicit `icon` on a sublayer map, carried on its toggle manipulator).
const groupIcons = new Map<string, HudIcon>();

// ---- HUD icon inference ---------------------------------------------------
// First match wins: explicit `icon` on the LayerCommand, a known key or
// shortcut, an app the command opens, a web URL (its favicon). Anything else
// has none.
const KEY_ICON: Record<string, string> = {
        volume_increment: "speaker.wave.3.fill",
        volume_decrement: "speaker.wave.1.fill",
        mute: "speaker.slash.fill",
        display_brightness_increment: "sun.max.fill",
        display_brightness_decrement: "sun.min.fill",
        play_or_pause: "playpause.fill",
        mission_control: "rectangle.3.group",
};
const CMD_ICON: Record<string, string> = {
        c: "doc.on.doc",
        v: "doc.on.clipboard",
        z: "arrow.uturn.backward",
        f: "magnifyingglass",
        w: "xmark",
        q: "xmark.square",
        t: "plus.square.on.square",
};
// Plain Cmd+key only: ⌃⌘F (fullscreen) or ⇧⌘= (zoom) are not these shortcuts.
const isCmd = (mods?: string[]) => !!mods && mods.length > 0 && mods.every((m) => /command/.test(m));

function iconFor(m: Manipulator): HudIcon | undefined {
        const explicit = HUD_ICONS.get(m);
        if (explicit) return explicit;
        for (const e of m.to ?? []) {
                if (e.key_code) {
                        if (KEY_ICON[e.key_code]) return { symbol: KEY_ICON[e.key_code] };
                        if (isCmd(e.modifiers) && CMD_ICON[e.key_code]) return { symbol: CMD_ICON[e.key_code] };
                        return undefined; // a real keystroke with no icon of its own
                }
                const sh = e.shell_command;
                if (!sh || sh.includes("hammerspoon://")) continue;
                let r: RegExpMatchArray | null;
                if ((r = sh.match(/open\s+-a\s+'([^']+?)\.app'/))) return { app: r[1] };
                if ((r = sh.match(/open\s+(\/[^'"\s]+)/))) return { app: r[1] };
                if (sh.includes("raycast://")) return { bundle: "com.raycast.macos" };
                if ((r = sh.match(/open\s+['"]?(https?:\/\/[^'"\s]+)/))) return { url: r[1] };
                if ((r = sh.match(/keystroke\s+"(\w)"\s+using\s+command\s+down/)) && CMD_ICON[r[1]]) {
                        return { symbol: CMD_ICON[r[1]] };
                }
        }
        return undefined;
}

// With an app or site icon on the wedge, "Open Arc" just reads "Arc" (and
// "Open iTerm & switch to programming mode" -> "iTerm · Programming").
function hudLabel(label: string, icon?: HudIcon): string {
        if (!icon || "symbol" in icon) return label;
        return label
                .replace(/^Open /, "")
                .replace(/ & switch to (\w+) mode$/, (_, mode: string) => ` · ${mode[0].toUpperCase()}${mode.slice(1)}`);
}

for (const rule of normalProfile.complex_modifications!.rules) {
        for (const m of rule.manipulators ?? []) {
                const conds = m.conditions;

                // Sublayer toggle plumbing: only its group icon matters here.
                if (m.description?.startsWith("Toggle Hyper sublayer")) {
                        const icon = HUD_ICONS.get(m);
                        const key = m.from?.key_code;
                        if (icon && key) {
                                const k = `${detectMode(conds)}:${key}`;
                                if (!groupIcons.has(k)) groupIcons.set(k, icon);
                        }
                        continue;
                }

                // The Hyper key definition itself.
                if (m.to?.some((t) => t.set_variable?.name === "hyper")) {
                        hyperNote = "Tap Caps Lock alone = **Escape**.";
                        continue;
                }

                const mode = detectMode(conds);
                const sublayer = hasSublayer(conds);
                const plainAction = actionLabel(rule, m);
                const app = appName(conds);
                const action = plainAction + appNote(conds);
                const label = app ? `${plainAction} (${app})` : plainAction;
                const bundles = appBundles(conds);
                const fromKey = m.from?.key_code;
                const fromLabel = keyForManip(m);
                const icon = iconFor(m);

                if (sublayer) {
                        // Command inside a Hyper sublayer.
                        if (!fromKey) continue;
                        const data = modeData(mode);
                        if (!data.sublayers.has(sublayer)) data.sublayers.set(sublayer, []);
                        data.sublayers.get(sublayer)!.push({ key: fromLabel, action });
                        entries.push({ mode, sublayer, key: fromLabel, code: fromKey, label, app: bundles, icon });
                } else if (varCond(conds, "hyper") === 1) {
                        // Direct Hyper + key.
                        if (!fromKey) continue;
                        modeData(mode).direct.push({ key: fromLabel, action });
                        entries.push({ mode, sublayer: null, key: fromLabel, code: fromKey, label, app: bundles, icon });
                } else if (fromKey) {
                        // Bare-key remap (mode-gated: reading, trivia, vim).
                        modeData(mode).bare.push({ key: fromLabel, action });
                        if (KEYS_MODES.includes(mode))
                                entries.push({ mode, sublayer: KEYS, key: fromLabel, code: fromKey, label, app: bundles, icon });
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

// ---- emit the HUD menu data (hammerspoon/sublayers.json) -------------------
//
// For each runtime mode Hammerspoon can be in, resolve what every sublayer
// actually contains right then: mode-specific rules win over the global
// ("All modes") ones because they're spread earlier in normal.ts, and Normal
// adds its own sublayers on top. `_top` is the Hyper layer itself — the
// sublayer keys (flagged `group`, so the HUD can put them on the inner ring)
// followed by the direct Hyper+key commands.

type RuntimeMode = "normal" | "programming" | "reading" | "trivia";
const RUNTIME_MODES: RuntimeMode[] = ["normal", "programming", "reading", "trivia"];
const MODE_OF: Record<RuntimeMode, Mode> = {
        normal: "Normal",
        programming: "Programming",
        reading: "Reading",
        trivia: "Trivia",
};

interface HudItem {
        key: string;
        code: string; // raw key_code; matched against hud?press=<code> to light the wedge
        label: string;
        group?: boolean;
        app?: string[]; // only shown while the frontmost app's bundle id matches one of these
        icon?: HudIcon; // SF Symbol name, or an app (name/path) / bundle id whose icon to show
}
interface HudMenu {
        title: string;
        items: HudItem[];
}

function appliesTo(entryMode: Mode, rt: RuntimeMode): boolean {
        return entryMode === "All modes" || entryMode === MODE_OF[rt];
}

const hud: Record<RuntimeMode, Record<string, HudMenu>> = {} as any;
for (const rt of RUNTIME_MODES) {
        // key -> candidate items in rule order. An un-gated binding settles the
        // key (nothing after it can ever fire), but app-gated ones only win in
        // their app, so later candidates stay — Hammerspoon picks the first whose
        // app matches the frontmost one at draw time (`visibleItems` in init.lua),
        // which is exactly Karabiner's first-match resolution.
        type Candidates = Map<string, HudItem[]>;
        const subs = new Map<string, Candidates>(); // sublayer -> key -> items
        const direct: Candidates = new Map();
        const add = (m: Candidates, e: Entry) => {
                const list = m.get(e.key) ?? [];
                if (list.some((it) => !it.app)) return; // already settled
                const item: HudItem = { key: e.key, code: e.code, label: hudLabel(e.label, e.icon) };
                if (e.app) item.app = e.app;
                if (e.icon) item.icon = e.icon;
                list.push(item);
                m.set(e.key, list);
        };
        for (const e of entries) {
                if (!appliesTo(e.mode, rt)) continue;
                if (e.sublayer) {
                        let m = subs.get(e.sublayer);
                        if (!m) {
                                m = new Map();
                                subs.set(e.sublayer, m);
                        }
                        add(m, e);
                } else {
                        add(direct, e);
                }
        }
        const flat = (m: Candidates): HudItem[] => [...m.values()].flat();

        const menus: Record<string, HudMenu> = {};
        const subKeys = sortSublayers([...subs.keys()]);
        for (const s of subKeys) {
                menus[s] = {
                        title: s === KEYS ? "Keys" : sublayerLabel(MODE_OF[rt], s) || keyLabel(s),
                        items: flat(subs.get(s)!),
                };
        }
        menus._top = {
                title: "Hyper",
                items: [
                        ...subKeys.filter((s) => s !== KEYS).map((s) => {
                                const item: HudItem = { key: keyLabel(s), code: s, label: menus[s].title, group: true };
                                const icon = groupIcons.get(`${MODE_OF[rt]}:${s}`) ?? groupIcons.get(`All modes:${s}`);
                                if (icon) item.icon = icon;
                                return item;
                        }),
                        ...flat(direct),
                ],
        };
        hud[rt] = menus;
}

fs.writeFileSync("hammerspoon/sublayers.json", JSON.stringify(hud, null, 2) + "\n");
const menuCount = RUNTIME_MODES.reduce((n, rt) => n + Object.keys(hud[rt]).length, 0);
console.log(`Wrote hammerspoon/sublayers.json (${menuCount} menus across ${RUNTIME_MODES.length} modes)`);
