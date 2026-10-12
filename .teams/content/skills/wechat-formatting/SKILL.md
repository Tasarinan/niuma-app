---
name: wechat-formatting
description: 把当前篇 article.md 排成微信公众号 HTML。当用户要排版、排全文、转微信格式，或只要预览不要推草稿箱时使用。
---

# 微信排版器

从磁盘最新 `article.md` 生成同目录 `article.html`。禁止用聊天旧正文或旧 HTML。

## 核心功能

### 1. 排全文
优先请用户点编辑栏「排全文」。聊天里才跑脚本。

```bash
python .teams/content/skills/wechat-formatting/scripts/format.py .artifacts/drafts/<YYYYMMDD-主题>/article.md
```

不要加 `--theme`，除非用户当场点名主题 id。缺省读本篇 `article.yaml` 的 `default_format_preset`，没有则用 `default`。

### 2. 主题列表
```bash
python .teams/content/skills/wechat-formatting/scripts/format.py --list-themes
```
内置主题在 `.teams/content/editor/themes/builtin/`。

### 3. 改字再排
还要改字：先改 Markdown 再重跑。HTML 写回同目录 `article.html`。写完后若能导入 `wechat-publish/scripts/preflight.py`，会对 HTML 做一次 lint（`data:image` / `tempkey` / `<script>` 等）；警告只打印，有 error 时仍保存文件并以退出码 1 结束。

## 使用说明

### 触发条件

当用户提到以下场景时，使用此技能：

- ✅ 「排版」「排全文」「转成微信 HTML」
- ✅ 只要预览、不推草稿箱

### 执行步骤

#### 步骤 1: 确认稿件
确认 `.artifacts/drafts/<YYYYMMDD-主题>/article.md` 存在，`read` 确认是当前稿。

#### 步骤 2: 运行 format.py
在仓库根执行，cwd 必须是仓库根。

#### 步骤 3: 预览
不要只用本技能推草稿箱，接着用 `wechat-publish`。

## 数据源

| 数据源 | 位置 | 内容 |
|--------|------|------|
| 排版脚本 | `scripts/format.py` | Markdown → 微信 HTML |
| 本篇主题 | 同目录 `article.yaml` 的 `default_format_preset` | 缺省主题 |
| 内置主题 | `.teams/content/editor/themes/builtin/` | YAML 主题 |
| 主题说明 | `references/format-themes.md` | 主题 id |

## 安全与合规

- ❌ 不用聊天旧正文或旧 HTML
- ❌ 不群发
- ✅ 推草稿箱交给 `wechat-publish`

## 相关入口

- 编辑栏「排全文」
- `wechat-publish` 的 `full` 会先跑本技能的 `format.py`
