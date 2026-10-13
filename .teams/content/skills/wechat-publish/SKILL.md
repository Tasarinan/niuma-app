---
name: wechat-publish
description: 把当前篇排版后推到微信公众号草稿箱，或拉取公众号运营日报。当用户使用 /publish、/ops、/digest wechat，要发到公众号或看涨粉阅读时使用。只推草稿箱，不群发。
---

# 微信草稿箱发布器

把已定稿排版后推到公众号草稿箱。群发必须用户单独确认后再加 `--publish`。禁止直接上传旧 `article.html`。

## 核心功能

### 1. 一键 full
规范入口：编辑栏 → 排版与发布 → 推到公众号草稿箱。`/publish` 是后备。

```bash
python .teams/content/skills/wechat-publish/scripts/publish.py --account N full .artifacts/drafts/<YYYYMMDD-主题>/
```

`full` 会先跑 `wechat-formatting` 的 `format.py`，再创建草稿。不要 `create-draft` 跳过排版，不要 `--skip-format`。

### 2. 账号槽位
根据对话里 `[微信公众号槽位]` 使用 `--account N`。不要打印 APPSECRET。

### 3. 发布前核对
标题/作者/摘要、`imgs/cover.png`、正文无占位符。清单见 [references/pre-publish-checklist.md](references/pre-publish-checklist.md)。

`full` 会先跑配图预检（封面 < 10MB、不要 webp），再 `format.py`。摘要空时从 `article.md` 截 54 字。access_token 本地缓存并提前 5 分钟刷新。

稿件预检（标题 UTF-8 ≤96 字节避免 45028、摘要、HTML、配图）用 `scripts/preflight.py`，或：

```bash
python .teams/content/skills/wechat-publish/scripts/publish.py preflight .artifacts/drafts/<YYYYMMDD-主题>/
python .teams/content/skills/wechat-publish/scripts/publish.py check-images .artifacts/drafts/<YYYYMMDD-主题>/
```

### 4. 运营日报（不是采集早报）

```bash
python .teams/content/skills/wechat-publish/scripts/daily_report.py --range daily
python .teams/content/skills/wechat-publish/scripts/daily_report.py --range week
```

默认统计昨天（datacube T+1）。写入 `.artifacts/wechat/ops/`。不要读 scraps。不要编造阅读量。

### 5. 评论（拟回复，确认再发）

```bash
python .teams/content/skills/wechat-publish/scripts/comments.py list --count 5
python .teams/content/skills/wechat-publish/scripts/comments.py send --file .artifacts/wechat/ops/comment-drafts.json
python .teams/content/skills/wechat-publish/scripts/comments.py send --file .artifacts/wechat/ops/comment-drafts.json --yes
python .teams/content/skills/wechat-publish/scripts/comments.py elect <articleId_commentId>
python .teams/content/skills/wechat-publish/scripts/comments.py elect <articleId_commentId> --yes
python .teams/content/skills/wechat-publish/scripts/comments.py unelect <articleId_commentId> --yes
```

只对 JSON 里的真实评论拟回复。`unreplied` 会跳过已回复、已在 `comment-drafts.json`、以及 `processed-comments.json` 的 id。没有 `--yes` 只预览，不发到微信、不精选。不要编造读者留言。

## 使用说明

### 触发条件

当用户提到以下场景时，使用此技能：

- ✅ 「推到公众号草稿箱」「发到公众号」
- ✅ `/publish WECHAT`
- ✅ `/ops`、`/digest wechat`、公众号涨粉/阅读/该不该跟读
- ✅ `/ops comments` 拉评论并拟回复；确认后 `/ops comments send` / `elect`

### 执行步骤

#### 步骤 1: 确认目录与账号
目录来自 `[当前共创目录]` 或用户点名。槽位未定时先让用户选。

#### 步骤 2: 核对清单
对照 `article.yaml` 与封面。

#### 步骤 3: 推草稿箱或写运营报告
`/publish`：在仓库根执行 `publish.py full`。告诉用户去公众号后台草稿箱预览。不要假装已经群发。
`/ops`：跑 `daily_report.py`，展示 `.artifacts/wechat/ops/` 里的报告，说明该不该跟读。
`/ops comments`：`comments.py list`，只给新的 unreplied 拟回复并等人确认。精选走 `elect`，未确认不要 `--yes`。

小红书、知乎尚未接通。

## 数据源

| 数据源 | 位置 | 内容 |
|--------|------|------|
| 发布脚本 | `scripts/publish.py` | token、上传、草稿、`preflight` |
| 运营报告 | `scripts/daily_report.py` | 涨粉、阅读、分享 |
| 评论 | `scripts/comments.py` | 拉取、dry-run、确认后回复 |
| 预检脚本 | `scripts/preflight.py` | 标题/摘要/HTML/配图 |
| 排版脚本 | `../wechat-formatting/scripts/format.py` | full 前强制重排 |
| 清单 | `references/pre-publish-checklist.md` | 发布前检查 |
| 凭证 | 工作区 `.env.local` 的 `WECHAT_N_*` | 勿发聊天 |

## 安全与合规

- ❌ 不群发（除非用户单独确认 `--publish`）
- ❌ 不打印 APPSECRET
- ❌ 不直传旧 HTML
- ❌ 不假装小红书、知乎已发

## 相关命令

- `/publish` — 后备入口
- `/ops` — 公众号后台数据（`/digest wechat` 同义）
- `/ops comments` — 拟新评回复；`send` / `elect` / `unelect` 均须确认后 `--yes`
- 编辑栏稿件信息里的发布 — 规范入口
