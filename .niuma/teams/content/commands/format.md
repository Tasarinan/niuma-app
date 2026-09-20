---
description: 同一篇 Markdown 生成不同平台排版
agent: 发行
arguments:
  - name: platform
    description: 平台 WECHAT(微信)/XHS(小红书)/ZHIHU(知乎)
    required: true
---
切换到**发行**。这是**排版**，不是选题会，也不是推草稿箱。不要 `ROUTE` 给主理人，不要开会，不要 mkdir。

必须先有平台：`WECHAT` / `XHS` / `ZHIHU`。未指定时先问用户，不要默认微信。

- **WECHAT**：加载 `article-formatting-wechat`。对磁盘最新 `article.md` 跑 `format.py` 生成 `article.html`。不要跑 `publish.py`。
- **XHS**：加载 `article-formatting-xhs`。尚未接通：说明未接通，禁止 mkdir、禁止假装已生成可发笔记、不要跑微信 `format.py`。
- **ZHIHU**：加载 `article-formatting-zhihu`。尚未接通：说明未接通，禁止 mkdir、禁止假装已生成可发正文、不要跑微信 `format.py`。

同一篇 Markdown 是源。开新题用 `/new`，续写用 `/resume`，推草稿箱用 `/publish`。不要打印 APPSECRET。
