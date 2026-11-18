#!/usr/bin/env python3
"""Add and remove daily games without touching code.

    games.py add      the frontmost browser tab becomes a game on the next
                      free key (or, if that site is already a game, offers to
                      remove it)
    games.py remove K its game on key K goes

games.json is what profiles/trivia.ts builds the Hyper+G wheel and Trivia
mode's bare keys from, so after a change this rebuilds the config
(karabiner.json, CHEATSHEET.md, hammerspoon/sublayers.json); Karabiner and
the HUD pick the new files up on their own. Bound to Hyper+G = and, for
remove, Hyper+G - followed by the game's key.
"""
import json
import os
import re
import subprocess
import sys
import time

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GAMES = os.path.join(REPO, "trivia", "games.json")
LOG = "/tmp/karabiner-build.log"
# Keys handed out in this order: digits make the inner ring, letters the outer.
# No g: the wheel is Hyper+G and that key is already held, so Hyper+G G cannot
# be pressed (the build refuses it too). x stays free (Trivia mode's close-tab
# key) and so do Hyper+G's own = and -.
KEY_ORDER = list("1234567890asdfqwertyuiophjklzcvbnm")
os.environ["PATH"] = "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"


def osa(script, *args, lang="AppleScript"):
    cmd = ["osascript", "-l", lang, "-e", script, *args]
    return subprocess.run(cmd, capture_output=True, text=True).stdout.rstrip("\n")


def jxa(body, *args):
    """A JXA snippet with dialogs enabled; its return value comes back as JSON."""
    src = (
        "function run(argv) { const app = Application.currentApplication();"
        " app.includeStandardAdditions = true; app.activate();"
        f" let out = null; try {{ {body} }} catch (e) {{ out = null; }}"
        " return JSON.stringify(out); }"
    )
    out = osa(src, *args, lang="JavaScript")
    return json.loads(out) if out else None


def notify(title, text):
    osa(f'display notification "{text}" with title "Trivia games: {title}"')


def load():
    with open(GAMES) as f:
        return json.load(f)


def save(games):
    with open(GAMES, "w") as f:
        json.dump(games, f, indent=2, ensure_ascii=False)
        f.write("\n")


def rebuild():
    # The login build agent already knows where node and yarn live.
    plist = os.path.expanduser("~/Library/LaunchAgents/com.karabiner-config.build.plist")
    try:
        node = subprocess.check_output(
            ["plutil", "-extract", "ProgramArguments.0", "raw", plist], text=True).strip()
        yarn = subprocess.check_output(
            ["plutil", "-extract", "ProgramArguments.1", "raw", plist], text=True).strip()
    except Exception:
        node, yarn = "node", "yarn"
    env = dict(os.environ, PATH=os.path.dirname(node) + ":" + os.environ["PATH"])
    with open(LOG, "a") as log:
        r = subprocess.run([node, yarn, "--silent", "build"], cwd=REPO, env=env, stdout=log, stderr=log)
    if r.returncode != 0:
        notify("build failed", f"see {LOG}")
        sys.exit(1)


def frontmost():
    return osa('tell application "System Events" to name of first process whose frontmost is true')


def current_url():
    """The address bar's contents, the way that works in every browser:
    ⌘L selects it, ⌘C copies it, Escape hands focus back. The clipboard is
    put back afterwards."""
    saved = subprocess.run(["pbpaste"], capture_output=True, text=True).stdout
    osa('tell application "System Events"\n'
        '  keystroke "l" using command down\n  delay 0.15\n'
        '  keystroke "c" using command down\n  delay 0.15\n'
        '  key code 53\nend tell')
    time.sleep(0.1)
    url = subprocess.run(["pbpaste"], capture_output=True, text=True).stdout.strip()
    subprocess.run(["pbcopy"], input=saved, text=True)
    return url


def current_title():
    # Firefox-family browsers report a nameless first window; take the first
    # window that has a title.
    names = osa('tell application "System Events" to name of every window of '
                '(first process whose frontmost is true)')
    t = next((n.strip() for n in names.split(", ") if n.strip()), "")
    # Drop the browser's own suffix: "Wordle — Zen Browser", "… - Google Chrome".
    return re.sub(r"\s+[-—–]\s+[^-—–]*$", "", t).strip()


def suggested_name(url):
    """The tab title, or failing that the site's name from its host."""
    t = current_title()
    if t:
        return t
    host = re.sub(r"^https?://(www\.)?", "", url).split("/")[0]
    return host.split(".")[0].capitalize()


def same_site(a, b):
    norm = lambda u: re.sub(r"^https?://(www\.)?", "", u).rstrip("/").lower()
    return norm(a) == norm(b)


def add():
    url = current_url()
    if not re.match(r"^https?://", url):
        notify("nothing added", f"{frontmost()} did not hand over a URL")
        return
    games = load()
    hit = next((g for g in games if same_site(g["url"], url)), None)
    if hit:
        ok = jxa('out = app.displayDialog(argv[0], {buttons: ["Cancel", "Remove"], defaultButton: "Remove",'
                 ' withTitle: "Trivia games", withIcon: "caution"}).buttonReturned',
                 f'{hit["name"]} is already a game, on {hit["key"].upper()}.\n\nRemove it?')
        if ok == "Remove":
            save([g for g in games if g is not hit])
            rebuild()
            notify("removed", f'{hit["name"]} ({hit["key"].upper()})')
        return
    used = {g["key"] for g in games}
    key = next((k for k in KEY_ORDER if k not in used), None)
    if key is None:
        notify("wheel full", "remove a game first (Hyper+G - then its key)")
        return
    name = jxa('out = app.displayDialog(argv[0], {defaultAnswer: argv[1], buttons: ["Cancel", "Add"],'
               ' defaultButton: "Add", withTitle: "Trivia games"}).textReturned',
               f"Add as a trivia game on {key.upper()}?\n\n{url}", suggested_name(url))
    if not name or not name.strip():
        return
    games.append({"key": key, "name": name.strip(), "url": url})
    save(games)
    rebuild()
    notify("added", f"{name.strip()} is on {key.upper()}")


def remove(key):
    games = load()
    hit = next((g for g in games if g["key"] == key), None)
    if not hit:
        notify("nothing removed", f"no game on {key.upper()}")
        return
    save([g for g in games if g is not hit])
    rebuild()
    notify("removed", f'{hit["name"]} ({key.upper()})')


if __name__ == "__main__":
    args = sys.argv[1:]
    if args[:1] == ["add"]:
        add()
    elif len(args) == 2 and args[0] == "remove":
        remove(args[1])
    else:
        print(__doc__)
