# scripts

发布校验脚本目录。`check-package.mjs` 使用零依赖的 Node 脚本调用 `npm pack --ignore-scripts`，
读取实际 tgz，验证宿主和浏览器入口、Cordis 补丁、README 相对链接与 screenshots.json 中的资源，
并生成版本化安装包、稳定文件名副本和 SHA-256 校验和。版本号由 package.json 读取。
默认与严格模式都会检查资源完整性；`--release` 额外打印发布指令。

脚本不执行 `npm publish`。产物只写到项目内的 `artifacts/`，由 git 忽略；
不要把本目录加入 package.json 的 files 白名单。

## 演示生成器

`render-demo.py` 生成 `docs/demo.svg`、`docs/demo.png` 与 `docs/demo.gif`（同一合成场景）。
它只使用标准库画 SVG；PNG/GIF 模式才需要外部 Pillow，并由调用方提供隔离环境，例如
`PYTHONPATH=.verification/python python3 scripts/render-demo.py`。中文字体默认探测 Noto Sans CJK，
也可用 `--font-regular` / `--font-bold` 指定。GIF 是 640×840 的合成插画循环，不是录屏。
图片必须保留“合成内容 / synthetic content”标注，不得当作真实 DSH 截图或版本实测。
它不属于发布校验脚本，也不改 `package.json`。
