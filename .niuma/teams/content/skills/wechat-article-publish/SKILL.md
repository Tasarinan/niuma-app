---
name: wechat-article-publish
description: 小助理发布｜公众号草稿箱 — publish.py full 会先对最新 article.md 排版再提交。触发词：「发到公众号」。
homepage: https://github.com/Tasarinan/niuma-app
---

# 发布

⛔ **禁止直接发布旧的 `article.html`。**

每次发布必须用**此刻磁盘上的最新 `article.md`** 重新生成 HTML，再上传。

## 唯一推荐入口

在仓库根执行 **`publish.py full`**（脚本会**自动**先跑 `format.py`，再上传）：

```bash
python .niuma/teams/content/skills/wechat-article-publish/scripts/publish.py --account N full .artifacts/drafts/<YYYYMMDD-主题>/
```

需要立即发出时加 `--publish`（仍会先排版）。

不要单独 `create-draft` 跳过排版。不要 `--skip-format`（仅调试）。

## 流程

1. 确定 `.artifacts/drafts/<YYYYMMDD-主题>/`（对话里的 `[当前打开的文稿]` 或用户点名）
2. 可选：`read` `article.md` 确认标题/摘要/封面路径
3. 跑 **`publish.py full <目录> --account N`**（内部自动 `format.py` → `article.html` → 微信草稿）
4. 发布前检查：`article.yaml` 标题、作者、摘要、封面 `imgs/cover.png`、正文无 placeholder
5. 发布前先确认对话里的 `[微信公众号槽位]` 已选定槽位
6. 不要把 APPSECRET / API key 写进聊天

用户只要 IMA/飞鸟：用编辑器已有导入，或 wechat-article-assets，不要假装已群发。
