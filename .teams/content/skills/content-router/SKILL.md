---
name: content-router
description: 内容频道流程地图。当用户问下一步用哪条命令、把聊天和编辑栏搞混时使用。不用于写全文、配图或发布。
---

# 内容流程路由

把用户意图指到正确命令、坐席或编辑栏入口。本技能通常不绑在坐席上；向导正文已有命令表。

## 核心功能

### 1. 命令路由
| 要做的 | 入口 | 技能 |
|--------|------|------|
| 文风、素材去向 | `/style` | （命令即可） |
| 记一则 | `/clip` | （命令即可） |
| 采集热点或一篇文章 | `/scrap` | `scraps`（`collect.py --deep`：HTTP + 可选 Playwright） |
| 采集日报 / 月报 / 出题 | `/digest` `/propose` | `topic-analyzer` |
| 公众号涨粉、阅读、该不该跟读 | `/ops`（`/digest wechat` 同义） | `wechat-publish` |
| 评论拟回复 / 精选，确认再发 | `/ops comments` / `elect` | `wechat-publish` |
| 定主题并写初稿（标题后改） | `/outline` | `topic-research` + `manuscript-writer` |
| 把文字或附图整理进当前稿（须贴题） | 直接粘贴 / `/intake` | `manuscript-writer` |
| 改一段、续写 | 编辑栏助手 | `manuscript-writer` |
| 配图 | 聊天先出 `illustration-plan.md`（确认后再出图）；编辑栏单张沿用锁定 Style | `image-generator` |
| 审稿 | 编辑栏「审这里 / 审全文」 | `manuscript-reviewer` |
| 微信排版 | 编辑栏「排全文」 | `wechat-formatting` |
| 推微信草稿箱 | 稿件信息里的发布 | `wechat-publish` |

### 2. 边界
- 聊天：定主题 → 贴题调研 → 初稿 → 按正文改标题；加长、配图、审稿、排版在编辑栏
- 群发只在公众号后台

## 使用说明

### 触发条件

当用户提到以下场景时，使用此技能：

- ✅ 「下一步该用哪条命令」
- ✅ 把日常记录和写全文搞混
- ✅ 问小红书/知乎能不能发（说明尚未接通）

### 执行步骤

#### 步骤 1: 对照上表
指出入口和技能，不要代做下游技能的工作。

#### 步骤 2: 停
不要写 `article.md`，不要配图，不要推草稿箱。

## 数据源

| 数据源 | 位置 | 内容 |
|--------|------|------|
| 向导命令表 | `.teams/content/agents/guide.md` | 人读路由 |
| 坐席技能 | 各 `agents/*.md` 的 `skills:` | 绑定关系 |

## 安全与合规

- ❌ 不假装小红书、知乎已接通
- ❌ 不把编辑栏流程拉回聊天写全文

## 相关命令

- `/style` `/clip` `/scrap` `/digest` `/ops` `/propose` `/outline` `/intake` `/publish`
