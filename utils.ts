import { To, KeyCode, Manipulator, KarabinerRules, Profile, KarabinerConfig } from "./types";

export function profilesToConfig(profiles: Profile[]): string {
        const config: KarabinerConfig = {
                global: { show_in_menu_bar: false },
                profiles: profiles.map((p) => ({
                        virtual_hid_keyboard: { keyboard_type_v2: "ansi" },
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
        allSubLayerVariables: string[]
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
export function createHyperSubLayers(subLayers: {
        [key_code in KeyCode]?: HyperKeySublayer | LayerCommand;
}): KarabinerRules[] {
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
                                                ],
                                        },
                                ],
                        }
                        : {
                                description: `Hyper Key sublayer "${key}"`,
                                manipulators: createHyperSubLayer(
                                        key as KeyCode,
                                        value,
                                        allSubLayerVariables
                                ),
                        }
        );
}

function generateSubLayerVariableName(key: KeyCode) {
        return `hyper_sublayer_${key}`;
}

/**
 * Sends a vim command — escapes to normal mode first, then types :<command><enter>
 */
export function vimCmd(command: string): LayerCommand {
        return {
                to: [
                        { key_code: "escape" },
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

export function switchProfile(profileName: string): LayerCommand {
        return {
                to: [
                        {
                                shell_command: `"/Library/Application Support/org.pqrs/Karabiner-Elements/bin/karabiner_cli" --select-profile "${profileName}" && osascript -e 'display notification "${profileName}" with title "Profile Switched"'`,
                        },
                ],
                description: `Switch to profile: ${profileName}`,
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
                                shell_command: `open ${what} && "/Library/Application Support/org.pqrs/Karabiner-Elements/bin/karabiner_cli" --select-profile "${profileName}" && osascript -e 'display notification "${profileName}" with title "Profile Switched"'`,
                        },
                ],
                description: `Open ${what} & switch to profile: ${profileName}`,
        };
}
