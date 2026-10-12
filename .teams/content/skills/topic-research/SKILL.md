---
name: topic-research
description: 针对一个想法先查本地素材，再采集热点和网页，给出写法和主题。当用户使用 /outline 写初稿前，或问这个题网上怎么写时使用。不定最终标题、不写正文。
---

# 选题调研

参考 wemp-ops 的采集顺序：本地收藏 → 热点源 → 搜索 → 深读。产出**主题和写法**，不是最终标题。若主题已在 `topic.md` 锁定，只保留能支撑该主题的材料。

## 核心功能

### 1. 本地先查
`content_entries`、Feed、IMA。有匹配就标用途。

### 2. 热点采集
扩 3–5 个关键词，跑 `scripts/collect.py`（wemp-ops `fetch_news.py`）。源失败就跳过。

### 3. 网页搜索与深读
`web_search` 2–3 轮。选 2–4 个 URL，用 `web-to-markdown` 抽正文。没有 `web_fetch`。

### 4. 产出
调研摘要、**写法**、**主题**（一句话，不是标题）。事实带 URL。跑题条目丢掉并注明。

细则：[references/research-strategy.md](references/research-strategy.md)。

## 使用说明

### 触发条件

- ✅ `/outline` 写初稿前还没有调研
- ✅ 「这个题网上怎么写」「先帮我查一下」

### 执行步骤

#### 步骤 1: 本地
只使用对话里已注入的记录。没有就写「本地暂无」。

#### 步骤 2: 采集 + 搜索
```bash
python .teams/content/skills/topic-research/scripts/collect.py --query "想法" --keywords "k1,k2"
```
然后 `web_search`。深读走 `web-to-markdown`。

#### 步骤 3: 落盘
写入同篇目录的 `research.md`。已有锁定主题时不要另定主题。本技能不写正文、不定标题。

## 数据源

| 数据源 | 位置 | 内容 |
|--------|------|------|
| 本地 | 对话注入 | 用户记录 |
| 热点 | `scripts/collect.py` | sspai / juejin / 36kr / v2ex / zhihu 等 |
| 搜索 | `web_search` | 标题、URL、摘要 |
| 原文 | `web-to-markdown` | 页面 Markdown |

## 安全与合规

- ❌ 不编造搜索结果、亲身经历、无来源数字
- ❌ 不定最终标题，不把标题当成主题
- ❌ 不把跑题材料写进 `research.md`
- ✅ 源失败就说明失败
- ✅ 用户没写过的细节标「待补」

## 相关命令

- `/outline` — 调研后写初稿
- `/propose` — 只 remix 已有素材时走 `topic-analyzer`
