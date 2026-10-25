import AppKit
import KarabinerElementsUserCommandReceiver

// karabiner-hud — the which-key weapon wheel, drawn natively.
//
// Listens on Karabiner's user-command socket (UNIX datagram) for the HUD
// messages that `hudEvent` in utils.ts emits, and renders the wheel from
// hammerspoon/sublayers.json. No Dock icon, no menu bar item, no focus.
//
//   karabiner-hud [--data <sublayers.json>] [--socket <path>]
//
// Defaults: the data file is hammerspoon/sublayers.json in the first
// ancestor of this executable that has one (the repo, when run from
// <repo>/hud/.build/...), the socket is Karabiner's default
// user_command_receiver.sock.

func defaultDataPath() -> String {
    let exe = (Bundle.main.executableURL ?? URL(fileURLWithPath: CommandLine.arguments[0]))
        .resolvingSymlinksInPath()
    var dir = exe.deletingLastPathComponent()
    while dir.path != "/" {
        let candidate = dir.appendingPathComponent("hammerspoon/sublayers.json")
        if FileManager.default.fileExists(atPath: candidate.path) { return candidate.path }
        dir = dir.deletingLastPathComponent()
    }
    return "hammerspoon/sublayers.json"
}

var dataPath = defaultDataPath()
var socketPath = KEUserCommandReceiver.defaultSocketPath()
var args = CommandLine.arguments.dropFirst().makeIterator()
while let a = args.next() {
    switch a {
    case "--data": dataPath = args.next() ?? dataPath
    case "--socket": socketPath = args.next() ?? socketPath
    case "-h", "--help":
        print("usage: karabiner-hud [--data <sublayers.json>] [--socket <path>]")
        exit(0)
    default:
        log("unknown argument \(a)")
        exit(2)
    }
}

let app = NSApplication.shared
app.setActivationPolicy(.accessory)

let controller = HUDController(dataPath: dataPath)
let receiver = KEUserCommandReceiver(
    path: socketPath,
    onJSON: { json in DispatchQueue.main.async { controller.handle(json) } },
    onError: { error in log("receiver: \(error)") }
)
Task {
    do {
        try await receiver.start()
        log("listening on \(socketPath); data \(dataPath)")
    } catch {
        log("cannot start receiver: \(error)")
        exit(1)
    }
}

// Unlink the socket on the way out so a restart binds cleanly.
var signalSources: [DispatchSourceSignal] = []
for sig in [SIGINT, SIGTERM] {
    signal(sig, SIG_IGN)
    let src = DispatchSource.makeSignalSource(signal: sig, queue: .main)
    src.setEventHandler {
        Task {
            await receiver.stop()
            exit(0)
        }
    }
    src.resume()
    signalSources.append(src)
}

app.run()
