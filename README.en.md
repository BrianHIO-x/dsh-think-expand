# dsh-think-expand

[中文](README.md) | [英文](README.en.md)

DeepSeek Harness Web plugin. While the model is writing a Think block, every Think row in the conversation opens. Tool cards, context injections, and compaction rows stay as they are.

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
- If any Think row is `data-state="running"`, all Think rows expand.
- After thinking ends they stay open.

## License

MIT
