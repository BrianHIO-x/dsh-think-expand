# dsh-think-expand

[中文](#中文) | [English](#english)

---

## 中文

DeepSeek Harness 的 Web 插件。模型正在输出 Think 时，对话里的全部 Think 行会自动展开。工具卡片、上下文注入、压缩行不会被打开。

这不是 DeepSeek 官方插件。

### 安装

需要可用的 `dsh` 和 `web` 配置。

```sh
dsh plugin --profile web add github:BrianHIO-x/dsh-think-expand
```

本地目录：

```sh
dsh plugin --profile web add /path/to/dsh-think-expand
```

重新启动 `dsh web`。主机终端应出现 `[dsh-think-expand] plugin loaded!`。

卸载：

```sh
dsh plugin --profile web remove dsh-think-expand
```

### 行为

- 只匹配官方 Think 行（`data-variant="think"`）。
- 任意一条 Think 行处于 `data-state="running"` 时，展开全部 Think 行。
- 思考结束后保持展开。

### 许可证

MIT

---

## English

DeepSeek Harness Web plugin. While the model is writing a Think block, every Think row in the conversation opens. Tool cards, context injections, and compaction rows stay as they are.

Not an official DeepSeek plugin.

### Install

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

### Behavior

- Matches the official Think row only (`data-variant="think"`).
- If any Think row is `data-state="running"`, all Think rows expand.
- After thinking ends they stay open.

### License

MIT
