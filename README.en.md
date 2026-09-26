# dsh-think-expand

[中文](README.md) | [英文](README.en.md)

DeepSeek Harness Web plugin. While the switch is on, every Think row in the conversation opens, including after you change sessions. DSH 0.1.7 tucks Think rows into step groups and folded turns, so the plugin first opens the groups and turns that hold a Think row, then expands the Think rows inside. Tool cards, context injections, and compaction rows stay as they are.

## Install

Needs `dsh` 0.1.7-rc.2 or later and the `web` profile.

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

- Matches the official Think row only (`data-variant="think"`).
- The session header has a `Think` switch. On expands every Think row; off collapses them all.
- A Think row you collapse by hand stays collapsed until you use the header switch again. Each header action clears previous manual choices and applies to every Think row.
- While the switch is on, the plugin opens every step group and folded turn (its elapsed-time line) that holds a Think row, then expands only the Think rows. Tool rows inside stay collapsed, and groups without a Think row stay folded.
- DSH folds a turn when it finishes; with the switch on, the plugin opens it again.
- A group or turn you close by hand stays closed until you use the header switch again.
- Turning the switch off collapses every Think row and refolds the groups and turns the plugin opened. Groups and turns you opened yourself stay open.
- Opening groups and turns never moves focus, so the conversation does not jump.
- The switch is stored in the browser, so it survives a refresh.

## License

MIT
