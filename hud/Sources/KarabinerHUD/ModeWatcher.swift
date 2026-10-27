import Foundation

// Watches the /tmp/karabiner_mode_* flags (written by switchMode in utils.ts
// and by Hammerspoon's app auto-switching) and reports the mode when it
// changes. A write event on /tmp is anything created or removed there, so
// the check is debounced and only an actual change gets through.
final class ModeWatcher {
    private var source: DispatchSourceFileSystemObject?
    private var last = Model.currentMode()
    private var pending: DispatchWorkItem?

    init(onChange: @escaping (String) -> Void) {
        let fd = open("/tmp", O_EVTONLY)
        guard fd >= 0 else {
            log("cannot watch /tmp for mode flags")
            return
        }
        let src = DispatchSource.makeFileSystemObjectSource(fileDescriptor: fd, eventMask: .write, queue: .main)
        src.setEventHandler { [weak self] in
            guard let self else { return }
            pending?.cancel()
            let item = DispatchWorkItem { [weak self] in
                guard let self else { return }
                let m = Model.currentMode()
                if m != last {
                    last = m
                    onChange(m)
                }
            }
            pending = item
            DispatchQueue.main.asyncAfter(deadline: .now() + .milliseconds(40), execute: item)
        }
        src.setCancelHandler { close(fd) }
        src.resume()
        source = src
    }
}
