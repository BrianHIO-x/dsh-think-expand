# dsh-think-expand

[中文](README.md) | [英文](README.en.md)

DeepSeek Harness Web plugin. While the switch is on, every Think row in the conversation opens, including after you change sessions. Tool cards, context injections, and compaction rows stay as they are.

## Install

Needs a working `dsh` and the `web` profile.

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
- A Think row you collapse by hand stays collapsed.
- The switch is stored in the browser, so it survives a refresh.

## License

MIT
