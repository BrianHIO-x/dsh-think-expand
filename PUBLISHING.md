# 发布与社区目录

本插件以已构建的 JavaScript 分发。`client.js`、`index.js` 和 `cordis.patch.yml` 就是运行资源，安装者无需编译源码。宿主入口没有导入 Cordis，浏览器的 React 由 DSH 模块加载器提供，因此没有额外的运行时 npm 依赖。

## 发布前

1. 使用 Node.js 20 或更新版本，在仓库目录安装开发依赖。
2. 运行 `npm run check`。它检查 JavaScript 语法、现有回归测试和实际 npm 安装包。
3. 核对两个 README 的功能描述、示意图与当前代码；使用真实 DSH 页面测试时，记录宿主和主题版本。示意图始终标明合成内容。
4. 版本号应与 Git 标签、GitHub Release 和 npm 一致。同一个 npm 版本发布后不可覆盖。

## GitHub Release

使用安装包检查生成的 `artifacts/dsh-think-expand-<版本>.tgz`，在 GitHub Release 中上传为稳定文件名 `dsh-think-expand.tgz`。这让社区目录可以使用以下地址，并在下次发版时继续工作：

```text
https://github.com/BrianHIO-x/dsh-think-expand/releases/latest/download/dsh-think-expand.tgz
```

Release 说明应包含本版本功能、安装命令、实际通过的验证，以及仍需验证的兼容范围。把实际安装包和 SHA-256 校验和一起附上，方便用户验证下载文件。

## npm

`publishConfig` 指定官方 npm registry。先在终端通过 npm 官方网页登录，再确认账号具有 `dsh-think-expand` 的发布权限：

```sh
npm login --auth-type=web --registry=https://registry.npmjs.org
npm whoami --registry=https://registry.npmjs.org
npm publish --dry-run
npm publish --access public --registry=https://registry.npmjs.org
```

密码、验证码与发布权限确认都在 npm 自己的界面完成。凭据不提交到仓库。若包名已被其他账号占用，先选择本人有权限的 scope，再同步包名、补丁的 `name` 与安装命令，重新执行检查。

发布命令成功后，仍需核对 registry 中的正式版本、`latest` 和 `dist.integrity`，并从 registry 做一次独立安装。npm 有时会在后台处理期间暂时公开 `0.0.0-stage` 占位版本；先用 `npm stage list` 检查待批准队列。有待审项时按官方流程批准；队列为空时等待正式版本公开，再做安装验证。处理中的同一版本保留原包内容。

npm 包地址为 [dsh-think-expand](https://www.npmjs.com/package/dsh-think-expand)，用户可以按包名安装：

```sh
dsh plugin --profile web add dsh-think-expand
```

## 社区目录

本项目的条目为：

```text
awesome-dsh-plugin/awesome-dsh-plugin
data/plugins/BrianHIO-x__dsh-think-expand.yml
```

只更新这一条 YAML 的中英文描述和可用的 GitHub Release `tarball` 地址。目录的两个 README 由数据生成，维护者合并投稿后会重建网站。

目录会从 npm registry 自动发现 `repository` 指向本仓的包，并更新下载统计与 Discover 安装索引。YAML 条目无需填写 `npm` 字段；手写此字段会被目录校验拒绝。

本仓 `screenshots.json` 按社区约定列出演示图片的相对路径。保持图片中的“合成内容”标识，后续可以加入去除私人内容的真实截图。目录重建时间和 PR 合并由该项目维护者决定。
