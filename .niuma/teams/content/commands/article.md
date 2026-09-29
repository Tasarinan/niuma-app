---
description: 管理内容草稿 — 开题、打开编辑、改元数据、删除
agent: 主理人
arguments:
  - name: action
    description: 操作类型：create(开新题圆桌)/edit(打开编辑或继续某篇)/update(改 topic 或 article.yaml)/delete(删整篇草稿目录)
    required: true
  - name: target
    description: 选题关键词、目录名或要改的字段（依 action 而定，可空）
    required: false
---

# 文章草稿管理（/article）

管理 `.artifacts/drafts/<YYYYMMDD-主题>/` 下的单篇稿件。成稿源文件是 `article.md`；`topic.md` 记录选题共识；`article.yaml` 存本篇元数据（标题、摘要、排版主题等）。

## 操作类型

### create — 开新题（圆桌）

用户想写**全新**一篇时使用。加载 `article-main`。

**阶段 1 · 未定题前**

- 应用注入 `[中央 Feed · follow-builders]`、`[IMA 文章资产]`
- 未推送草稿仅作对照：**禁止**续写旧稿、**禁止** `open_article` 旧路径
- **禁止** mkdir、**禁止**写 `topic.md`
- 需要角度时 `ROUTE: @采编`

**阶段 2 · 用户确认定题后**

1. 创建 `.artifacts/drafts/<YYYYMMDD-主题>/`（日期用对话 `[今天]` 的 YYYYMMDD）
2. 写入 `topic.md`（必要时空 `article.md`）
3. `open_article` 定位本篇；请用户点「编辑」共创

**示例：**

```
/article create
/article create 写一篇乾坤AI路书，讲 Cursor 多窗口
```

### edit — 打开编辑或继续已定题稿

两种用法：

**A. 仅 UI（无 target）** — 由应用切到工作台「编辑」栏，打开当前/最近一篇。Agent 不代切。

```
/article edit
```

**B. 指定草稿（有 target）** — 主理人继续共创：列出 `[未推送草稿]`，匹配 target 后 `open_article` 定位该篇 `article.md`（没有则 `topic.md`），再 `ROUTE` 写手 / 配图师 / 主编 / 发行。**不要**再 mkdir 或开选题会。

```
/article edit 20250920-cursor
/article edit 乾坤AI路书
```

### update — 修改本篇元数据或选题摘要

只改当前（或 target 指定）目录内的 `topic.md`、`article.yaml` 或 `article.md` 的标题行（H1），不另开新目录。

- 改标题 / 摘要 / 作者 / 排版预设 → 写 `article.yaml` 或同步 `article.md` 首行 `# 标题`
- 改选题共识 → 更新 `topic.md`
- 不要创建 `.niuma-article/` 或第二套 drafts

**示例：**

```
/article update 标题 改成「Cursor 多开实战」
/article update 20250920-cursor 摘要 80字以内
```

### delete — 删除整篇草稿目录

用户明确要**丢弃**某篇未推送稿时使用。先确认目录与标题，再删除整个 `.artifacts/drafts/<文件夹>/`（含 article、配图、review）。已推送的稿不要删本地目录除非用户坚持。

**示例：**

```
/article delete 20250920-旧题
/article delete 测试稿
```

## 与其它命令

| 命令 | 用途 |
|------|------|
| `/format` | 排版，不建稿 |
| `/publish` | 推草稿箱 |
| `/article create` | 开新题（禁止顺带续旧稿） |
| `/article edit <target>` | 继续已定题稿 |

## 边界

- 写稿 / 配图走系统 API 提供商；不要 legacy 密钥脚本
- 不要创建 `.niuma-article/`
- 排版 / 发布归发行，不是 `/article`
