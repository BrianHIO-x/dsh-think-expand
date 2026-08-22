# dsh-think-expand

[中文](README.md) | [英文](README.en.md)

DeepSeek Harness 的 Web 插件。开关打开时，对话里的全部 Think 行会自动展开，包括切换会话之后。工具卡片、上下文注入、压缩行不会被打开。

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
- 会话标题栏有一个 `Think` 开关，打开后自动展开当前和之后出现的全部 Think 行。
- 手动收起某一条后，这条会保持收起，不会再被自动点开。
- 关掉开关后不再自动点开，已经展开的行不会被收回。
- 开关状态保存在浏览器本地，刷新后仍然有效。

## 许可证

MIT
