import { To, KeyCode, Manipulator, KarabinerRules, Profile, KarabinerConfig } from "./types";

export function profilesToConfig(profiles: Profile[]): string {
        const config: KarabinerConfig = {
                global: { show_in_menu_bar: false },
                profiles: profiles.map((p, i) => ({
                        virtual_hid_keyboard: { keyboard_type_v2: "ansi" },
                        // Karabiner needs exactly one selected profile; mark the first.
                        selected: i === 0,
                        ...p,
                })),
        };
        return JSON.stringify(config, null, 2);
}

/**
 * Custom way to describe a command in a layer
 */
export interface LayerCommand {
        to: To[];
        description?: string;
        conditions?: Manipulator["conditions"];
}

type HyperKeySublayer = {
        // The ? is necessary, otherwise we'd have to define something for _every_ key code
        [key_code in KeyCode]?: LayerCommand;
};

/**
 * Create a Hyper Key sublayer, where every command is prefixed with a key
 * e.g. Hyper + O ("Open") is the "open applications" layer, I can press
 * e.g. Hyper + O + G ("Google Chrome") to open Chrome
 */
export function createHyperSubLayer(
        sublayer_key: KeyCode,
        commands: HyperKeySublayer,
        allSubLayerVariables: string[],
        extraConditions: NonNullable<Manipulator["conditions"]> = []
): Manipulator[] {
        const subLayerVariableName = generateSubLayerVariableName(sublayer_key);

        return [
                // When Hyper + sublayer_key is pressed, set the variable to 1; on key_up, set it to 0 again
                {
                        description: `Toggle Hyper sublayer ${sublayer_key}`,
                        type: "basic",
                        from: {
                                key_code: sublayer_key,
                                modifiers: {
                                        optional: ["any"],
                                },
                        },
                        to_after_key_up: [
                                {
                                        set_variable: {
                                                name: subLayerVariableName,
                                                // The default value of a variable is 0: https://karabiner-elements.pqrs.org/docs/json/complex-modifications-manipulator-definition/conditions/variable/
                                                // That means by using 0 and 1 we can filter for "0" in the conditions below and it'll work on startup
                                                value: 0,
                                        },
                                },
                        ],
                        to: [
                                {
                                        set_variable: {
                                                name: subLayerVariableName,
                                                value: 1,
                                        },
                                },
                        ],
                        // This enables us to press other sublayer keys in the current sublayer
                        // (e.g. Hyper + O > M even though Hyper + M is also a sublayer)
                        // basically, only trigger a sublayer if no other sublayer is active
                        conditions: [
                                ...allSubLayerVariables
                                        .filter(
                                                (subLayerVariable) => subLayerVariable !== subLayerVariableName
                                        )
                                        .map((subLayerVariable) => ({
                                                type: "variable_if" as const,
                                                name: subLayerVariable,
                                                value: 0,
                                        })),
                                {
                                        type: "variable_if",
                                        name: "hyper",
                                        value: 1,
                                },
                                ...extraConditions,
                        ],
                },
                // Define the individual commands that are meant to trigger in the sublayer
                ...(Object.keys(commands) as (keyof typeof commands)[]).map(
                        (command_key): Manipulator => ({
                                ...commands[command_key],
                                type: "basic" as const,
                                from: {
                                        key_code: command_key,
                                        modifiers: {
                                                optional: ["any"],
                                        },
                                },
                                // Only trigger this command if the variable is 1 (i.e., if Hyper + sublayer is held)
                                conditions: [
                                        {
                                                type: "variable_if",
                                                name: subLayerVariableName,
                                                value: 1,
                                        },
                                        ...extraConditions,
                                ],
                        })
                ),
        ];
}

/**
 * Create all hyper sublayers. This needs to be a single function, as well need to
 * have all the hyper variable names in order to filter them and make sure only one
 * activates at a time
 */
export function createHyperSubLayers(
        subLayers: {
                [key_code in KeyCode]?: HyperKeySublayer | LayerCommand;
        },
        // Extra conditions injected into every generated manipulator. Used to gate
        // an entire sublayer set behind a mode variable (e.g. programming == 1).
        extraConditions: NonNullable<Manipulator["conditions"]> = []
): KarabinerRules[] {
        const allSubLayerVariables = (
                Object.keys(subLayers) as (keyof typeof subLayers)[]
        ).map((sublayer_key) => generateSubLayerVariableName(sublayer_key));

        return Object.entries(subLayers).map(([key, value]) =>
                "to" in value
                        ? {
                                description: `Hyper Key + ${key}`,
                                manipulators: [
                                        {
                                                ...value,
                                                type: "basic" as const,
                                                from: {
                                                        key_code: key as KeyCode,
                                                        modifiers: {
                                                                optional: ["any"],
                                                        },
                                                },
                                                conditions: [
                                                        {
                                                                type: "variable_if",
                                                                name: "hyper",
                                                                value: 1,
                                                        },
                                                        ...allSubLayerVariables.map((subLayerVariable) => ({
                                                                type: "variable_if" as const,
                                                                name: subLayerVariable,
                                                                value: 0,
                                                        })),
                                                        ...(value.conditions ?? []),
                                                        ...extraConditions,
                                                ],
                                        },
                                ],
                        }
                        : {
                                description: `Hyper Key sublayer "${key}"`,
                                manipulators: createHyperSubLayer(
                                        key as KeyCode,
                                        value,
                                        allSubLayerVariables,
                                        extraConditions
                                ),
                        }
        );
}

function generateSubLayerVariableName(key: KeyCode) {
        return `hyper_sublayer_${key}`;
}

/**
 * Types a vim command :<command><enter> — assumes already in normal mode
 */
export function vimCmd(command: string): LayerCommand {
        return {
                to: [
                        { key_code: "semicolon", modifiers: ["left_shift"] }, // :
                        ...command.split("").map((char) => {
                                if (char === "!") return { key_code: "1", modifiers: ["left_shift"] } as const;
                                return { key_code: char as KeyCode };
                        }),
                        { key_code: "return_or_enter" },
                ],
                description: `Vim: :${command}`,
        };
}

/**
 * Types a Claude Code slash command into the focused terminal
 */
export function claudeCmd(command: string): LayerCommand {
        return {
                to: [
                        {
                                shell_command: `osascript -e 'tell application "System Events" to keystroke "${command}" & return'`,
                        },
                ],
                description: `Claude: ${command}`,
        };
}

/**
 * Shortcut for "open" shell command
 */
export function open(...what: string[]): LayerCommand {
        return {
                to: what.map((w) => ({
                        shell_command: `open ${w}`,
                })),
                description: `Open ${what.join(" & ")}`,
        };
}

/**
 * Utility function to create a LayerCommand from a tagged template literal
 * where each line is a shell command to be executed.
 */
export function shell(
        strings: TemplateStringsArray,
        ...values: any[]
): LayerCommand {
        const commands = strings.reduce((acc, str, i) => {
                const value = i < values.length ? values[i] : "";
                const lines = (str + value)
                        .split("\n")
                        .filter((line) => line.trim() !== "");
                acc.push(...lines);
                return acc;
        }, [] as string[]);

        return {
                to: commands.map((command) => ({
                        shell_command: command.trim(),
                })),
                description: commands.join(" && "),
        };
}

/**
 * Creates a persistent mode that can be toggled on/off via variable.
 * Switching is instantaneous (no IPC overhead like profile switching).
 *
 * Usage:
 *   const textEditing = createMode("text_editing");
 *
 *   // In sublayer m: toggle on/off
 *   m: { t: textEditing.enable(), n: textEditing.disable() }
 *
 *   // Wrap rules so they only fire in this mode
 *   ...textEditing.apply([
 *     { description: "...", manipulators: [...] }
 *   ])
 *
 *   // Or add the condition manually to a LayerCommand
 *   { to: [...], conditions: [textEditing.condition] }
 */
export function createMode(name: string) {
        const condition = { type: "variable_if" as const, name, value: 1 };
        const flag = `/tmp/karabiner_mode_${name}`;
        return {
                condition,
                enable: (): LayerCommand => ({
                        to: [
                                { set_variable: { name, value: 1 } },
                                { shell_command: `touch ${flag}` },
                        ],
                        description: `Enable ${name} mode`,
                }),
                disable: (): LayerCommand => ({
                        to: [
                                { set_variable: { name, value: 0 } },
                                { shell_command: `rm -f ${flag}` },
                        ],
                        description: `Disable ${name} mode`,
                }),
                /** Inject the mode condition into every manipulator in the given rules */
                apply: (rules: KarabinerRules[]): KarabinerRules[] =>
                        rules.map((rule) => ({
                                ...rule,
                                manipulators: rule.manipulators.map((m) => ({
                                        ...m,
                                        conditions: [...(m.conditions ?? []), condition],
                                })),
                        })),
        };
}

export function switchProfile(profileName: string): LayerCommand {
        return {
                to: [
                        {
                                shell_command: `"/Library/Application Support/org.pqrs/Karabiner-Elements/bin/karabiner_cli" --select-profile "${profileName}"`,
                        },
                ],
                description: `Switch to profile: ${profileName}`,
        };
}

// ---------------------------------------------------------------------------
// Instant modes
//
// Replaces slow profile switching (karabiner_cli --select-profile, which
// reloads the whole config) with variable flips inside the grabber, which are
// instantaneous. Every mode-specific rule is gated behind a `variable_if`
// condition, so one unified profile behaves like several.
//
// Each mode writes a /tmp/karabiner_mode_<name> flag so external indicators
// (SwiftBar menubar plugin, tmux status bar) can show the active mode.
// ---------------------------------------------------------------------------

export const MODE_NAMES = ["programming", "reading", "trivia"] as const;
export type ModeName = (typeof MODE_NAMES)[number];

const MODE_LABELS: Record<ModeName | "normal", string> = {
        programming: "Programming",
        reading: "Reading",
        trivia: "Trivia",
        normal: "Normal",
};

/** Conditions that hold only in Normal (i.e. no mode active). */
export const whenNormal: NonNullable<Manipulator["conditions"]> = MODE_NAMES.map(
        (m) => ({ type: "variable_if" as const, name: m, value: 0 })
);

/** Conditions that hold only while the given mode is active. */
export function whenMode(mode: ModeName): NonNullable<Manipulator["conditions"]> {
        return [{ type: "variable_if" as const, name: mode, value: 1 }];
}

/** Condition: the Hyper key is not held. Gates bare-key mode remaps so they
 *  don't fire while a Hyper sublayer chord is in progress. */
export const hyperNotHeld = {
        type: "variable_if" as const,
        name: "hyper",
        value: 0,
};

/**
 * Instantly switch modes: set the target mode variable to 1 and all others to
 * 0 (mutual exclusion), update the /tmp flag files for indicators, refresh the
 * tmux status bar, and fire a macOS notification. No config reload — instant.
 */
export function switchMode(target: ModeName | "normal"): LayerCommand {
        const setVars: To[] = MODE_NAMES.map((m) => ({
                set_variable: { name: m, value: m === target ? 1 : 0 },
        }));
        const flags = MODE_NAMES.map((m) =>
                m === target
                        ? `touch /tmp/karabiner_mode_${m}`
                        : `rm -f /tmp/karabiner_mode_${m}`
        ).join("; ");
        const label = MODE_LABELS[target];
        const shell = `${flags}; tmux refresh-client -S 2>/dev/null; osascript -e 'display notification "${label} Mode" with title "Karabiner"'`;
        return {
                to: [...setVars, { shell_command: shell }],
                description: `Switch to ${label} mode`,
        };
}

/** Open an app and instantly switch into a mode. */
export function appAndSwitchMode(name: string, mode: ModeName): LayerCommand {
        return {
                to: [
                        { shell_command: `open -a '${name}.app'` },
                        ...switchMode(mode).to,
                ],
                description: `Open ${name} & switch to ${mode} mode`,
        };
}

/**
 * Shortcut for managing window sizing
 */
export function window(name: string): LayerCommand {
        return {
                to: [
                        {
                                shell_command: `open -g raycast://extensions/raycast/window-management/${name}`,
                        },
                ],
                description: `Window: ${name}`,
        };
}

/**
 * Shortcut for "Open an app" command (of which there are a bunch)
 */
export function app(name: string): LayerCommand {
        return open(`-a '${name}.app'`);
}

/**
 * Create a double-tap rule for a key that triggers a LayerCommand.
 * The action only fires if the key is pressed twice within `delayMs` milliseconds.
 */
export function doubleTap(
        key: KeyCode,
        command: LayerCommand,
        delayMs: number = 300,
        extraConditions: NonNullable<Manipulator["conditions"]> = []
): KarabinerRules {
        const variable = `double_tap_${key}`;
        return {
                description: `Double tap ${key}: ${command.description ?? ""}`,
                manipulators: [
                        // Second tap: fire the action and reset the variable
                        {
                                type: "basic",
                                from: {
                                        key_code: key,
                                        modifiers: { optional: ["any"] },
                                },
                                to: [
                                        ...command.to,
                                        { set_variable: { name: variable, value: 0 } },
                                ],
                                conditions: [
                                        { type: "variable_if", name: variable, value: 1 },
                                        ...extraConditions,
                                ],
                        },
                        // First tap: set the variable; reset it if the delay expires without a second tap
                        {
                                type: "basic",
                                from: {
                                        key_code: key,
                                        modifiers: { optional: ["any"] },
                                },
                                to: [{ set_variable: { name: variable, value: 1 } }],
                                to_delayed_action: {
                                        to_if_invoked: [{ set_variable: { name: variable, value: 0 } }],
                                        to_if_canceled: [{ set_variable: { name: variable, value: 0 } }],
                                },
                                parameters: {
                                        "basic.to_delayed_action_delay_milliseconds": delayMs,
                                },
                                conditions: extraConditions.length > 0 ? extraConditions : undefined,
                        },
                ],
        };
}

/**
 * Shortcut for opening something and switching to a profile
 */
/**
 * Generates a sublayer where every key fires Cmd + that key.
 * Use as: c: cmdSublayer() to make Hyper + C + key = Cmd + key.
 */
export function cmdSublayer(): { [key_code in KeyCode]?: LayerCommand } {
        const keys = [
                ..."abcdefghijklmnopqrstuvwxyz",
                ..."1234567890",
        ] as KeyCode[];
        return Object.fromEntries(
                keys.map((k) => [
                        k,
                        {
                                description: `Cmd+${k.toUpperCase()}`,
                                to: [{ key_code: k, modifiers: ["right_command"] as const }],
                        },
                ])
        );
}

/**
 * Chain a series of actions into a single shell command with delays.
 * Each step is one of:
 *   - key("5", ["command", "shift"])  — keystroke via osascript
 *   - click(x, y)                     — click at coordinates
 *   - drag(x1, y1, x2, y2)           — drag from one point to another
 *   - scroll(direction, clicks)       — scroll up/down/left/right
 *   - delay(ms)                       — pause in seconds
 *   - run("shell command")            — arbitrary shell command
 *   - type("text")                    — type text via osascript
 *   - keyCode(code)                   — press a key code (e.g. 36 for return)
 *
 * Usage:
 *   chain("Take screenshot and translate", [
 *     key("5", ["command", "shift"]),
 *     delay(500),
 *     keyCode(36),
 *     delay(1500),
 *     drag(1970, 1248, 1449, 617),
 *     run("open -a 'Arc.app'"),
 *   ])
 */
const CLICLICK = "/opt/homebrew/bin/cliclick";

type ChainStep =
        | { type: "key"; key: string; modifiers?: string[] }
        | { type: "keyCode"; code: number; modifiers?: string[] }
        | { type: "click"; x: number; y: number }
        | { type: "drag"; x1: number; y1: number; x2: number; y2: number }
        | { type: "scroll"; direction: "up" | "down" | "left" | "right"; clicks?: number }
        | { type: "delay"; ms: number }
        | { type: "run"; command: string }
        | { type: "type"; text: string }
        | { type: "nativeKey"; key_code: KeyCode; modifiers?: string[] };

export function key(k: string, modifiers?: string[]): ChainStep {
        return { type: "key", key: k, modifiers };
}
export function keyCode(code: number, modifiers?: string[]): ChainStep {
        return { type: "keyCode", code, modifiers };
}
export function click(x: number, y: number): ChainStep {
        return { type: "click", x, y };
}
export function drag(x1: number, y1: number, x2: number, y2: number): ChainStep {
        return { type: "drag", x1, y1, x2, y2 };
}
export function scroll(direction: "up" | "down" | "left" | "right", clicks: number = 3): ChainStep {
        return { type: "scroll", direction, clicks };
}
export function delay(ms: number): ChainStep {
        return { type: "delay", ms };
}
export function run(command: string): ChainStep {
        return { type: "run", command };
}
export function type(text: string): ChainStep {
        return { type: "type", text };
}
export function nativeKey(key_code: KeyCode, modifiers?: string[]): ChainStep {
        return { type: "nativeKey", key_code, modifiers };
}

function stepToShell(step: ChainStep): string {
        switch (step.type) {
                case "key": {
                        const mods = step.modifiers?.map((m) => `${m} down`).join(", ") ?? "";
                        const using = mods ? ` using {${mods}}` : "";
                        return `osascript -e 'tell application "System Events" to keystroke "${step.key}"${using}'`;
                }
                case "keyCode": {
                        const mods = step.modifiers?.map((m) => `${m} down`).join(", ") ?? "";
                        const using = mods ? ` using {${mods}}` : "";
                        return `osascript -e 'tell application "System Events" to key code ${step.code}${using}'`;
                }
                case "click":
                        return `${CLICLICK} c:${step.x},${step.y}`;
                case "drag":
                        return `${CLICLICK} dd:${step.x1},${step.y1} dm:${step.x2},${step.y2} du:${step.x2},${step.y2}`;
                case "scroll": {
                        const dir = step.direction;
                        const n = step.clicks ?? 3;
                        const scrollCmd = dir === "up" ? `key code 126` : dir === "down" ? `key code 125` : dir === "left" ? `key code 123` : `key code 124`;
                        return Array(n).fill(`osascript -e 'tell application "System Events" to ${scrollCmd}'`).join(" && ");
                }
                case "delay":
                        return `sleep ${step.ms / 1000}`;
                case "run":
                        return step.command;
                case "type":
                        return `osascript -e 'tell application "System Events" to keystroke "${step.text}"'`;
        }
}

export function chain(description: string, steps: ChainStep[]): LayerCommand {
        // Split into leading native key events (fired by Karabiner directly)
        // and the rest (bundled into a single shell command).
        // Once we hit a delay or non-native step, everything from there goes to shell.
        const toEvents: To[] = [];
        let shellStart = 0;

        for (let i = 0; i < steps.length; i++) {
                if (steps[i].type === "nativeKey") {
                        const s = steps[i] as { type: "nativeKey"; key_code: KeyCode; modifiers?: string[] };
                        toEvents.push({
                                key_code: s.key_code,
                                ...(s.modifiers ? { modifiers: s.modifiers } : {}),
                        } as To);
                        shellStart = i + 1;
                } else {
                        break;
                }
        }

        const shellSteps = steps.slice(shellStart);
        if (shellSteps.length > 0) {
                const cmd = shellSteps.map(stepToShell).join(" && ");
                toEvents.push({ shell_command: cmd });
        }

        return {
                to: toEvents,
                description,
        };
}

export function appAndSwitch(name: string, profileName: string): LayerCommand {
        return openAndSwitch(`-a '${name}.app'`, profileName);
}

/**
 * Shortcut for opening something and switching to a profile
 */
export function openAndSwitch(what: string, profileName: string): LayerCommand {
        return {
                to: [
                        {
                                shell_command: `open ${what} && "/Library/Application Support/org.pqrs/Karabiner-Elements/bin/karabiner_cli" --select-profile "${profileName}"`,
                        },
                ],
                description: `Open ${what} & switch to profile: ${profileName}`,
        };
}
