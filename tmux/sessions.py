#!/usr/bin/env python3
"""tmux sessions as a Hyper wheel: Hyper+J inside iTerm2 (or in Programming mode).

    sessions.py list       the live sessions as wheel items (JSON), one key each
    sessions.py go K       focus the iTerm2 window attached to session K, or
                           open a new window attached to it
    sessions.py projects   project directories with no session yet, as items
    sessions.py new K      open a new iTerm2 window in project K: its .envrc
                           bootstraps and attaches the session (direnv), or
                           `tmux new -A` does for a project without one

The HUD runs `list`/`projects` when the wheel is shown (a `provider` menu in
sublayers.json), and Karabiner binds every wheel key to `go`/`new` with that
key; both sides assign keys with assign() below, so what the wheel shows is
what the key does. Keys: a letter of the name when one is free, else a digit.
"""
import json
import os
import re
import subprocess
import sys

ROOTS = ["~/Documents/Programming", "~/github"]   # where projects (dirs with a .envrc) live
KEYS = "abcdefghiklmopqrstuvwxyz1234567890"   # no j (held: it is the wheel's key), no n (Hyper+J N is the "new" step)
os.environ["PATH"] = "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"


def sh(*cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    return r.stdout if r.returncode == 0 else ""


def osa(script):
    return subprocess.run(["osascript", "-e", script], capture_output=True, text=True).stdout.strip()


def assign(names):
    """name -> key, deterministic for a given set: sorted names, each taking the
    first free letter of its own name, then the first free key of all."""
    out, used = {}, set()
    for n in sorted(names, key=str.lower):
        letters = [c for c in n.lower() if c in KEYS and c.isalpha()]
        k = next((c for c in letters if c not in used), None) or next((c for c in KEYS if c not in used), None)
        if k is None:
            break
        out[n] = k
        used.add(k)
    return out


def item(key, label, symbol):
    return {"key": key.upper(), "code": key, "label": label, "icon": {"symbol": symbol}}


def placeholder(text):
    return [{"key": "", "code": "", "label": text, "icon": {"symbol": "moon.zzz"}}]


# ---- sessions ---------------------------------------------------------------

def sessions():
    rows = [l.split("\t") for l in sh("tmux", "ls", "-F", "#{session_name}\t#{session_attached}\t#{session_path}").splitlines()]
    return {name: {"attached": int(att) > 0, "path": path} for name, att, path in rows}


def clients():
    return dict(l.split("\t") for l in sh("tmux", "list-clients", "-F", "#{client_tty}\t#{session_name}").splitlines())


def cmd_list():
    s = sessions()
    keys = assign(s)
    items = [item(keys[n], n, "terminal.fill" if s[n]["attached"] else "terminal") for n in sorted(s, key=str.lower) if n in keys]
    print(json.dumps(items or placeholder("no tmux sessions")))


def focus_tty(tty):
    """Bring the iTerm2 window whose session sits on `tty` to the front."""
    return osa(f'''
        tell application "iTerm2"
            repeat with w in windows
                repeat with t in tabs of w
                    repeat with s in sessions of t
                        if tty of s is "{tty}" then
                            select w
                            select t
                            select s
                            activate
                            return "ok"
                        end if
                    end repeat
                end repeat
            end repeat
        end tell
        return ""''') == "ok"


def new_window(text):
    """A new iTerm2 window with `text` typed into its shell."""
    osa(f'''
        tell application "iTerm2"
            set w to (create window with default profile)
            tell current session of w to write text "{text}"
            activate
        end tell''')


def cmd_go(key):
    s = sessions()
    name = next((n for n, k in assign(s).items() if k == key), None)
    if name is None:
        return
    ttys = [tty for tty, sess in clients().items() if sess == name]
    if any(focus_tty(t) for t in ttys):
        return
    new_window(f"tmux attach -t '{name}'")


# ---- projects ---------------------------------------------------------------

def project_session(path):
    """The session a project's .envrc creates (SESSION="…"), else its directory name."""
    try:
        with open(os.path.join(path, ".envrc")) as f:
            m = re.search(r'^SESSION="?([^"\n]+)"?', f.read(), re.M)
            if m:
                return m.group(1)
    except OSError:
        pass
    return os.path.basename(path)


def projects():
    out = {}
    for root in ROOTS:
        root = os.path.expanduser(root)
        for d in sorted(os.listdir(root)) if os.path.isdir(root) else []:
            p = os.path.join(root, d)
            if d.startswith(".") or not os.path.isdir(p):
                continue
            if os.path.exists(os.path.join(p, ".envrc")):   # the ones set up as tmux environments
                out[d] = p
    live = sessions()
    return {d: p for d, p in out.items() if project_session(p) not in live}


def cmd_projects():
    p = projects()
    keys = assign(p)
    items = [item(keys[d], d, "folder") for d in sorted(p, key=str.lower) if d in keys]
    print(json.dumps(items or placeholder("every project has a session")))


def cmd_new(key):
    p = projects()
    name = next((d for d, k in assign(p).items() if k == key), None)
    if name is None:
        return
    path = p[name]
    if os.path.exists(os.path.join(path, ".envrc")):
        new_window(f"cd '{path}'")   # direnv runs the .envrc: it creates and attaches the session
    else:
        new_window(f"cd '{path}' && tmux new -A -s '{project_session(path)}'")


if __name__ == "__main__":
    a = sys.argv[1:]
    if a == ["list"]:
        cmd_list()
    elif a == ["projects"]:
        cmd_projects()
    elif len(a) == 2 and a[0] == "go":
        cmd_go(a[1])
    elif len(a) == 2 and a[0] == "new":
        cmd_new(a[1])
    else:
        print(__doc__)
