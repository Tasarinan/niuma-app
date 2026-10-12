---
name: manuscript-reviewer
description: 审当前篇 article.md 的结构、事实、语气与合规。当用户要审稿、审这里、审全文，或在编辑栏点了审稿时使用。不改正文、不排版、不发布。
---

# 文稿审稿器

只审磁盘上最新的 `article.md`，列出问题与建议。改不改由用户决定。

## 核心功能

### 1. 结构与事实
- 对照 [references/checklist.md](references/checklist.md) 和 `editor/editorial.yaml`
- 全文再加：结构、事实与语气、最值得改的三处
- 无来源的数字、排名、政策标出来，请用户核实

### 2. 合规与文风
- 标题字数、禁用词、摘要是否可发
- 可跑 `wechat-publish` 的 `preflight.py`（或 `publish.py preflight DIR`）核对微信门槛；不要自动改正文
- AI 腔见 [references/ai-flavor-check.md](references/ai-flavor-check.md)

### 3. 复审
- 有阻断项：等改稿后再 `read` 复审
- 不要自己改正文，不要写 `review.md`

## 使用说明

### 触发条件

当用户提到以下场景时，使用此技能：

- ✅ 编辑栏「审这里 / 审全文」
- ✅ 「能不能发」「合规」
- ✅ 聊天里被点名审稿

### 执行步骤

#### 步骤 1: 读取最新稿
只审 `.artifacts/drafts/<主题>/article.md`。禁止用聊天旧正文。

#### 步骤 2: 对照清单
用中文列出问题与建议。不要输出改写稿。

#### 步骤 3: 交给用户改
改稿请用户用助手「修改」。不要排版、不要发布。

## 数据源

| 数据源 | 位置 | 内容 |
|--------|------|------|
| 当前稿 | `.artifacts/drafts/<主题>/article.md` | 待审正文 |
| 审稿清单 | `references/checklist.md` | 标题、摘要、事实、规范 |
| AI 腔 | `references/ai-flavor-check.md` | 指纹库 |
| 编辑部配置 | `.teams/content/editor/editorial.yaml` | 禁用词、篇幅 |

## 安全与合规

- ❌ 不改正文、不排版、不推草稿箱
- ❌ 不把无来源数字写成已核实
- ✅ 阻断项必须等人改完再复审
- ✅ 建议就医/法律/投资类表述保持中性

## 相关入口

- 编辑栏「审这里 / 审全文」
- 助手「修改」（改稿，不是本技能）
