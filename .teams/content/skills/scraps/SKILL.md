---
name: scraps
description: 按预置信源或指定文章网址采集热点与正文，写入 .artifacts/scraps，并按统一模板写中文深度条目。当用户使用 /scrap、要每日采集、科技/财经早报或新闻扫描时使用。不写 /digest 的 daily-report。
---

# 采集 scraps

三步：拉 JSON → 按统一模板写成中文 → 落到 `.artifacts/scraps/<YYYY-MM-DD>/`。只使用脚本 JSON 和抽到的正文。

## 核心功能

### 1. 解析参数
- 无参：`general` 早报组（HN、PH、GitHub、微博、36氪、腾讯、华尔街见闻、V2EX）
- `/scrap tech|finance|social`：对应分组
- `/scrap hackernews,36kr`：指定源
- `/scrap AI` 或 `/scrap tech GPT,Claude`：关键词过滤 + 标题去重 + 相关度排序
- `/scrap https://…`：只抽这些文章全文
- 文风档案网址当作额外文章 URL

### 2. 热点采集
```bash
python .teams/content/skills/scraps/scripts/collect.py --sources general --deep
```
底层复用 `topic-research` 的 `fetch_news.py`。`--deep` 先 HTTP 抽正文；正文过短或撞上 Cloudflare 时，用 Playwright 无头 Chromium 再读（最多 15 篇）。未安装 Playwright 时跳过浏览器，不中断采集。源失败跳过，记进 `failed`。用户说「AI」时把关键词扩成 `AI,LLM,GPT,Claude,Agent,RAG,DeepSeek`。

可选安装（本机一次）：

```bash
pip install -r .teams/content/skills/scraps/requirements.txt
python -m playwright install chromium
```

也可设 `CHROME_PATH` / `PLAYWRIGHT_CHROMIUM_EXECUTABLE` 指向本机 Chrome 或 Edge。`--no-playwright` 可关掉浏览器回退。

### 3. 单篇正文
指定的 http(s) 用 `web-to-markdown`。没有 `web_fetch`。

### 4. 落盘与报告
目录：`.artifacts/scraps/<YYYY-MM-DD>/`
- 每条一篇 Markdown，文首原 URL，正文用统一模板
- `briefing.md`：约 20–25 条（不够就全写，禁止编造凑数）
- `index.json`

模板见 [references/report-template.md](references/report-template.md)。

## 使用说明

### 触发条件

- ✅ `/scrap`、科技/财经/社交早报、扫 HN / 36氪
- ❌ `/digest`（读已采集材料写日报，本技能不再拉源）
- ❌ `/outline` 写稿调研（仍用 `topic-research`）

### 执行步骤

1. 跑 `collect.py`（或只抽指定 URL）
2. **每一条**按模板写成中文：Title / Source / Time / Heat / Links / Summary / Deep Dive
3. Time 必填；缺则 `Unknown Time`。HN 必须带 Discussion。Deep Dive 只用 `content` 字段，没有就写「材料不足，仅标题」
4. 写 `index.json` 和 `briefing.md`，再给列表报

## 预置分组

见 [sources.json](sources.json)。`general` / `tech` / `finance` / `social`。

## 安全与合规

- ❌ 不编造热点、URL、热度或因果
- ❌ 不把多条新闻揉成一条
- ❌ 不代替 `/digest` 写 `daily-report.md`
- ✅ 源失败写进列表

## 相关命令

- `/scrap` — 采集并写 briefing
- `/digest` — 根据 scraps 写日报或月报
