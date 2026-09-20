---
name: article-formatting-wechat
description: 发行排版｜Markdown 转微信 HTML — 必须从磁盘最新 article.md 生成 article.html。触发词：「/format WECHAT」「排版」「转 HTML」。
homepage: https://github.com/Tasarinan/niuma-app
---

# 排版（最新 Markdown）

⛔ **永远从磁盘上的最新 `article.md` 生成微信 HTML。**

禁止使用聊天历史、旧 `article.html`、或记忆中的正文。人和写手可能刚改过 Markdown。

## 步骤

1. 确定草稿目录 `.artifacts/drafts/<YYYYMMDD-主题>/`
2. 用 `read` 打开该目录 `article.md`，确认读到的是当前文件
3. 立刻对该路径运行 `format.py`（工作区根为 cwd）。用 `bash` 跑这一条即可，不要再 `ls` / `cat` skill 目录：

```bash
python {baseDir}/scripts/format.py .artifacts/drafts/<YYYYMMDD-主题>/article.md
```

**不要加 `--theme`**，除非用户在对话里当场点名一个主题 id。缺省时脚本读取本篇 `article.yaml` 的 `default_format_preset`（编辑器「排版样式」写入的 YAML 列表，例如 `[wechat-tech]`），没有则用 `default`。

4. 输出写到同目录 `article.html`。若脚本写到别处，把结果拷到 `.artifacts/drafts/<YYYYMMDD-主题>/article.html`
5. 告诉用户：HTML 已由**刚才读到的那份 article.md** 生成；若还要改字，先改 Markdown 再重新跑本 skill

## 主题

内置主题在 `references/presets/themes/`。除 Niuma 四套（`default` / `grace` / `modern` / `simple`）外，还有从 [花生公众号排版器](https://github.com/alchaincyf/huasheng_editor)（MIT）迁入的样式（`wechat-default`、`wechat-tech`、`wechat-anthropic`、`wechat-nyt` 等）。完整列表：

```bash
python {baseDir}/scripts/format.py --list-themes
```

用户在编辑器右侧「排版样式」里选好的主题写在本篇 `article.yaml`，排版时跟那一份走。

不要读 `.aws-article/config.yaml`。正文只有当前草稿目录的 `article.md`，HTML 写回同一目录 `article.html`。
