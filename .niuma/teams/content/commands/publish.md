---
description: 排版并发布当前公众号稿 — 小助理用最新 article.md 生成 HTML，再协助发到公众号
agent: 小助理
arguments:
  - name: account
    description: 公众号槽位序号或名称（可空，空则先让用户选）
    required: false
---
切换到**小助理**。加载 `wechat-article-formatting` 和 `wechat-article-publish`。

这不是选题会。不要 `ROUTE` 给主理人，不要开会，不要 mkdir。

应用会注入 `[微信公众号槽位]` 和当前文稿路径。发布时在仓库根执行 **`publish.py full <草稿目录> --account N`**——脚本会**自动**从磁盘最新 `article.md` 跑 `format.py` 再上传，**禁止**直接发布旧 `article.html`。不要 `--skip-format`。不要打印 APPSECRET。不要读 `.aws-article`。不要创建 `.niuma-article/`。
