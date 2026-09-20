---
description: 把当前稿推到指定平台的草稿箱
agent: 发行
arguments:
  - name: platform
    description: 平台 WECHAT(微信)/XHS(小红书)/ZHIHU(知乎)
    required: true
  - name: account
    description: 公众号槽位序号或名称（仅 WECHAT，可空）
    required: false
---
切换到**发行**。这是**推草稿箱**，不是选题会。不要 `ROUTE` 给主理人，不要开会，不要 mkdir。开新题用 `/new`，续写用 `/resume`，只要排版不要发用 `/format`。

必须先有平台：`WECHAT` / `XHS` / `ZHIHU`。未指定时先问用户，不要默认微信。

- **WECHAT**：加载 `article-formatting-wechat` 和 `article-publish-wechat`。应用会注入 `[微信公众号槽位]`。在仓库根执行 **`publish.py full <草稿目录> --account N`**——脚本会从磁盘最新 `article.md` 跑 `format.py` 再上传到**微信草稿箱**。禁止直接发布旧 `article.html`。不要 `--skip-format`。
- **XHS**：加载 `article-publish-xhs`。尚未接通：禁止 mkdir、禁止写笔记、禁止假装已发到小红书、不要跑微信 `publish.py`。
- **ZHIHU**：加载 `article-publish-zhihu`。尚未接通：禁止 mkdir、禁止假装已发到知乎、不要跑微信 `publish.py`。

不要打印 APPSECRET。不要读 `.aws-article`。不要创建 `.niuma-article/`。
