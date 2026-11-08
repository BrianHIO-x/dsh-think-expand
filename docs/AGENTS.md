# docs

README 与仓库截图目录使用的演示素材目录。所有图都由 `../scripts/render-demo.py` 生成，内容是**合成插图**，不是 DSH 的真实截图，也不是任何版本的实测记录；图中必须保留“功能示意 · 合成内容 / Illustrative demo · synthetic content”和“非 DSH 截图 · 非版本实测”这两层说明。

- `demo.svg`：静态、无脚本、无外部资源，可直接嵌入 GitHub README。
- `demo.png`：同一场景的 2x 栅格版，供 `screenshots.json` 或需要 PNG 的目录使用。
- `demo.gif`：640×840、约 5 秒的合成循环，演示“开关关闭时手动打开的行保持”与“点标题栏 Think 后本会话全部展开、工具卡仍折叠”。它是插画动画，不是录屏。
- 生成命令：`PYTHONPATH=.verification/python python3 scripts/render-demo.py`。生成 SVG 不需要第三方包；生成 PNG/GIF 需要 Pillow 与中文字体（默认探测 Noto Sans CJK，可用 `--font-regular` / `--font-bold` 覆盖）。
- 修布局、文案或配色时改生成器后重新生成，不要手改产物；产物里的合成内容标注不能删除。
