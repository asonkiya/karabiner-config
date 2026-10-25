import Foundation

// An overlay is anything the agent draws in response to a Karabiner
// `send_user_command`. Payloads are JSON objects whose top-level key names
// the overlay: {"hud": "show", ...} goes to the overlay registered as "hud".
// Everything under that key is the overlay's own protocol.
//
// To add one: write a type conforming to Overlay (draw into an HUDWindow,
// animate with Drawing.swift), register it in main.swift, and give utils.ts
// a typed wrapper over `userCommand` so bindings can send to it.
protocol Overlay: AnyObject {
    // `command` is the value under the overlay's key; `message` the whole payload.
    func handle(command: Any, message: [String: Any])
}

final class Router {
    private var overlays: [String: Overlay] = [:]

    func register(_ key: String, _ overlay: Overlay) {
        overlays[key] = overlay
    }

    // Called on the main thread with every decoded datagram.
    func dispatch(_ json: Any) {
        guard let message = json as? [String: Any] else {
            log("ignored non-object payload: \(json)")
            return
        }
        for (key, overlay) in overlays {
            if let command = message[key] {
                overlay.handle(command: command, message: message)
                return
            }
        }
        log("no overlay for payload: \(message)")
    }
}
