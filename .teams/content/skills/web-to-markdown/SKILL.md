---
name: web-to-markdown
description: 按域名把网址收成 Markdown。当用户使用 /scrap 指定文章网址、丢来一篇网页链接，或公众号/知乎/飞书正文打不开时使用。打不开就说明原因，不要编造。
---

# 网址转 Markdown

把 http(s) 页面抽成带原 URL 的 Markdown。失败时说明原因，不要编造正文。

## 核心功能

### 1. 按域名选路
- 默认 / X：`https://r.jina.ai/<url>`
- YouTube：`https://defuddle.md/<url>`
- 微信 / 知乎 / 飞书：`scripts/fetch_special_sites.mjs`

### 2. 失败回退
默认失败则：直连 HTML + Readability → 再不行浏览器抽取。

### 3. 落盘与列表报
- `/scrap` 指定文章时每个网址一篇 Markdown，文首写原 URL，写到 `.artifacts/scraps/<YYYY-MM-DD>/`
- 列表报：标题、网址、一句摘要、本地路径

## 使用说明

### 触发条件

当用户提到以下场景时，使用此技能：

- ✅ `/scrap` 里的文章网址
- ✅ 用户贴了 http(s) 要全文
- ✅ 公众号 / 知乎 / 飞书打不开

### 执行步骤

#### 步骤 1: 规范化 URL

#### 步骤 2: 选路抓取
```bash
node scripts/url_to_markdown.mjs <url>
```
元数据加 `--json`。强制特殊站点：`node scripts/fetch_special_sites.mjs <url> --json`

#### 步骤 3: 写入并汇报
`/scrap` 的文章 URL 写到注入的当天 scraps 目录。打不开就说明原因。

细则：[references/routing-and-notes.md](references/routing-and-notes.md)

## 数据源

| 数据源 | 位置 | 内容 |
|--------|------|------|
| 通用脚本 | `scripts/url_to_markdown.mjs` | 默认抽取 |
| 特殊站点 | `scripts/fetch_special_sites.mjs` | 微信 / 知乎 / 飞书 |
| 路由说明 | `references/routing-and-notes.md` | 域名表 |

## 安全与合规

- ❌ 不编造打不开的正文
- ❌ 不代替 `/digest` 做选题
- ✅ 文首保留原 URL

## 相关命令

- `/scrap` — 采集（预置信源由 scraps 处理；本技能只抽文章）
- `/digest` — 采完后再写报告（本技能不做）
