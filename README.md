# dsh-think-expand

[中文](README.md) | [英文](README.en.md)

DeepSeek Harness 的 Web 插件。开关打开时，对话里的全部 Think 行会自动展开，包括切换会话之后。DSH 0.1.7 把 Think 收进了步骤分组（例如「执行了命令」「已完成分析」）和折叠的轮次里，插件会先打开装有 Think 的分组和轮次，再展开其中的 Think。工具卡片、上下文注入、压缩行不会被打开。

## 安装

需要 `dsh` 0.1.7-rc.2 或更新版本，以及 `web` 配置。已在官方 0.2.1-alpha.2 网页端上实测，同时装有 dsh-claude-style 主题。

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
- 会话标题栏有一个 `Think` 开关：打开展开全部 Think，关掉收起全部 Think。
- 手动收起某一条后，这条会保持收起；再次操作标题栏总开关时，所有 Think 行统一按开关状态展开或收起，之前的手动记录随之清除。
- 开关打开时，插件会打开装有 Think 的步骤分组和折叠的轮次（「用时 X 分 X 秒」那一行），然后只展开其中的 Think。分组里的工具行保持收起，不含 Think 的分组保持折叠。
- 一轮结束后 DSH 会自动折叠这一轮，开关打开时插件会把它重新打开。
- 你手动收起的分组或轮次会保持收起，直到下一次操作标题栏开关。
- 关掉开关时，插件收起全部 Think，并把它自己打开过的分组和轮次折叠回去；你自己打开的分组和轮次不受影响。
- 插件打开分组和轮次时不会移动焦点，对话不会因此跳动。
- 只有你亲手的点击和按键才算手动操作。其他插件用程序触发的展开或收起（例如主题在思考结束后自动收起 Think 行）不会被记成你的选择，开关打开时插件会把这些行重新展开。
- 兼容给折叠加动画的主题（例如 dsh-claude-style）。这类主题会在动画期间吞掉对话区的点击，所以插件用 Think 行自带的回车键切换它，不经过点击；分组和轮次的点击如果被吞掉，插件会在动画结束后重试，每个控件最多 5 次。
- 开关状态保存在浏览器本地，刷新后仍然有效。

## 许可证

MIT
