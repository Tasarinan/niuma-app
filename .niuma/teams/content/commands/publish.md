---
description: 把当前稿推到指定平台草稿箱（微信须 publish.py full）
argument-hint: [WECHAT|XHS|ZHIHU] [account]
---

# 推草稿箱（/publish）

平台：`$0`。账号槽位：`$1`。全部参数：`$ARGUMENTS`。

切换到**发行**。这是**推草稿箱**，不是选题会。不要 `ROUTE` 给主理人，不要开会，不要 mkdir。

## 前置条件

- 必须先指定平台：`WECHAT` / `XHS` / `ZHIHU`
- 未指定时先问用户，**不要默认微信**
- 只要排版、不发布时用 `/format`
- 开新题 `/article create`，继续已定题稿 `/article edit <target>`，推草稿箱用 `/publish`

## 按平台执行

### WECHAT — 微信公众号草稿箱

1. 加载 `article-formatting-wechat`、`article-publish-wechat`
2. 应用注入 `[微信公众号槽位]`：让用户确认槽位序号 **N**
3. 在**仓库根**执行（基于磁盘最新 `article.md`）：

```bash
python .niuma/teams/content/skills/article-publish-wechat/scripts/publish.py --account N full .niuma/artifacts/drafts/<主题目录>/
```

4. `full` 会先跑 `format.py` 再上传；**禁止**直接上传旧 `article.html`，**禁止** `--skip-format`
5. 不要打印 APPSECRET

### XHS — 小红书

- 加载 `article-publish-xhs`
- **尚未接通**：禁止 mkdir、禁止写笔记、禁止假装已发；不要跑微信 `publish.py`

### ZHIHU — 知乎

- 加载 `article-publish-zhihu`
- **尚未接通**：禁止 mkdir、禁止假装已发；不要跑微信 `publish.py`

## 边界

- 不要读 `.aws-article`
- 不要创建 `.niuma-article/`
- 禁止用聊天里的旧正文代替磁盘文件

## 示例

```
/publish WECHAT
/publish WECHAT 2
/publish XHS
/publish ZHIHU
```
