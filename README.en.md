# dsh-think-expand

[中文](README.md) | [英文](README.en.md)

DeepSeek Harness Web plugin. By default it changes nothing and leaves every Think row to you. Press the `Think` switch in a session's header and only that session, in that window, opens or closes all of its Think rows. Since DSH 0.1.7, Think rows live inside step groups and folded turns, so with the switch on the plugin first opens the groups and turns that hold a Think row, then expands the Think rows inside. Tool cards, context injections, and compaction rows stay as they are.

## Install

Needs `dsh` 0.1.7-rc.2 or later and the `web` profile. Tested on the official 0.2.1-rc.4 web UI, with the dsh-claude-style 0.19.5 theme installed.

```sh
dsh plugin --profile web add github:BrianHIO-x/dsh-think-expand
```

Local checkout:

```sh
dsh plugin --profile web add /path/to/dsh-think-expand
```

Restart `dsh web`. The host terminal should print `[dsh-think-expand] plugin loaded!`.

Uninstall:

```sh
dsh plugin --profile web remove dsh-think-expand
```

## Behavior

### What the switch covers

- The switch starts off. While it is off the plugin watches nothing and touches no Think row; you open and close them by hand, as in plain DSH.
- Each session has its own switch, and it acts only on that session in this window's main area. Turning it on for one session leaves every other session off.
- Subagents work the same way: a subagent session opened in the main area starts with its switch off and can be turned on on its own. A subagent chat opened in the right Sidebar has no header and so no switch; the plugin leaves it alone, and its Think rows stay under your control.
- Switch states live in this window's memory only. Leave a session and come back and its switch is as you left it; a new window or a reload starts every session off. The old browser-wide switch from earlier versions is removed.

### With the switch on

- Matches the official Think row only (`data-variant="think"`).
- The plugin opens every step group and folded turn (its elapsed-time line) that holds a Think row, then expands only the Think rows. Tool rows inside stay collapsed, and groups without a Think row stay folded.
- DSH folds a turn when it finishes; with the switch on, the plugin opens it again.
- A Think row, group, or turn you close by hand stays closed until you press the switch again.
- Turning the switch off collapses every Think row in that session and refolds the groups and turns the plugin opened. Groups and turns you opened yourself stay open.
- Opening groups and turns never moves focus, so the conversation does not jump.
- With the switch on, step groups grow with their content and the conversation scrolls as one page. DSH caps an open group at 400 pixels with its own scrollbar; with every group open, the wheel kept landing in those boxes, the page barely moved when scrolling up, and history brought in by "Load earlier" never came into view. Sessions whose switch is off keep DSH's own look.
- When the plugin opens or closes content, it keeps your place: content above you can grow or shrink and the line you were reading stays put. After "Load earlier" you stay where you were with the older content above, as in plain DSH. Any scroll, click, or key press of yours ends this at once, and while you follow the newest output DSH keeps that pinned itself.
- Only your own clicks and key presses count as manual choices. When another plugin opens or closes a row programmatically (for example a theme folding a Think row once reasoning ends), that is not recorded as your choice, and with the switch on the plugin opens the row again.
- Works with themes that animate folds, such as dsh-claude-style. Those themes swallow chat clicks while an animation runs, so the plugin toggles Think rows with their own Enter key handler instead of a click, and retries a swallowed group or turn click after the animation, up to 5 times per control.

### Performance

- A session whose switch is off costs nothing.
- With the switch on, the plugin observes that one session's chat area. Streaming answer text and reasoning being written do not trigger a scan; the plugin checks again only when a new Think row appears or a group, turn, or Think row folds or unfolds.

## License

MIT
