---
name: manuscript-writer
description: 在调研之后写初稿，把用户文字或附图整理进当前稿。当用户使用 /outline、/intake、直接粘贴素材，或点名改某一段时使用。不配图、不排版、不发布。
---

# 文稿写手技能

把已定主题写成初稿。正式稿只有一份：磁盘上的 `article.md`。主题先锁；后补材料要对着主题筛。标题按写成的内容再改。

## 核心功能

### 1. 写初稿（/outline）
- 先定主题（一句话），写入 `topic.md`。主题不是标题
- 没有 `research.md` 时加载 `topic-research`，只保留贴题材料
- 聊天里讲写法（各节要解决什么），把废水想法列为禁用
- 新目录先问用户确认，确认前不要 mkdir。只写对话里锁定的 `.artifacts/drafts/<YYYYMMDD-主题>/`
- `article.md`：工作标题（可暂用主题原句）+ 可读初稿，篇幅按 `target_word_count`（缺省 1800–2500 字）
- 写的时候执行 [references/craft-checks.md](references/craft-checks.md)：排水、五大技巧、不暴露 AI
- `open_article` 定位 `article.md`
- 标题按正文后面再改，用双轨：[references/title-dual-track.md](references/title-dual-track.md)。改 H1 不改主题

### 2. 改已有稿
- `read` 最新 `article.md`
- 只改用户点名的那一段
- 文风优先 `content_profiles`，没有档案时用 `editorial.yaml`

### 3. 整理进稿（/intake、直接粘贴或附图）
- 先 `read` `topic.md` 的主题，再 `read` `article.md`
- 不贴题：说明不用，不要硬塞，不要为了这段话改主题
- 贴题：用本文语气改写进合适小节；用户没说「引用」就不要整段粘贴
- 别人的话带来源或标「待核」，不要写成用户亲身经历
- 没有当前稿时说明先 `/outline`，不要另开一篇

### 4. 结构约束
- 初稿要成段，不要空 H2
- 不要编造亲身经历或无来源数字
- 配图、排版、发布不是本技能

## 使用说明

### 触发条件

- ✅ `/outline <想法或主题>`
- ✅ 用户在初稿之后回复标题编号
- ✅ `/intake`、直接粘贴或附图，要写进当前稿
- ✅ 点名改某一段；编辑栏「修改 / 续写」

### 执行步骤

#### 步骤 1: 定主题再调研
先锁主题。未调研时跑 `topic-research`，材料必须贴题。不要先卡在选标题。

#### 步骤 2: 写磁盘文件
唯一正文：`article.md`。不要另写 `draft.md`。

#### 步骤 3: 标题后改
按已写内容给出爆款 3–5 + 自然 3–5，再推荐 Top 3。改标题不改主题。

结构：[references/structure-template.md](references/structure-template.md)。写法检查：[references/craft-checks.md](references/craft-checks.md)。标题：[references/title-dual-track.md](references/title-dual-track.md)。落盘：[references/usage.md](references/usage.md)。

## 数据源

| 数据源 | 位置 | 内容 |
|--------|------|------|
| 调研 | 同目录 `research.md` 或本轮 `topic-research` | 写法、URL |
| 文风 | `content_profiles` / `editorial.yaml` | 栏目、语气 |
| 本篇元数据 | `article.yaml` | 标题稍后写入 |

## 安全与合规

- ❌ 不编造亲身经历、排名、无来源数字
- ❌ 不暴露 AI 参与写作
- ❌ 不配图、不排版、不推草稿箱
- ✅ 先 `read` 再改
- ✅ 主题锁定后材料必须贴题；标题可后改

## 相关命令

- `/outline` — 调研后写初稿
- `/intake` — 把文字或附图整理进当前稿
