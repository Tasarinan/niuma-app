# 写手用法（Niuma）

写稿走系统 API 提供商的文字模型，用 `read` / `write` / `edit` 改当前 `.artifacts/drafts/<YYYYMMDD-主题>/article.md`。

文风、字数、标题长度读 **`.niuma/teams/content/config.yaml`**（对话里会注入 `[内容团队配置]`）。本篇标题/作者/摘要只改同目录 **`article.yaml`**。

- 不要读 `.aws-article/config.yaml`
- 不要跑 `write.py`，不要设置 `WRITING_MODEL_API_KEY`
- 不要创建 `.niuma-article/` 或另一篇 drafts 目录
- 正式稿就是 `article.md`，不要另存 `draft.md`
