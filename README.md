# dsh-think-expand

[中文](README.md) | [英文](README.en.md)

DeepSeek Harness 的 Web 插件。模型正在输出 Think 时，对话里的全部 Think 行会自动展开。工具卡片、上下文注入、压缩行不会被打开。

## 安装

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

## 行为

- 只匹配官方 Think 行（`data-variant="think"`）。
- 任意一条 Think 行处于 `data-state="running"` 时，展开全部 Think 行。
- 思考结束后保持展开。

## 许可证

MIT
